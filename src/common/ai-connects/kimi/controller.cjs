'use strict';
const { ApiKeyController } = require('../api-key-controller.cjs');
const { apiKey } = require('../api-key-credentials.cjs');
const { contractError } = require('../contracts.cjs');
const { displaySchema } = require('../quota-display.cjs');
const { normalizeQuota } = require('./quota.cjs');

const USAGE_URL = 'https://api.kimi.ai/coding/v1/usages';
const KEY_URL = 'https://www.kimi.com/code/console';

class KimiController extends ApiKeyController {
  constructor({ profileId, credentials, fetch = globalThis.fetch } = {}) {
    super({ providerId: 'kimi', profileId, credentials, credentialsUrl: KEY_URL, refreshError: 'kimiQuotaRefreshFailed' });
    this.fetch = fetch;
  }

  getDisplaySchema(state = this.state) { return displaySchema(state); }

  async readSample(key, signal) {
    try {
      const response = await this.fetch(USAGE_URL, {
        method: 'GET',
        redirect: 'error',
        headers: { Authorization: `Bearer ${apiKey(key)}`, Accept: 'application/json', 'User-Agent': 'Limits' },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
      });
      if (response.status === 401) throw contractError('invalidApiKey');
      if (!response.ok) throw contractError('kimiQuotaRefreshFailed');
      return normalizeQuota(await response.json());
    } catch (error) {
      throw contractError(error?.code === 'invalidApiKey' ? 'invalidApiKey' : 'kimiQuotaRefreshFailed');
    }
  }
}

module.exports = { KimiController, USAGE_URL, KEY_URL };
