'use strict';
const { AiController } = require('../ai-controller.cjs');
const { snapshot } = require('../contracts.cjs');
const { CodexClient } = require('./client.cjs');
const { findCodex } = require('./path.cjs');
const { normalizeLimits, groupsFromBuckets, displaySchema } = require('./limits.cjs');
const { CODEX_POLL_INTERVAL_MINUTES } = require('../../core/polling-defaults.cjs');

class CodexController extends AiController {
  constructor(client, { readOnly = false, refreshCredentials = !readOnly, reloadOnPoll = readOnly, preserveStartupSample = false, profileId = 'default' } = {}) {
    super({ providerId: 'codex', profileId, readOnly, pollIntervalMs: CODEX_POLL_INTERVAL_MINUTES * 60000 });
    this.client = client;
    Object.assign(this, { refreshCredentials, reloadOnPoll, preserveStartupSample, identifyingAccount: false, reloading: false });
    this.state = { ...this.state, capabilities: { signIn: !readOnly, cancelSignIn: !readOnly, signOut: !readOnly }, account: null, buckets: [], selectedId: 'codex', updatedAt: null, error: null, status: 'connecting', refreshing: false, interval: CODEX_POLL_INTERVAL_MINUTES * 60 };
    this.inflight = null;
    this.stopped = false;
    this.loginId = null;
    this.loginAttempt = null;
    this.loginTask = null;
    this.accountRevision = 0;
    this.credentialsGeneration = null;
    this.notificationListener = (method, params) => {
      if (this.stopped) return;
      if (method === 'account/rateLimits/updated') {
        const incoming = normalizeLimits(params);
        if (incoming.length && this.state.account && !this.identifyingAccount) {
          const merged = new Map(this.state.buckets.map(bucket => [bucket.id, bucket]));
          incoming.forEach(bucket => merged.set(bucket.id, bucket));
          this.publish({ buckets: [...merged.values()], updatedAt: Date.now() });
        }
      }
      if (method === 'account/updated') {
        // External profiles restart app-server on each poll. Its initial auth
        // notification only describes the loaded store; account/read below is
        // authoritative for identity changes. Keep the last sample until then.
        if (this.loadingExternalAccount && this.state.account && params.authMode === this.state.account.type) return;
        // Linux also retains its sample for unclassified startup announcements,
        // invalidating and retrying account/read before publishing new quotas.
        // Logout and notifications outside this handshake still clear immediately.
        const retainSample = this.preserveStartupSample && this.identifyingAccount && params.authMode !== null;
        this.accountRevision++;
        if (!retainSample) this.publish({ account: null, buckets: [], updatedAt: null });
        this.emit('refresh-requested');
      }
      if (method === 'account/login/completed') {
        const attempt = this.loginAttempt;
        if (!attempt || attempt.cancelled || typeof params.loginId !== 'string') return;
        // A response and notification may be parsed in the same stdout batch.
        if (attempt.phase === 'starting' && !attempt.loginId) {
          attempt.completions.set(params.loginId, params);
          if (attempt.completions.size > 16) attempt.completions.delete(attempt.completions.keys().next().value);
        }
        else this.completeLogin(attempt, params);
      }
    };
    this.disconnectedListener = () => {
      if (this.loginAttempt) {
        this.loginAttempt.cancelled = true;
        this.finishLogin(this.loginAttempt);
      }
      this.loginId = null;
      if (!this.stopped && !this.reloading) this.publish({ status: 'error', error: 'disconnected' });
    };
    this.listen();
  }

  publish(patch) {
    if (patch.buckets) { patch = { ...patch, groups: groupsFromBuckets(patch.buckets) }; delete patch.buckets; }
    return super.publish(patch);
  }

