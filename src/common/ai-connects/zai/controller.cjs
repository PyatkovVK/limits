'use strict';
const { ApiKeyController } = require('../api-key-controller.cjs');
const { displaySchema } = require('../quota-display.cjs');
const { ZAI_POLL_INTERVAL_MINUTES } = require('../../polling-defaults.cjs');
const { ZaiClient, KEY_URL } = require('./client.cjs');
const { normalizeQuota } = require('./quota.cjs');

class ZaiController extends ApiKeyController {
  constructor({ profileId, credentials, client = new ZaiClient() } = {}) {
    super({ providerId: 'zai', profileId, credentials, credentialsUrl: KEY_URL, pollIntervalMs: ZAI_POLL_INTERVAL_MINUTES * 60000,
      refreshError: 'quotaRefreshFailed', accessError: 'codingPlanRequired' });
    this.client = client;
  }
  getDisplaySchema(state = this.state) { return displaySchema(state); }
  async readSample(key, signal) { return normalizeQuota(await this.client.quota(key, signal)); }
}
module.exports = { ZaiController };
