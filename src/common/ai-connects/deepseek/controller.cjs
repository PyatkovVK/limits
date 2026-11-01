'use strict';
const { AiController } = require('../ai-controller.cjs');
const { contractError } = require('../contracts.cjs');
const { DeepSeekClient, apiKey, KEY_URL } = require('./client.cjs');
const { normalizeBalance, displaySchema } = require('./balance.cjs');
const { DEEPSEEK_POLL_INTERVAL_MINUTES } = require('../../polling-defaults.cjs');

class DeepSeekController extends AiController {
  constructor({ profileId, credentials, client = new DeepSeekClient() } = {}) {
    super({ providerId: 'deepseek', profileId, pollIntervalMs: DEEPSEEK_POLL_INTERVAL_MINUTES * 60000 });
    Object.assign(this, { credentials, client, generation: 0, key: null, stopped: false, inflight: null });
    this.publish({ status: 'signed-out', capabilities: { apiKey: true, signOut: true } });
  }
  getDisplaySchema(state = this.state) { return displaySchema(state); }
  getCredentialsUrl() { return KEY_URL; }
  async connect() {
    this.stopped = false;
    if (!this.key) this.key = this.credentials.read();
  }
  async checkAccess() {
    await this.connect();
    if (!this.key) return { account: null, status: 'signed-out', capabilities: this.state.capabilities };
    this.abort = new AbortController();
    const sample = normalizeBalance(await this.client.balance(this.key, this.abort.signal));
    return { ...sample, account: { type: 'api-key', id: this.profileId }, status: 'ready', capabilities: this.state.capabilities };
  }
  async authenticate(value) {
    const key = apiKey(value), generation = this.generation;
    this.stopped = false;
    this.abort?.abort(); this.abort = new AbortController();
    const sample = normalizeBalance(await this.client.balance(key, this.abort.signal));
    if (this.stopped || generation !== this.generation) throw contractError('loginIncomplete');
    this.key = key;
    return this.publish({ ...sample, account: { type: 'api-key', id: this.profileId }, selectedId: sample.groups[0]?.id,
      updatedAt: Date.now(), status: 'ready', error: null });
  }
  saveCredentials() { this.credentials.write(this.key); }
  refresh() {
    if (this.inflight) return this.inflight;
    const generation = this.generation;
    this.inflight = this.read(generation).finally(() => { this.inflight = null; });
    return this.inflight;
  }
  async read(generation) {
    this.publish({ refreshing: true });
    try {
      const { account, ...sample } = await this.checkAccess();
      if (this.stopped || generation !== this.generation) return this.state;
      if (!account) return this.publish({ account: null, groups: [], accountAvailable: null, updatedAt: null, status: 'signed-out', error: null });
      this.publish({ ...sample, account, selectedId: sample.groups.some(group => group.id === this.state.selectedId) ? this.state.selectedId : sample.groups[0]?.id,
        updatedAt: Date.now(), status: 'ready', error: null });
    } catch (error) {
      if (this.stopped || generation !== this.generation) return this.state;
      const code = ['invalidApiKey', 'credentialStorageUnavailable'].includes(error.code) ? error.code : 'balanceRefreshFailed';
      this.emit('diagnostic', { stage: 'refresh', code });
      this.publish(code === 'invalidApiKey' ? { account: null, groups: [], accountAvailable: null, updatedAt: null, status: 'signed-out', error: code } : { status: 'error', error: code });
    } finally { if (!this.stopped && generation === this.generation) this.publish({ refreshing: false }); }
    return this.state;
  }
  async signOut() {
    this.credentials.clear(); this.disconnect();
    this.publish({ account: null, groups: [], accountAvailable: null, updatedAt: null, status: 'signed-out', error: null });
  }
  disconnect() { this.stopped = true; this.generation++; this.abort?.abort(); this.key = null; }
}
module.exports = { DeepSeekController };
