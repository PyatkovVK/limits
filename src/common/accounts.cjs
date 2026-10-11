'use strict';
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isStale } = require('./limits.cjs');
// Keep this list aligned with Codex's supported host-owned auth selectors.
const AUTH_ENV_VARIABLES = Object.freeze(['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN',
  'OPENAI_FEDERATION_RULE_ID', 'OPENAI_IDENTITY_TOKEN_FILE', 'OPENAI_WORKLOAD_IDENTITY_CONTEXT']);

const nickname = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80) : '';
function clientOptions(root, profile, env = process.env) {
  if (profile.id === 'default') return { env };
  const isolated = { ...env, CODEX_HOME: path.join(root, 'accounts', profile.id) };
  for (const key of Object.keys(isolated)) if (AUTH_ENV_VARIABLES.includes(key.toUpperCase())) delete isolated[key];
  return { env: isolated, args: ['-c', 'cli_auth_credentials_store="file"', 'app-server', '--listen', 'stdio://'] };
}

class Accounts extends EventEmitter {
  constructor({ root, createMonitor, initialProfiles }) {
    super();
    Object.assign(this, { root, createMonitor });
    this.file = path.join(root, 'accounts.json');
    this.monitors = new Map();
    this.loginActive = null;
    this.loginAttempt = null;
    this.removing = new Map();
    let saved;
    if (!initialProfiles) {
      try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* First launch. */ }
    }
    const records = initialProfiles || saved?.profiles || [{ id: 'default', nickname: '' }];
    const seen = new Set();
    this.profiles = (Array.isArray(records) ? records : []).filter(profile => {
      if (!profile || typeof profile.id !== 'string' || !/^(default|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(profile.id) || seen.has(profile.id)) return false;
      seen.add(profile.id); return true;
    }).map(profile => ({ id: profile.id, nickname: nickname(profile.nickname) }));
    if (!this.profiles.some(profile => profile.id === 'default')) this.profiles.unshift({ id: 'default', nickname: '' });
    this.selectedProfileId = this.profiles.some(profile => profile.id === saved?.selectedProfileId) ? saved.selectedProfileId : this.profiles[0].id;
    this.profiles.forEach(profile => this.attach(profile));
  }
  attach(profile) {
    if (profile.id !== 'default') fs.mkdirSync(path.join(this.root, 'accounts', profile.id), { recursive: true });
    const monitor = this.createMonitor(profile, clientOptions(this.root, profile));
    this.monitors.set(profile.id, monitor);
    monitor.on('state', () => this.publish());
    monitor.on('diagnostic', info => this.emit('diagnostic', { ...info, profileId: profile.id }));
    monitor.on('login-ended', attempt => this.finishLogin(attempt));
    return monitor;
  }
  snapshot() {
    const profiles = this.profiles.map(profile => {
      const state = this.monitors.get(profile.id).state;
      return { ...state, id: profile.id, nickname: profile.nickname, displayName: profile.nickname || state.account?.email || '', stale: isStale(state) };
    });
    const counts = new Map();
    for (const profile of profiles) {
      const key = profile.displayName.toLocaleLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const profile of profiles) {
      if (profile.nickname && counts.get(profile.displayName.toLocaleLowerCase()) > 1 && profile.account?.email) profile.displayName += ` (${profile.account.email})`;
    }
    const selected = profiles.find(profile => profile.id === this.selectedProfileId);
    return { ...selected, profiles, selectedProfileId: this.selectedProfileId, loginProfileId: this.loginActive };
  }
  publish() { this.emit('state', this.snapshot()); }
  persist() {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ version: 1, profiles: this.profiles, selectedProfileId: this.selectedProfileId }));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  async refresh() {
    await Promise.all([...this.monitors.values()].map(async monitor => {
      await monitor.refresh();
      // Account notifications can queue a second read during initialization.
      while (monitor.inflight) await monitor.inflight;
    }));
    return this.snapshot();
  }
  select(id) { this.monitors.get(this.selectedProfileId)?.select(id); }
  selectProfile(id) {
    if (!this.monitors.has(id)) throw new Error('Unknown profile');
    this.selectedProfileId = id; this.persist(); this.publish();
  }
  rename(id, value) {
    const profile = this.profiles.find(item => item.id === id);
    if (!profile) throw new Error('Unknown profile');
    profile.nickname = nickname(value); this.persist(); this.publish();
  }
  add() {
    const profile = { id: randomUUID(), nickname: '' };
    this.attach(profile); this.profiles.push(profile); this.persist(); this.publish();
    return profile.id;
  }
  async login(id = this.selectedProfileId) {
    const monitor = this.monitors.get(id);
    if (!monitor || this.removing.has(id)) throw new Error('Unknown profile');
    const busy = () => { const error = new Error('Login in progress'); error.code = 'loginBusy'; throw error; };
    if (this.loginActive && (this.loginActive !== id || this.loginAttempt?.phase !== 'active')) busy();
    if (this.loginActive === id) await this.cancelLogin(id);
    // Another profile or removal can take over while cancellation is awaiting RPC.
    if (this.loginActive) busy();
    if (this.removing.has(id) || this.monitors.get(id) !== monitor) throw new Error('Unknown profile');
    const attempt = { cancelled: false, phase: 'preparing' };
    this.loginAttempt = attempt; this.loginActive = id; this.publish();
    try {
      const authUrl = await monitor.login(attempt);
      return this.loginAttempt === attempt && !attempt.cancelled ? authUrl : null;
    } catch (error) { this.finishLogin(attempt); throw error; }
  }
  finishLogin(attempt) {
    if (this.loginAttempt !== attempt) return;
    this.loginAttempt = null; this.loginActive = null; this.publish();
  }
  async cancelLogin(id, expectedAttempt = this.loginAttempt) {
    const monitor = this.monitors.get(id);
    if (!monitor || this.loginActive !== id || this.loginAttempt !== expectedAttempt) return;
    const attempt = this.loginAttempt;
    attempt.cancelled = true; attempt.phase = 'cancelling';
    try { await monitor.cancelLogin(); }
    finally { this.finishLogin(attempt); }
  }
  remove(id) {
    if (this.removing.has(id)) return this.removing.get(id);
    const removal = this.removeProfile(id);
    this.removing.set(id, removal);
    return removal.finally(() => this.removing.delete(id));
  }
  async removeProfile(id) {
    if (id === 'default') throw new Error('The shared Codex account is managed by Codex');
    const monitor = this.monitors.get(id);
    if (!monitor) return;
    await this.cancelLogin(id);
    await monitor.client.start();
    await monitor.client.request('account/logout');
    monitor.stop(); this.monitors.delete(id);
    this.profiles = this.profiles.filter(profile => profile.id !== id);
    if (this.selectedProfileId === id) this.selectedProfileId = this.profiles[0].id;
    this.persist(); this.publish();
  }
  stop() { this.monitors.forEach(monitor => monitor.stop()); }
}
module.exports = { Accounts, clientOptions, AUTH_ENV_VARIABLES };
