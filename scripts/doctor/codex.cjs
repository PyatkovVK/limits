'use strict';
const { findCodex } = require('../../src/common/ai-connects/codex/path.cjs');
const { CodexClient } = require('../../src/common/ai-connects/codex/client.cjs');
const { normalizeLimits } = require('../../src/common/ai-connects/codex/limits.cjs');

async function checkCodex() {
  const platformFinders = process.platform === 'linux' ? { linux: require('../../src/linux_feature/ai-connects/codex/path.cjs').findLinuxCodex }
    : process.platform === 'darwin' ? { darwin: require('../../src/apple_feature/ai-connects/codex/path.cjs').findMacCodex } : {};
  const binary = findCodex({ platformFinders });
  console.log('Codex executable:', binary);
  const client = new CodexClient(binary);
  try {
    await client.start();
    const { account } = await client.request('account/read', { refreshToken: false });
    console.log('Authentication:', account?.type || 'signed-out');
    if (account?.type !== 'chatgpt') {
      console.log('Sign in through ChatGPT to read subscription limits.');
      return 2;
    }
    const buckets = normalizeLimits(await client.request('account/rateLimits/read'));
    console.log(JSON.stringify({ plan: account.planType, buckets }, null, 2));
    return buckets.length ? 0 : 2;
  } finally { client.stop(); }
}

module.exports = checkCodex;
