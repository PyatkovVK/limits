'use strict';
const { ZaiClient } = require('../../src/common/ai-connects/zai/client.cjs');
const { normalizeQuota } = require('../../src/common/ai-connects/zai/quota.cjs');

module.exports = async function checkZai(key) {
  const quota = normalizeQuota(await new ZaiClient().quota(key));
  console.log(JSON.stringify(quota, null, 2));
  return 0;
};
