'use strict';
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isStale } = require('./limits.cjs');

const nickname = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80) : '';
function clientOptions(root, profile, env = process.env) {
  if (profile.id === 'default') return { env };
  const isolated = { ...env, CODEX_HOME: path.join(root, 'accounts', profile.id) };
  delete isolated.OPENAI_API_KEY;
  delete isolated.CODEX_API_KEY;
  return { env: isolated, args: ['-c', 'cli_auth_credentials_store="file"', 'app-server', '--listen', 'stdio://'] };
}

class Accounts extends EventEmitter {
  constructor({ root, createMonitor, initialProfiles }) {
    super();
    Object.assign(this, { root, createMonitor });
    this.file = path.join(root, 'accounts.json');
    this.monitors = new Map();
    this.loginActive = null;
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
    monitor.client.on('notification', method => {
      if (method === 'account/login/completed' && this.loginActive === profile.id) { this.loginActive = null; this.publish(); }
    });
    monitor.client.on('disconnected', () => {
      if (this.loginActive === profile.id) { this.loginActive = null; this.publish(); }
    });
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
    if (!monitor) throw new Error('Unknown profile');
    if (this.loginActive && this.loginActive !== id) { const error = new Error('Login in progress'); error.code = 'loginBusy'; throw error; }
    if (this.loginActive === id) await this.cancelLogin(id);
    this.loginActive = id; this.publish();
    try { return await monitor.login(); }
    catch (error) { this.loginActive = null; this.publish(); throw error; }
  }
  async cancelLogin(id) {
    const monitor = this.monitors.get(id);
    if (!monitor || this.loginActive !== id) return;
    await monitor.cancelLogin(); this.loginActive = null; this.publish();
  }
  async remove(id) {
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
module.exports = { Accounts, clientOptions };
