'use strict';
const { DeepSeekClient } = require('../../src/common/ai-connects/deepseek/client.cjs');
const { normalizeBalance } = require('../../src/common/ai-connects/deepseek/balance.cjs');

module.exports = async function checkDeepSeek(key) {
  const balance = normalizeBalance(await new DeepSeekClient().balance(key));
  console.log(JSON.stringify(balance, null, 2));
  return 0;
};
