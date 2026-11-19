'use strict';
const providers = new Map([
  ['codex', { check: require('./codex.cjs'), failure: 'Could not read Codex limits. Check your connection and Codex sign-in.' }],
  ['deepseek', { check: require('./deepseek.cjs'), keyName: 'DEEPSEEK_API_KEY', failure: 'Could not read the DeepSeek balance. Check your connection and API key.' }],
  ['zai', { check: require('./zai.cjs'), keyName: 'ZAI_API_KEY', failure: 'Could not read Z.ai limits. Check your connection and API key.' }]
]);

async function run([provider, ...extra]) {
  const config = providers.get(provider);
  if (!config || extra.length) {
    console.error('Usage: npm run doctor -- <codex|deepseek|zai>');
    return 2;
  }
  const key = config.keyName && process.env[config.keyName]?.trim();
  if (config.keyName && !key) {
    console.error(`Set ${config.keyName} in the environment.`);
    return 2;
  }
  try {
    return await config.check(key);
  } catch (error) {
    // Provider errors can contain credentials or account data.
    if (error?.code === 'invalidApiKey') console.error('The provider rejected the API key.');
    else if (error?.code === 'codingPlanRequired') console.error('A Z.ai Coding Plan is required.');
    else console.error(config.failure);
    return 1;
  }
}

run(process.argv.slice(2)).then(code => { process.exitCode = code; });
