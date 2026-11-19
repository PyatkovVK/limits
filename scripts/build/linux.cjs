'use strict';
const { buildUnix } = require('./build-unix.cjs');

buildUnix('linux', process.argv.slice(2));
