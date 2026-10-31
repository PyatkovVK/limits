'use strict';
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { RESET_CHECK_INTERVAL_MINUTES } = require('./polling-defaults.cjs');

const CHECK_INTERVAL = RESET_CHECK_INTERVAL_MINUTES * 60 * 1000;
const REQUEST_TIMEOUT = 15000;
const STATUS_API = 'https://codex-resets.com/api/v1/status';
const LINKS = { site: 'https://codex-resets.com/', author: 'https://x.com/wong2__' };

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('invalidResponse');
  return Date.parse(value);
}
function parseStatus(value, now = Date.now()) {
  const data = value?.data;
  if (value?.meta?.api_version !== 'v1' || !data || !Object.hasOwn(data, 'scheduled_reset') || !Object.hasOwn(data, 'active_watch')) throw new Error('invalidResponse');
  let scheduled = null, watch = null;
  if (data.scheduled_reset !== null) {
    const item = data.scheduled_reset;
    if (!item || typeof item.id !== 'string' || !/^[\w-]{1,128}$/.test(item.id) || item.status !== 'scheduled' || !['regular', 'banked'].includes(item.reset_type)) throw new Error('invalidResponse');
    const announcedAt = timestamp(item.announced_at);
    const scheduledFor = item.scheduled_for === null ? null : timestamp(item.scheduled_for);
    if (announcedAt > now || (scheduledFor !== null && scheduledFor < announcedAt)) throw new Error('invalidResponse');
    if (scheduledFor === null || scheduledFor > now) scheduled = { kind: 'scheduled', key: `scheduled:${item.id}`, resetType: item.reset_type, announcedAt, scheduledFor };
  }
  if (data.active_watch !== null) {
    const item = data.active_watch;
    if (!item || !['elevated', 'strong'].includes(item.level) || (item.reset_chance_percent !== null &&
        (!Number.isInteger(item.reset_chance_percent) || item.reset_chance_percent < 0 || item.reset_chance_percent > 100))) throw new Error('invalidResponse');
    const observedAt = timestamp(item.observed_at), expiresAt = timestamp(item.expires_at);
    if (observedAt > now || expiresAt <= observedAt) throw new Error('invalidResponse');
    if (expiresAt > now) watch = { kind: 'forecast', key: `watch:${observedAt}`, level: item.level, chance: item.reset_chance_percent, observedAt, expiresAt };
  }
  // Executed resets, account limits and arbitrary source text/URLs are never used.
  return { scheduled, watch };
}

