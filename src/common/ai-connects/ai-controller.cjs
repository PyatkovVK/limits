'use strict';
const { EventEmitter } = require('node:events');
const { snapshot, contractError } = require('./contracts.cjs');
const { legacyBuckets } = require('../renderer/metrics.js');

class AiController extends EventEmitter {
  constructor({ providerId, profileId = 'default', readOnly = false, pollIntervalMs = 60000 } = {}) {
    super();
    if (new.target === AiController) throw contractError();
    for (const method of ['connect', 'checkAccess', 'refresh', 'getDisplaySchema', 'disconnect']) {
      if (this[method] === AiController.prototype[method]) throw contractError();
    }
    Object.assign(this, { providerId, profileId, readOnly, pollIntervalMs });
    this.state = snapshot({ providerId, profileId, status: 'connecting' });
    this.state.buckets = [];
  }
  publish(patch) {
    const next = snapshot({ ...this.state, ...patch, providerId: this.providerId, profileId: this.profileId });
    next.displaySchema = snapshot({ displaySchema: this.getDisplaySchema(next) }).displaySchema;
    next.buckets = legacyBuckets(next);
    this.state = next;
    this.emit('state', next);
    return next;
  }
  subscribe(listener) { this.on('state', listener); return () => this.off('state', listener); }
  connect() { throw contractError(); }
  checkAccess() { throw contractError(); }
  refresh() { throw contractError(); }
  getDisplaySchema() { throw contractError(); }
  disconnect() { throw contractError(); }
  signIn() { return Promise.reject(contractError('loginUnavailable')); }
  cancelSignIn() { return Promise.resolve(); }
  signOut() { return Promise.reject(contractError('accountActionFailed')); }
  authenticate() { return Promise.reject(contractError('loginUnavailable')); }
  saveCredentials() { throw contractError('loginUnavailable'); }
  getCredentialsUrl() { return null; }
  isSignInUrlAllowed() { return false; }
  get busy() { return Boolean(this.loginAttempt || this.loginTask); }
}
module.exports = { AiController };
