'use strict';
const { EventEmitter } = require('node:events');
const { AiController } = require('../ai-connects/ai-controller.cjs');
const { contractError, snapshot, diagnostic } = require('../ai-connects/contracts.cjs');
const { legacyBuckets } = require('../renderer/metrics.js');
class Monitor extends EventEmitter {
  constructor(controller) {
    super();
    if (!(controller instanceof AiController)) throw contractError();
    this.controller = controller;
    this.intervalMs = Number.isFinite(controller.pollIntervalMs) && controller.pollIntervalMs >= 1000 ? controller.pollIntervalMs : 60000;
    const initial = snapshot({ ...controller.state, providerId: controller.providerId, profileId: controller.profileId, displaySchema: controller.getDisplaySchema() });
    this.state = { ...initial, buckets: legacyBuckets(initial), interval: this.intervalMs / 1000, staleAfterMs: Math.max(90000, this.intervalMs * 1.5) };
    this.revision = 0;
    this.failures = 0; this.timer = null; this.inflight = null; this.stopped = false; this.rerunRequested = false; this.reconnecting = null;
    this.unsubscribe = controller.subscribe(next => { if (!this.stopped) this.adopt(next); });
    this.onRefreshRequested = () => {
      if (this.stopped) return;
      if (this.inflight) this.rerunRequested = true; else void this.refresh({ reload: false });
    };
    this.onLoginEnded = attempt => { if (!this.stopped) this.emit('login-ended', attempt); };
    this.onDiagnostic = info => { if (!this.stopped) this.emit('diagnostic', diagnostic(info)); };
    controller.on('refresh-requested', this.onRefreshRequested);
    controller.on('login-ended', this.onLoginEnded);
    controller.on('diagnostic', this.onDiagnostic);
  }
  get loginAttempt() { return this.controller.loginAttempt; }
  get loginTask() { return this.controller.loginTask; }
  get loginId() { return this.controller.loginId; }
  publish(patch) { Object.assign(this.state, patch); this.emit('state', this.state); }
  adopt(raw) {
    const next = snapshot({ ...raw, providerId: this.controller.providerId, profileId: this.controller.profileId });
    this.publish({ ...next, buckets: legacyBuckets(next), refreshing: Boolean(this.inflight) });
  }
  refresh(options) {
    if (this.stopped) return Promise.resolve(this.state);
    if (this.inflight) return this.inflight;
    const revision = this.revision;
    clearTimeout(this.timer);
    this.inflight = Promise.resolve().then(async () => {
      if (this.stopped) return this.state;
      this.publish({ refreshing: true });
      try {
        const next = await this.controller.refresh(options);
        if (!this.stopped && revision === this.revision) this.adopt(next);
      } catch (error) {
        this.onDiagnostic({ stage: 'refresh', code: error.code || error.name });
        if (!this.stopped && revision === this.revision) this.publish({ status: 'error', error: 'refreshFailed' });
      }
      if (!this.stopped && revision === this.revision) this.failures = this.state.status === 'error' ? Math.min(this.failures + 1, 4) : 0;
      return this.state;
    }).finally(() => {
      this.inflight = null;
      if (this.stopped) return;
      this.publish({ refreshing: false });
      if (this.rerunRequested) { this.rerunRequested = false; void this.refresh({ reload: false }); }
      else this.schedule();
    });
    return this.inflight;
  }
  schedule() {
    if (this.stopped) return;
    clearTimeout(this.timer);
    const delay = Math.min(Math.max(300000, this.intervalMs), this.intervalMs * 2 ** this.failures);
    this.publish({ interval: delay / 1000 });
    this.timer = setTimeout(() => void this.refresh(), delay);
  }
  reconnect() {
    if (this.stopped) return Promise.resolve(this.state);
    if (this.reconnecting) return this.reconnecting;
    if (this.controller.busy) return this.refresh();
    this.reconnecting = Promise.resolve().then(async () => {
      if (this.stopped) return this.state;
      if (this.controller.busy) return this.refresh();
      this.failures = 0;
      this.revision++;
      await this.controller.disconnect();
      if (this.inflight) await this.inflight;
      return this.refresh();
    }).finally(() => { this.reconnecting = null; });
    return this.reconnecting;
  }
  login(attempt) { return this.controller.signIn(attempt); }
  cancelLogin() { return this.controller.cancelSignIn(); }
  signOut() { return this.controller.signOut(); }
  isSignInUrlAllowed(url) { return this.controller.isSignInUrlAllowed(url); }
  select(id) { if (this.state.groups.some(group => group.id === id)) this.controller.publish({ selectedId: id }); }
  stop() {
    if (this.stopped) return;
    this.stopped = true; clearTimeout(this.timer); this.unsubscribe();
    this.controller.off('refresh-requested', this.onRefreshRequested);
    this.controller.off('login-ended', this.onLoginEnded);
    this.controller.off('diagnostic', this.onDiagnostic);
    this.controller.disconnect();
  }
}
module.exports = { Monitor };