class ResetNotifications extends EventEmitter {
  constructor({ root, demo = false, fetchImpl = fetch, notify = () => true, openExternal = async () => {}, now = Date.now,
    setTimer = setTimeout, clearTimer = clearTimeout, timeout = REQUEST_TIMEOUT } = {}) {
    super();
    Object.assign(this, { demo, fetchImpl, notify, openExternal, now, setTimer, clearTimer, timeout });
    this.file = root && !demo ? path.join(root, 'reset-notifications.json') : null;
    this.enabled = false;
    this.seen = new Set();
    if (this.file) try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.enabled = saved.enabled === true;
      if (Array.isArray(saved.seen)) this.seen = new Set(saved.seen.filter(key => typeof key === 'string' && key.length <= 160).slice(-128));
    } catch { /* Missing or corrupt preferences keep the integration disabled. */ }
    this.state = { status: this.enabled ? 'idle' : 'disabled', scheduled: null, watch: null, checkedAt: null, error: null, notificationError: null };
    this.running = false;
    this.stopped = false;
    this.pending = null;
    this.generation = 0;
    this.nextCheckAt = null;
    this.demoScenario = 'quiet';
    this.demoSequence = 0;
  }
  snapshot() {
    const now = this.now();
    return { ...this.state, enabled: this.enabled, demo: this.demo, demoScenario: this.demoScenario,
      scheduled: this.state.scheduled && (this.state.scheduled.scheduledFor === null || this.state.scheduled.scheduledFor > now) ? { ...this.state.scheduled } : null,
      watch: this.state.watch?.expiresAt > now ? { ...this.state.watch } : null };
  }
  publish(patch = {}) { Object.assign(this.state, patch); this.emit('state', this.snapshot()); }
  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ enabled: this.enabled, seen: [...this.seen].slice(-128) }));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  start() {
    if (this.running || this.stopped) return this.pending || Promise.resolve(this.snapshot());
    this.running = true;
    return this.enabled ? this.check() : Promise.resolve(this.snapshot());
  }
  cancel() {
    this.generation++;
    this.clearTimer(this.timer);
    this.controller?.abort(new Error('cancelled'));
    this.controller = null;
    this.pending = null;
  }
  setEnabled(value) {
    if (this.stopped || typeof value !== 'boolean') return { ...this.snapshot(), actionError: 'unavailable' };
    if (value === this.enabled) return this.snapshot();
    const previous = this.enabled;
    this.enabled = value;
    try { this.save(); }
    catch { this.enabled = previous; return { ...this.snapshot(), actionError: 'saveFailed' }; }
    this.cancel();
    this.publish({ status: value ? 'idle' : 'disabled', error: null, notificationError: null });
    if (value && this.running) void this.check();
    return this.snapshot();
  }
  schedule() {
    this.clearTimer(this.timer);
    if (!this.running || !this.enabled || this.stopped) return;
    this.timer = this.setTimer(() => { void this.check(); }, Math.max(0, this.nextCheckAt - this.now()));
    this.timer?.unref?.();
  }
  resume() {
    if (!this.running || !this.enabled || this.stopped || this.now() < this.nextCheckAt) return this.pending || Promise.resolve(this.snapshot());
    return this.check();
  }
  deliveryFailed(key) {
    this.seen.delete(key);
    try { this.save(); } catch { /* Keep the next retry possible in memory. */ }
    if (this.enabled && !this.stopped) this.publish({ notificationError: 'notificationFailed' });
  }
  check() {
    if (!this.enabled || this.stopped) return Promise.resolve(this.snapshot());
    if (this.pending) return this.pending;
    this.clearTimer(this.timer);
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.nextCheckAt = this.now() + CHECK_INTERVAL;
    const timeoutTimer = this.setTimer(() => controller.abort(new Error('timeout')), this.timeout);
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    this.pending = Promise.resolve().then(async () => {
      try {
        if (controller.signal.aborted) await aborted;
        const request = this.demo ? Promise.resolve(this.demoStatus()) : this.fetchImpl(STATUS_API, {
          signal: controller.signal, redirect: 'error', credentials: 'omit',
          headers: { Accept: 'application/json', 'User-Agent': 'Limits-reset-notifications' },
        }).then(async response => {
          if (!response.ok) throw new Error(response.status === 429 ? 'rateLimited' : 'checkFailed');
          return response.json();
        });
        const value = await Promise.race([request, aborted]);
        controller.signal.throwIfAborted();
        if (generation !== this.generation || !this.enabled || this.stopped) return this.snapshot();
        const status = parseStatus(value, this.now());
        this.publish({ ...status, status: 'ready', error: null, checkedAt: this.now(), notificationError: null });
        // A scheduled announcement takes precedence over a forecast for the same upcoming reset.
        const event = status.scheduled || status.watch;
        if (event && !this.seen.has(event.key) && generation === this.generation && this.enabled && !this.stopped) {
          let delivered = true;
          try { if (!this.demo) delivered = this.notify({ ...event }) !== false; } catch { delivered = false; }
          if (delivered) {
            this.seen.add(event.key);
            this.seen = new Set([...this.seen].slice(-128));
            try { this.save(); } catch { this.publish({ notificationError: 'saveFailed' }); }
            this.emit('notification', { ...event });
          } else this.publish({ notificationError: 'notificationFailed' });
        }
      } catch (error) {
        if (generation === this.generation && this.enabled && !this.stopped) {
          const code = controller.signal.aborted ? 'timeout' : ['rateLimited', 'invalidResponse'].includes(error.message) ? error.message : 'checkFailed';
          this.publish({ status: 'error', error: code, checkedAt: this.now() });
        }
      } finally {
        this.clearTimer(timeoutTimer);
        controller.signal.removeEventListener('abort', onAbort);
        if (generation === this.generation) { this.controller = null; this.pending = null; this.schedule(); }
      }
      return this.snapshot();
    });
    this.publish({ status: 'checking', error: null });
    return this.pending;
  }
  async openLink(kind) {
    if (this.stopped || !Object.hasOwn(LINKS, kind)) return { error: 'unavailable' };
    try { if (!this.demo) await this.openExternal(LINKS[kind]); return { opened: true, simulated: this.demo }; }
    catch { return { error: 'openFailed' }; }
  }
  setDemoScenario(scenario) {
    if (!this.demo || !['quiet', 'scheduled', 'forecast', 'error'].includes(scenario) || this.stopped) return { error: 'unavailable' };
    this.cancel();
    this.demoScenario = scenario;
    this.demoSequence++;
    return this.check();
  }
  demoStatus() {
    if (this.demoScenario === 'error') throw new Error('checkFailed');
    const iso = delta => new Date(this.now() + delta).toISOString();
    return { meta: { api_version: 'v1' }, data: {
      scheduled_reset: this.demoScenario === 'scheduled' ? { id: `demo-${this.demoSequence}`, status: 'scheduled', reset_type: 'regular', announced_at: iso(-60000), scheduled_for: iso(60 * 60 * 1000) } : null,
      active_watch: this.demoScenario === 'forecast' ? { level: 'strong', reset_chance_percent: 80, observed_at: iso(-60000 + this.demoSequence), expires_at: iso(12 * 60 * 60 * 1000) } : null,
    } };
  }
  stop() { this.stopped = true; this.running = false; this.cancel(); }
}

module.exports = { ResetNotifications, parseStatus, CHECK_INTERVAL, REQUEST_TIMEOUT, STATUS_API, LINKS };
