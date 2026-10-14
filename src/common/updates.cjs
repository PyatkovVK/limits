'use strict';
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT = 15000;
const RELEASES_API = 'https://api.github.com/repos/PyatkovVK/limits/releases';

function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.exec(value);
  if (!match) return null;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function normalizeVersion(value) { return parseVersion(value)?.join('.') || null; }
function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right);
  if (!a || !b) throw new Error('invalidVersion');
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}
function validatedReleaseUrl(value, tag) {
  if (!parseVersion(tag)) throw new Error('invalidResponse');
  let url;
  try { url = new URL(value); } catch { throw new Error('invalidResponse'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash ||
      url.pathname !== `/PyatkovVK/limits/releases/tag/${tag}`) throw new Error('invalidResponse');
  return url.href;
}
function newestRelease(releases) {
  if (!Array.isArray(releases)) throw new Error('invalidResponse');
  let newest;
  for (const release of releases) {
    if (!release || release.draft !== false || release.prerelease !== false || !parseVersion(release.tag_name)) continue;
    if (!newest || compareVersions(release.tag_name, newest.tag_name) > 0) newest = release;
  }
  if (!newest) throw new Error('noRelease');
  return { version: normalizeVersion(newest.tag_name), tag: newest.tag_name, url: validatedReleaseUrl(newest.html_url, newest.tag_name) };
}
async function fetchReleases({ signal, fetchImpl = fetch }) {
  const releases = [];
  // Publication order is not semantic version order. Never report "current"
  // from a partial list when the finite pagination bound is reached.
  for (let page = 1; page <= 10; page++) {
    signal.throwIfAborted();
    const response = await fetchImpl(`${RELEASES_API}?per_page=100&page=${page}`, {
      signal, redirect: 'error', credentials: 'omit',
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Limits-update-check' },
    });
    if (!response.ok) throw new Error([403, 429].includes(response.status) ? 'rateLimited' : 'checkFailed');
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error('invalidResponse');
    releases.push(...items);
    if (items.length < 100) return releases;
  }
  throw new Error('invalidResponse');
}

class Updates extends EventEmitter {
  constructor({ currentVersion, root, demo = false, fetchImpl = fetch, openExternal = async () => {}, now = Date.now,
    setTimer = setTimeout, clearTimer = clearTimeout, timeout = REQUEST_TIMEOUT } = {}) {
    super();
    if (!parseVersion(currentVersion)) throw new Error('invalidVersion');
    Object.assign(this, { demo, fetchImpl, openExternal, now, setTimer, clearTimer, timeout });
    this.file = root && !demo ? path.join(root, 'update-settings.json') : null;
    this.dismissedVersion = null;
    if (this.file) try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.dismissedVersion = normalizeVersion(saved.dismissedVersion);
    } catch { /* Missing or corrupt preferences do not affect checks. */ }
    this.state = { currentVersion: normalizeVersion(currentVersion), status: 'idle', release: null, checkedAt: null, error: null };
    this.demoScenario = 'current';
    this.nextCheckAt = null;
    this.running = false;
    this.stopped = false;
    this.pending = null;
    this.offerPending = false;
  }
  snapshot() {
    const release = this.state.release && { ...this.state.release };
    const offer = release && (!this.dismissedVersion || compareVersions(release.version, this.dismissedVersion) > 0) ? { ...release } : null;
    return { ...this.state, release, offer, demo: this.demo, demoScenario: this.demoScenario };
  }
  publish(patch) {
    Object.assign(this.state, patch);
    const next = this.snapshot();
    const announce = Boolean(next.offer) && !this.offerPending;
    // Keep one outstanding offer until it is dismissed or no longer available.
    // Polls can update its version without queuing another window opening.
    this.offerPending = Boolean(next.offer);
    this.emit('state', next);
    if (announce && this.offerPending && !this.stopped) this.emit('offer', this.snapshot().offer);
  }
  start() {
    if (this.running || this.stopped) return this.pending || Promise.resolve(this.snapshot());
    this.running = true;
    return this.check();
  }
  schedule() {
    this.clearTimer(this.timer);
    if (!this.running || this.stopped) return;
    this.timer = this.setTimer(() => { void this.check(); }, Math.max(0, this.nextCheckAt - this.now()));
    this.timer?.unref?.();
  }
  resume() {
    if (!this.running || this.stopped || this.now() < this.nextCheckAt) return this.pending || Promise.resolve(this.snapshot());
    return this.check();
  }
  check() {
    if (this.stopped) return Promise.resolve(this.snapshot());
    if (this.pending) return this.pending;
    this.clearTimer(this.timer);
    this.nextCheckAt = this.now() + CHECK_INTERVAL;
    const controller = new AbortController();
    this.controller = controller;
    const timeoutTimer = this.setTimer(() => controller.abort(new Error('timeout')), this.timeout);
    this.pending = Promise.resolve().then(async () => {
      try {
        const releases = this.demo ? await this.demoReleases(controller.signal) : await fetchReleases({ signal: controller.signal, fetchImpl: this.fetchImpl });
        controller.signal.throwIfAborted();
        const newest = newestRelease(releases);
        const available = compareVersions(newest.version, this.state.currentVersion) > 0;
        if (!this.stopped) this.publish({ status: available ? 'available' : 'current', release: available ? newest : null, checkedAt: this.now(), error: null });
      } catch (error) {
        const code = controller.signal.aborted ? 'timeout' : ['rateLimited', 'invalidResponse', 'noRelease'].includes(error.message) ? error.message : 'checkFailed';
        if (!this.stopped) this.publish({ status: 'error', checkedAt: this.now(), error: code });
      } finally {
        this.clearTimer(timeoutTimer);
        this.controller = null;
        this.pending = null;
        this.schedule();
      }
      return this.snapshot();
    });
    this.publish({ status: 'checking', error: null });
    return this.pending;
  }
  dismiss(version) {
    if (this.stopped || version !== this.state.release?.version) return { error: 'unavailable' };
    this.dismissedVersion = version;
    if (this.file) {
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ dismissedVersion: version }));
        fs.renameSync(`${this.file}.tmp`, this.file);
      } catch { /* Keep dismissal in memory even if storage is read-only. */ }
    }
    this.publish({});
    return this.snapshot();
  }
  async openRelease() {
    const release = this.state.release;
    if (!release || this.stopped) return { error: 'unavailable' };
    try {
      const url = validatedReleaseUrl(release.url, release.tag);
      if (!this.demo) await this.openExternal(url);
      this.dismiss(release.version);
      return { opened: true, simulated: this.demo };
    } catch { return { error: 'openFailed' }; }
  }
  setDemoScenario(scenario) {
    if (!this.demo || !['current', 'available', 'error'].includes(scenario) || this.pending) return { error: 'unavailable' };
    this.demoScenario = scenario;
    this.dismissedVersion = null;
    return this.check();
  }
  async demoReleases(signal) {
    const scenario = this.demoScenario;
    await new Promise((resolve, reject) => {
      const abort = () => { this.clearTimer(timer); reject(signal.reason); };
      const timer = this.setTimer(() => { signal.removeEventListener('abort', abort); resolve(); }, 300);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    if (scenario === 'error') throw new Error('checkFailed');
    const parts = parseVersion(this.state.currentVersion);
    if (scenario === 'available') parts[1]++;
    const tag = `v${parts.join('.')}`;
    return [{ tag_name: tag, draft: false, prerelease: false, html_url: `https://github.com/PyatkovVK/limits/releases/tag/${tag}` }];
  }
  stop() {
    this.stopped = true;
    this.running = false;
    this.clearTimer(this.timer);
    this.controller?.abort();
  }
}

module.exports = { Updates, CHECK_INTERVAL, REQUEST_TIMEOUT, parseVersion, normalizeVersion, compareVersions, validatedReleaseUrl, newestRelease, fetchReleases };
