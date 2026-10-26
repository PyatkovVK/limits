'use strict';
const { EventEmitter } = require('node:events');
const { normalizeLimits } = require('./limits.cjs');

class Monitor extends EventEmitter {
  constructor(client, { refreshCredentials = true, reloadOnPoll = false } = {}) {
    super();
    this.client = client;
    Object.assign(this, { refreshCredentials, reloadOnPoll, reloading: false });
    this.state = { account: null, buckets: [], selectedId: 'codex', updatedAt: null, error: null, status: 'connecting', refreshing: false, interval: 30 };
    this.failures = 0;
    this.timer = null;
    this.inflight = null;
    this.stopped = false;
    this.loginId = null;
    this.loginAttempt = null;
    this.loginTask = null;
    this.accountRevision = 0;
    this.rerunRequested = false;
    this.credentialsGeneration = null;
    this.reconnecting = null;
    client.on('notification', (method, params) => {
      if (this.stopped) return;
      if (method === 'account/rateLimits/updated') {
        const incoming = normalizeLimits(params);
        if (incoming.length) {
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
        // Clear old-account data immediately, including when an external logout is observed.
        this.accountRevision++;
        this.publish({ account: null, buckets: [], updatedAt: null });
        this.rerunRequested = Boolean(this.inflight);
        void this.refresh();
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
    });
    client.on('disconnected', () => {
      if (this.loginAttempt) {
        this.loginAttempt.cancelled = true;
        this.finishLogin(this.loginAttempt);
      }
      this.loginId = null;
      if (!this.stopped && !this.reconnecting && !this.reloading) this.publish({ status: 'error', error: 'disconnected' });
    });
  }

  publish(patch) {
    Object.assign(this.state, patch);
    this.emit('state', this.state);
  }

  refresh({ reload = true } = {}) {
    if (this.stopped) return Promise.resolve(this.state);
    if (this.inflight) return this.inflight;
    clearTimeout(this.timer);
    // Publish the lock before read() can receive a synchronous account event.
    this.inflight = Promise.resolve().then(() => this.stopped ? this.state : this.read(reload)).finally(() => {
      this.inflight = null;
      const delay = Math.min(300000, 30000 * 2 ** this.failures);
      this.publish({ interval: delay / 1000 });
      if (!this.stopped) {
        if (this.rerunRequested) { this.rerunRequested = false; void this.refresh({ reload: false }); }
        else this.timer = setTimeout(() => void this.refresh(), delay);
      }
    });
    return this.inflight;
  }

  reconnect() {
    if (this.stopped) return Promise.resolve(this.state);
    if (this.reconnecting) return this.reconnecting;
    // Do not interrupt a browser sign-in or its cancellation RPC.
    if (this.loginAttempt || this.loginTask) return this.refresh();
    const task = Promise.resolve().then(async () => {
      if (this.stopped) return this.state;
      if (this.loginAttempt || this.loginTask) return this.refresh();
      this.accountRevision++;
      this.credentialsGeneration = null;
      this.failures = 0;
      // Abort requests left pending across suspend before starting a fresh poll.
      this.client.stop();
      if (this.inflight) await this.inflight;
      return this.refresh();
    });
    this.reconnecting = task.finally(() => { this.reconnecting = null; });
    return this.reconnecting;
  }

  async read(reload = true) {
    const revision = this.accountRevision;
    let stage = 'start';
    this.publish({ refreshing: true });
    try {
      if (this.reloadOnPoll && reload) {
        this.reloading = true;
        try { this.client.stop(); } finally { this.reloading = false; }
      }
      this.loadingExternalAccount = this.reloadOnPoll;
      let account, generation;
      try {
        await this.client.start();
        stage = 'account/read';
        generation = this.client.generation ?? 0;
        // Our own app-server refreshes stored credentials on every connection.
        // Routine polls leave automatic token maintenance to that same process.
        ({ account } = await this.client.request('account/read', { refreshToken: this.refreshCredentials && this.credentialsGeneration !== generation }));
      } finally { this.loadingExternalAccount = false; }
      this.credentialsGeneration = generation;
      if (revision !== this.accountRevision || this.stopped) return this.state;
      if (!account) {
        this.failures = 0;
        this.publish({ account: null, buckets: [], updatedAt: null, status: this.loginId ? 'signing-in' : 'signed-out', error: null });
        return this.state;
      }
      // Account switches must never keep the previous account's percentages.
      if (JSON.stringify(account) !== JSON.stringify(this.state.account)) this.publish({ account, buckets: [], updatedAt: null });
      if (account.type !== 'chatgpt') {
        this.publish({ account, buckets: [], updatedAt: null, status: 'unsupported', error: null });
        return this.state;
      }
      stage = 'account/rateLimits/read';
      const result = await this.client.request(stage);
      if (revision !== this.accountRevision || this.stopped) return this.state;
      this.failures = 0;
      this.publish({ account, buckets: normalizeLimits(result), updatedAt: Date.now(), status: 'ready', error: null });
    } catch (error) {
      if (revision !== this.accountRevision || this.stopped) return this.state;
      this.emit('diagnostic', { stage, code: error.code || error.name });
      // RPC errors can leave a live server holding expired or externally rotated
      // credentials. The next backed-off poll must reconnect and reload its store.
      this.credentialsGeneration = null;
      if (!this.loginAttempt && !this.loginTask) this.client.stop();
      this.failures = Math.min(this.failures + 1, 4);
      this.publish({ status: 'error', error: 'refreshFailed' });
    } finally { this.publish({ refreshing: false }); }
    return this.state;
  }

  login(attempt = { cancelled: false, phase: 'preparing' }) {
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
    if (params.success) { this.rerunRequested = Boolean(this.inflight); void this.refresh(); }
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

  select(id) {
    if (this.state.buckets.some(bucket => bucket.id === id)) this.publish({ selectedId: id });
  }

  async cancelLogin() {
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

  stop() {
    this.stopped = true; clearTimeout(this.timer);
    if (this.loginAttempt) { this.loginAttempt.cancelled = true; this.finishLogin(this.loginAttempt); }
    this.client.stop();
  }
}

module.exports = { Monitor };
