'use strict';

function configureMacBuild(config, env = process.env) {
  // Local builds should not silently select a developer certificate from Keychain.
  if (config.mac.identity === undefined && !env.CSC_NAME && !env.CSC_LINK) {
    config.mac.identity = '-';
    config.mac.hardenedRuntime = false;
    config.mac.notarize = false;
  }
}
module.exports = { configureMacBuild };
