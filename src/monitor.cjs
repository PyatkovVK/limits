'use strict';
const { EventEmitter } = require('node:events');
const { normalizeLimits } = require('./limits.cjs');

class Monitor extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.state = { account: null, buckets: [], selectedId: 'codex', updatedAt: null, error: null, status: 'connecting', refreshing: false, interval: 30 };
    this.failures = 0;
    this.timer = null;
    this.inflight = null;
    this.stopped = false;
    this.loginId = null;
    this.accountRevision = 0;
    this.rerunRequested = false;
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
        // Clear old-account data immediately, including when an external logout is observed.
        this.accountRevision++;
        this.publish({ account: null, buckets: [], updatedAt: null });
        this.rerunRequested = Boolean(this.inflight);
        void this.refresh();
      }
      if (method === 'account/login/completed') {
        this.loginId = null;
        if (params.success) { this.rerunRequested = Boolean(this.inflight); void this.refresh(); }
        else this.publish({ status: 'error', error: 'loginIncomplete' });
      }
    });
    client.on('disconnected', () => {
      if (!this.stopped) this.publish({ status: 'error', error: 'disconnected' });
    });
  }

  publish(patch) {
    Object.assign(this.state, patch);
    this.emit('state', this.state);
  }

  refresh() {
    if (this.stopped) return Promise.resolve(this.state);
    if (this.inflight) return this.inflight;
    clearTimeout(this.timer);
    this.inflight = this.read().finally(() => {
      this.inflight = null;
      const delay = Math.min(300000, 30000 * 2 ** this.failures);
      this.publish({ interval: delay / 1000 });
      if (!this.stopped) {
        if (this.rerunRequested) { this.rerunRequested = false; void this.refresh(); }
        else this.timer = setTimeout(() => void this.refresh(), delay);
      }
    });
    return this.inflight;
  }

  async read() {
    const revision = this.accountRevision;
    let stage = 'start';
    this.publish({ refreshing: true });
    try {
      await this.client.start();
      stage = 'account/read';
      const { account } = await this.client.request('account/read', { refreshToken: false });
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
      this.emit('diagnostic', { stage, code: error.code || error.name });
      this.failures = Math.min(this.failures + 1, 4);
      this.publish({ status: 'error', error: 'refreshFailed' });
    } finally { this.publish({ refreshing: false }); }
    return this.state;
  }

  async login() {
    await this.refresh();
    await this.client.start();
    if (this.loginId) await this.client.request('account/login/cancel', { loginId: this.loginId });
    const result = await this.client.request('account/login/start', { type: 'chatgpt' });
    this.loginId = result.loginId;
    this.publish({ status: 'signing-in', error: null });
    return result.authUrl;
  }

  select(id) {
    if (this.state.buckets.some(bucket => bucket.id === id)) this.publish({ selectedId: id });
  }

  async cancelLogin() {
    if (this.loginId) await this.client.request('account/login/cancel', { loginId: this.loginId });
    this.loginId = null;
    this.publish({ status: this.state.account ? 'ready' : 'signed-out', error: null });
  }

  stop() { this.stopped = true; clearTimeout(this.timer); this.client.stop(); }
}

module.exports = { Monitor };
