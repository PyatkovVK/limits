'use strict';
const { CredentialStore, keyConnectionOptions } = require('../api-key-credentials.cjs');

function connectionOptions(context) {
  return keyConnectionOptions(context, 'deepseek');
}
module.exports = { CredentialStore, connectionOptions };
