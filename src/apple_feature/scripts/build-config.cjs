'use strict';
function configureAppleBuild(config, env = process.env) {
  if (config.mac.identity === undefined && !env.CSC_NAME && !env.CSC_LINK) {
    config.mac.identity = '-';
    config.mac.hardenedRuntime = false;
    config.mac.notarize = false;
  }
  config.mac.extraResources = [...(config.mac.extraResources || []), { from: 'build/apple-screen-info', to: 'apple-screen-info' }];
}
module.exports = { configureAppleBuild };
