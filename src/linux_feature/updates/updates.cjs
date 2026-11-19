'use strict';

const { PackageUpdates } = require('../../common/updates/package-updates.cjs');
const { linuxAdapter } = require('./adapter.cjs');

class LinuxUpdates extends PackageUpdates {
  constructor(options) {
    super({ ...options, adapter: linuxAdapter(options) });
  }
}

module.exports = { LinuxUpdates };
