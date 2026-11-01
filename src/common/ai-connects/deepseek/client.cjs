'use strict';
const { contractError } = require('../contracts.cjs');

const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const KEY_URL = 'https://platform.deepseek.com/api_keys';
function apiKey(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192 || /[\x00-\x20\x7f]/.test(value.trim())) throw contractError('invalidApiKey');
  return value.trim();
}
class DeepSeekClient {
  constructor({ fetch = globalThis.fetch, timeoutMs = 15000 } = {}) { Object.assign(this, { fetch, timeoutMs }); }
  async balance(key, signal) {
    try {
      const response = await this.fetch(BALANCE_URL, { method: 'GET', redirect: 'error',
        headers: { Authorization: `Bearer ${apiKey(key)}`, Accept: 'application/json' },
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(this.timeoutMs)]) });
      if (response.status === 401 || response.status === 403) throw contractError('invalidApiKey');
      if (!response.ok) throw contractError('balanceRefreshFailed');
      return await response.json();
    } catch (error) {
      // Neither server error bodies nor transport errors may expose credentials.
      throw contractError(error.code === 'invalidApiKey' ? 'invalidApiKey' : 'balanceRefreshFailed');
    }
  }
}
module.exports = { DeepSeekClient, apiKey, BALANCE_URL, KEY_URL };
