'use strict';
const { buildUnix } = require('./build-unix.cjs');

buildUnix('mac', process.argv.slice(2), config => {
  require('../../src/apple_feature/scripts/build-helper.cjs').buildHelper();
  require('../../src/apple_feature/scripts/build-config.cjs').configureAppleBuild(config);
});
