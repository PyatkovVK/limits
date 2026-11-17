'use strict';
const { Subscriptions } = require('../../../common/ai-connects/codex/subscriptions.cjs');
class AppleAccounts extends Subscriptions {
  constructor(options) { super({ ...options, sourcesName: 'mac-subscriptions.json', allowRemoveDefault: true }); }
}
module.exports = { AppleAccounts };
