'use strict';
const { ApiKeyController } = require('../api-key-controller.cjs');
const { DeepSeekClient, KEY_URL } = require('./client.cjs');
const { normalizeBalance, displaySchema } = require('./balance.cjs');
const { DEEPSEEK_POLL_INTERVAL_MINUTES } = require('../../core/polling-defaults.cjs');

class DeepSeekController extends ApiKeyController {
  constructor({ profileId, credentials, client = new DeepSeekClient() } = {}) {
    super({ providerId: 'deepseek', profileId, credentials, credentialsUrl: KEY_URL,
      pollIntervalMs: DEEPSEEK_POLL_INTERVAL_MINUTES * 60000, refreshError: 'balanceRefreshFailed' });
    this.client = client;
  }
  getDisplaySchema(state = this.state) { return displaySchema(state); }
  async readSample(key, signal) { return normalizeBalance(await this.client.balance(key, signal)); }
}
module.exports = { DeepSeekController };
