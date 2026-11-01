'use strict';
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isStale } = require('./limits.cjs');
const { registry: defaultRegistry } = require('./ai-connects/registry.cjs');
const { Monitor } = require('./monitor.cjs');
const { contractError } = require('./ai-connects/contracts.cjs');

const nickname = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80) : '';
class Accounts extends EventEmitter {
  constructor({ root, createMonitor, initialProfiles, registry = defaultRegistry, controllerContext = () => ({}) }) {
    super();
    Object.assign(this, { root, registry, controllerContext });
    this.createMonitor = createMonitor || ((profile, options) => new Monitor(registry.create(profile.providerId, options)));
    this.file = path.join(root, 'accounts.json');
    this.monitors = new Map();
    this.loginActive = null;
    this.loginAttempt = null;
    this.keyConnection = null;
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
    }).map(profile => ({ id: profile.id, nickname: nickname(profile.nickname), providerId: typeof profile.providerId === 'string' ? profile.providerId : 'codex' }));
    if (!this.profiles.some(profile => profile.id === 'default')) this.profiles.unshift({ id: 'default', nickname: '', providerId: 'codex' });
    this.selectedProfileId = this.profiles.some(profile => profile.id === saved?.selectedProfileId) ? saved.selectedProfileId : this.profiles[0].id;
    this.profiles.forEach(profile => this.attach(profile));
  }
  attach(profile, controller) {
    if (profile.id !== 'default') fs.mkdirSync(path.join(this.root, 'accounts', profile.id), { recursive: true });
    const options = this.registry.optionsFor(profile.providerId, { root: this.root, profile, ...this.controllerContext(profile) });
    const monitor = controller ? new Monitor(controller) : this.registry.has(profile.providerId) ? this.createMonitor(profile, options)
      : new Monitor(this.registry.create(profile.providerId, { profileId: profile.id }));
    this.monitors.set(profile.id, monitor);
    monitor.on('state', () => this.publish());
    monitor.on('diagnostic', info => this.emit('diagnostic', { ...info, profileId: profile.id }));
    monitor.on('login-ended', attempt => this.finishLogin(attempt));
    return monitor;
  }
  snapshot() {
    const profiles = this.profiles.map(profile => {
      const state = this.monitors.get(profile.id).state;
      return { ...state, providerId: profile.providerId, id: profile.id, nickname: profile.nickname,
        displayName: profile.nickname || state.account?.email || (state.account || state.capabilities?.apiKey ? this.registry.providers.get(profile.providerId)?.name || '' : ''), stale: isStale(state) };
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
    const pending = this.keyConnection;
    return { ...selected, profiles, providers: this.registry.list(), selectedProfileId: this.selectedProfileId, loginProfileId: this.loginActive,
      keyConnection: pending ? { id: pending.id, providerId: pending.profile.providerId, profileId: pending.existing ? pending.profile.id : null,
        name: this.registry.providers.get(pending.profile.providerId).name, phase: pending.phase } : null };
  }
  publish() { this.emit('state', this.snapshot()); }
  persist() {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ version: 1, profiles: this.profiles, selectedProfileId: this.selectedProfileId }));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  async refresh({ reconnect = false } = {}) {
    await Promise.all([...this.monitors.values()].map(async monitor => {
      if (reconnect && monitor.reconnect) await monitor.reconnect();
      else await monitor.refresh();
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
  add(providerId = 'codex') {
    if (!this.registry.has(providerId)) throw new Error('Unknown provider');
    const profile = { id: randomUUID(), nickname: '', providerId };
    this.attach(profile); this.profiles.push(profile); this.persist(); this.publish();
    return profile.id;
  }
  beginKeyConnection(providerId, profileId) {
    if (this.loginActive || this.keyConnection) throw contractError('loginBusy');
    if (this.registry.providers.get(providerId)?.authentication !== 'api-key') throw contractError('loginUnavailable');
    const existing = profileId !== undefined;
    const profile = existing ? this.profiles.find(item => item.id === profileId && item.providerId === providerId) : { id: randomUUID(), nickname: '', providerId };
    if (!profile || this.removing.has(profile.id)) throw contractError('accountActionFailed');
    const options = this.registry.optionsFor(providerId, { root: this.root, profile, ...this.controllerContext(profile) });
    const controller = this.registry.create(providerId, options);
    if (!controller.state.capabilities.apiKey) { controller.disconnect(); throw contractError('loginUnavailable'); }
    this.keyConnection = { id: randomUUID(), profile, controller, existing, phase: 'waiting' };
    this.publish();
    return this.snapshot().keyConnection;
  }
  credentialsUrl(id) {
    return this.keyConnection?.id === id ? this.keyConnection.controller.getCredentialsUrl() : null;
  }
  async submitKeyConnection(id, key) {
    const pending = this.keyConnection;
    if (!pending || pending.id !== id) throw contractError('loginIncomplete');
    if (pending.phase === 'checking') throw contractError('loginBusy');
    pending.phase = 'checking'; this.publish();
    try {
      await pending.controller.authenticate(key);
      if (this.keyConnection !== pending) throw contractError('loginIncomplete');
      pending.controller.saveCredentials();
      if (!pending.existing) {
        this.profiles.push(pending.profile);
        try { this.persist(); }
        catch {
          this.profiles = this.profiles.filter(profile => profile.id !== pending.profile.id);
          await pending.controller.signOut();
          throw contractError('accountActionFailed');
        }
      } else this.monitors.get(pending.profile.id)?.stop();
      const monitor = this.attach(pending.profile, pending.controller);
      this.keyConnection = null;
      monitor.schedule(); this.publish();
      return pending.profile.id;
    } catch (error) {
      if (this.keyConnection === pending) { pending.phase = 'waiting'; this.publish(); }
      throw error;
    }
  }
  cancelKeyConnection(id) {
    if (this.keyConnection?.id !== id) return;
    const pending = this.keyConnection;
    this.keyConnection = null; pending.controller.disconnect(); this.publish();
  }
  async login(id = this.selectedProfileId) {
    const monitor = this.monitors.get(id);
    if (!monitor || this.removing.has(id)) throw new Error('Unknown profile');
    const busy = () => { const error = new Error('Login in progress'); error.code = 'loginBusy'; throw error; };
    if (this.keyConnection) busy();
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
    if (id === 'default') throw new Error('The default source cannot be removed');
    const monitor = this.monitors.get(id);
    if (!monitor) return;
    if (this.keyConnection?.profile.id === id) this.cancelKeyConnection(this.keyConnection.id);
    await this.cancelLogin(id);
    if (monitor.state.capabilities?.signOut !== false) await monitor.signOut();
    monitor.stop(); this.monitors.delete(id);
    this.profiles = this.profiles.filter(profile => profile.id !== id);
    if (this.selectedProfileId === id) this.selectedProfileId = this.profiles[0].id;
    this.persist(); this.publish();
  }
  stop() { if (this.keyConnection) this.cancelKeyConnection(this.keyConnection.id); this.monitors.forEach(monitor => monitor.stop()); }
  isSignInUrlAllowed(id, url) { return this.monitors.get(id)?.isSignInUrlAllowed(url) === true; }
}
module.exports = { Accounts };
