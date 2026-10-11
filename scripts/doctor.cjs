'use strict';
const { findCodex } = require('../src/common/codex-path.cjs');
const { CodexClient } = require('../src/common/codex-client.cjs');
const { normalizeLimits } = require('../src/common/limits.cjs');

(async () => {
  let client;
  try {
    const binary = findCodex();
    console.log('Codex executable:', binary);
    client = new CodexClient(binary);
    await client.start();
    const { account } = await client.request('account/read', { refreshToken: false });
    console.log('Authentication:', account?.type || 'signed-out');
    if (account?.type !== 'chatgpt') { console.log('Sign in through ChatGPT to read subscription limits.'); process.exitCode = 2; return; }
    const buckets = normalizeLimits(await client.request('account/rateLimits/read'));
    console.log(JSON.stringify({ plan: account.planType, buckets }, null, 2));
    if (!buckets.length) process.exitCode = 2;
  } catch (error) {
    // Do not print raw RPC errors or auth payloads.
    console.error('Could not read Codex limits. Check your connection and Codex sign-in.');
    process.exitCode = 1;
  } finally { client?.stop(); }
})();
