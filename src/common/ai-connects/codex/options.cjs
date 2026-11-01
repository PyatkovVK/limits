'use strict';
const path = require('node:path');
const AUTH_ENV_VARIABLES = Object.freeze(['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN',
  'OPENAI_FEDERATION_RULE_ID', 'OPENAI_IDENTITY_TOKEN_FILE', 'OPENAI_WORKLOAD_IDENTITY_CONTEXT']);
function externalOptions(home, env = process.env) {
  const isolated = { ...env, CODEX_HOME: home };
  for (const key of Object.keys(isolated)) if (AUTH_ENV_VARIABLES.includes(key.toUpperCase())) delete isolated[key];
  return { env: isolated, readOnly: true };
}
function clientOptions(root, profile, env = process.env) {
  if (profile.id === 'default') return { env };
  return { ...externalOptions(path.join(root, 'accounts', profile.id), env), readOnly: undefined,
    args: ['-c', 'cli_auth_credentials_store="file"', 'app-server', '--listen', 'stdio://'] };
}
function connectionOptions({ root, profile, env, sourceHome, ...context }) {
  return { ...context, ...(sourceHome ? externalOptions(sourceHome, env) : clientOptions(root, profile, env)), profileId: profile.id };
}
module.exports = { AUTH_ENV_VARIABLES, clientOptions, externalOptions, connectionOptions };
