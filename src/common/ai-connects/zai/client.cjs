'use strict';
const { contractError } = require('../contracts.cjs');
const { apiKey } = require('../api-key-credentials.cjs');

// The quota endpoint is used by Z.ai's official glm-plan-usage plugin.
const QUOTA_URL = 'https://api.z.ai/api/monitor/usage/quota/limit';
const KEY_URL = 'https://z.ai/manage-apikey/apikey-list';

class ZaiClient {
  constructor({ fetch = globalThis.fetch, timeoutMs = 15000 } = {}) { Object.assign(this, { fetch, timeoutMs }); }

  async quota(key, signal) {
    try {
      const response = await this.fetch(QUOTA_URL, {
        method: 'GET', redirect: 'error',
        headers: { Authorization: apiKey(key), Accept: 'application/json', 'Accept-Language': 'en-US,en' },
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(this.timeoutMs)])
      });
      if ([401, 403].includes(response.status)) throw contractError('invalidApiKey');
      if (!response.ok) throw contractError('quotaRefreshFailed');
      const body = await response.json();
      if ([401, 403].includes(body?.code)) throw contractError('invalidApiKey');
      if (body?.success === false && body.code === 500 && body.msg === '当前用户不存在coding plan') {
        throw contractError('codingPlanRequired');
      }
      if (body?.success !== true || body.code !== 200) throw contractError('quotaRefreshFailed');
      return body.data;
    } catch (error) {
      // Keep response bodies and transport errors out of IPC and diagnostics.
      const code = error?.code;
      throw contractError(['invalidApiKey', 'codingPlanRequired'].includes(code) ? code : 'quotaRefreshFailed');
    }
  }
}
module.exports = { ZaiClient, QUOTA_URL, KEY_URL };