  listen() {
    if (this.listening) return;
    this.listening = true;
    this.client.on('notification', this.notificationListener);
    this.client.on('disconnected', this.disconnectedListener);
  }
  async connect() { this.stopped = false; this.listen(); await this.client.start(); }
  async checkAccess() {
    await this.connect();
    const generation = this.client.generation ?? 0;
    const result = await this.client.request('account/read', { refreshToken: this.refreshCredentials && this.credentialsGeneration !== generation });
    this.credentialsGeneration = generation;
    const account = snapshot({ account: result.account }).account;
    return { account, status: !account ? 'signed-out' : account.type === 'chatgpt' ? 'ready' : 'unsupported', capabilities: this.state.capabilities };
  }
  getDisplaySchema(state = this.state) { return displaySchema(state); }
  isSignInUrlAllowed(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && ['auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com'].includes(url.hostname); }
    catch { return false; }
  }
  refresh({ reload = true } = {}) {
    if (this.inflight) return this.inflight;
    this.stopped = false;
    this.inflight = Promise.resolve().then(() => this.stopped ? this.state : this.read(reload)).finally(() => { this.inflight = null; });
    return this.inflight;
  }

  async read(reload = true) {
    const revision = this.accountRevision;
    let stage = 'connect';
    this.publish({ refreshing: true });
    try {
      if (this.reloadOnPoll && reload) {
        this.reloading = true;
        try { this.client.stop(); } finally { this.reloading = false; }
      }
      this.loadingExternalAccount = this.reloadOnPoll;
      this.identifyingAccount = true;
      let account;
      try {
        stage = 'access';
        ({ account } = await this.checkAccess());
      } finally { this.loadingExternalAccount = false; this.identifyingAccount = false; }
      if (revision !== this.accountRevision || this.stopped) return this.state;
      if (!account) {
        this.publish({ account: null, buckets: [], updatedAt: null, status: this.loginId ? 'signing-in' : 'signed-out', error: null });
        return this.state;
      }
      // Account switches must never keep the previous account's percentages.
      if (JSON.stringify(account) !== JSON.stringify(this.state.account)) this.publish({ account, buckets: [], updatedAt: null });
      if (account.type !== 'chatgpt') {
        this.publish({ account, buckets: [], updatedAt: null, status: 'unsupported', error: null });
        return this.state;
      }
      stage = 'refresh';
      const result = await this.client.request('account/rateLimits/read');
      if (revision !== this.accountRevision || this.stopped) return this.state;
      this.publish({ account, buckets: normalizeLimits(result), updatedAt: Date.now(), status: 'ready', error: null });
    } catch (error) {
      if (revision !== this.accountRevision || this.stopped) return this.state;
      this.emit('diagnostic', { stage, code: error.code || error.name });
      // RPC errors can leave a live server holding expired or externally rotated
      // credentials. The next backed-off poll must reconnect and reload its store.
      this.credentialsGeneration = null;
      if (!this.loginAttempt && !this.loginTask) this.client.stop();
      this.publish({ status: 'error', error: 'refreshFailed' });
    } finally { this.publish({ refreshing: false }); }
    return this.state;
  }

  signIn(attempt = { cancelled: false, phase: 'preparing' }) {
    if (this.readOnly) return Promise.reject(Object.assign(new Error('Login unavailable'), { code: 'loginUnavailable' }));
    if (this.loginAttempt || this.loginTask) return Promise.reject(Object.assign(new Error('Login in progress'), { code: 'loginBusy' }));
    this.loginAttempt = attempt;
    const task = this.startLogin(attempt);
    this.loginTask = task;
    return task.finally(() => { if (this.loginTask === task) this.loginTask = null; });
  }

  async startLogin(attempt) {
    const current = () => !this.stopped && !attempt.cancelled && this.loginAttempt === attempt;
    try {
      await this.refresh();
      if (!current()) return null;
      await this.client.start();
      if (!current()) return null;
      attempt.phase = 'starting';
      attempt.generation = this.client.generation;
      attempt.completions = new Map();
      const result = await this.client.request('account/login/start', { type: 'chatgpt' });
      if (!current()) {
        if (attempt.cancelled && result.loginId) await this.cancelRemoteLogin(result.loginId, attempt.generation);
        return null;
      }
      if (typeof result.loginId !== 'string' || !result.loginId || typeof result.authUrl !== 'string') throw new Error('Invalid login response');
      attempt.loginId = result.loginId; attempt.phase = 'active';
      this.loginId = result.loginId;
      this.publish({ status: 'signing-in', error: null });
      const completion = attempt.completions.get(result.loginId);
      attempt.completions.clear();
      if (completion) this.completeLogin(attempt, completion);
      return current() ? result.authUrl : null;
    } catch (error) {
      this.finishLogin(attempt);
      if (attempt.cancelled) return null;
      throw error;
    } finally {
      if (!current()) this.finishLogin(attempt);
    }
  }

  completeLogin(attempt, params) {
    if (params.loginId !== attempt.loginId || this.loginAttempt !== attempt) return;
    this.finishLogin(attempt);
    if (params.success) this.emit('refresh-requested');
    else this.publish({ status: 'error', error: 'loginIncomplete' });
  }

  finishLogin(attempt) {
    if (this.loginAttempt !== attempt) return;
    this.loginAttempt = null; this.loginId = null;
    this.emit('login-ended', attempt);
  }

  async cancelRemoteLogin(loginId, generation) {
    if (this.client.generation !== generation) return;
    try { await this.client.request('account/login/cancel', { loginId }); }
    catch (error) {
      if (this.client.generation === generation) this.client.stop();
      throw error;
    }
  }

  async cancelSignIn() {
    const attempt = this.loginAttempt;
    if (!attempt) return;
    attempt.cancelled = true; attempt.phase = 'cancelling';
    const loginId = this.loginId;
    const task = this.loginTask;
    this.loginId = null;
    this.publish({ status: this.state.account ? 'ready' : 'signed-out', error: null });
    try {
      if (loginId) await this.cancelRemoteLogin(loginId, attempt.generation);
      if (task) await task;
    } finally { this.finishLogin(attempt); }
  }

  async signOut() {
    if (this.readOnly) throw Object.assign(new Error('Read-only profile'), { code: 'accountActionFailed' });
    await this.cancelSignIn(); await this.connect(); await this.client.request('account/logout');
    this.accountRevision++;
    this.publish({ account: null, buckets: [], updatedAt: null, status: 'signed-out', error: null });
  }

  disconnect() {
    this.stopped = true; this.accountRevision++; this.credentialsGeneration = null;
    this.client.off('notification', this.notificationListener);
    this.client.off('disconnected', this.disconnectedListener);
    this.listening = false;
    if (this.loginAttempt) { this.loginAttempt.cancelled = true; this.finishLogin(this.loginAttempt); }
    this.client.stop();
  }
}

function createController(options = {}) {
  const client = options.client || new CodexClient(options.binary || findCodex({ resourcesPath: options.resourcesPath }), options);
  return new CodexController(client, options);
}
module.exports = { CodexController, createController };
