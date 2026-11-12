'use strict';
const { Subscriptions, externalOptions } = require('../common/ai-connects/codex/subscriptions.cjs');
class AppleAccounts extends Subscriptions {
  constructor(options) { super({ ...options, sourcesName: 'mac-subscriptions.json' }); }
}
module.exports = { AppleAccounts, externalOptions };
