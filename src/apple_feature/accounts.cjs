'use strict';
const { Subscriptions, externalOptions, sourceId } = require('../common/subscriptions.cjs');
class AppleAccounts extends Subscriptions {
  constructor(options) { super({ ...options, sourcesName: 'mac-subscriptions.json' }); }
}
module.exports = { AppleAccounts, externalOptions, sourceId };
