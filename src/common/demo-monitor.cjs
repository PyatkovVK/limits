'use strict';
const { EventEmitter } = require('node:events');
const { groupsFromBuckets, displaySchema } = require('./ai-connects/codex/limits.cjs');
class DemoMonitor extends EventEmitter {
  constructor(profile) {
    super();
    this.client = new EventEmitter();
    this.client.start = async () => {};
    this.client.request = async () => ({});
    const work = profile.id !== 'default';
    const now = Math.floor(Date.now() / 1000);
    this.state = { status: 'ready', error: null, refreshing: false, selectedId: 'codex', updatedAt: Date.now(), account: { type: 'chatgpt', email: work ? 'work@example.com' : 'demo@example.com', planType: work ? 'business' : 'plus' }, buckets: [{ id: 'codex', name: 'Codex', short: { remaining: work ? 38 : 72, resetsAt: now + 8340 }, weekly: { remaining: work ? 81 : 46, resetsAt: now + 345600 }, other: [] }] };
    Object.assign(this.state, { providerId: 'codex', profileId: profile.id, groups: groupsFromBuckets(this.state.buckets), capabilities: { signIn: true, cancelSignIn: true, signOut: true } });
    this.state.displaySchema = displaySchema(this.state);
  }
  async refresh() { this.state.updatedAt = Date.now(); this.emit('state', this.state); return this.state; }
  select() {}
  async signOut() { await this.client.request('account/logout'); }
  stop() {}
}
module.exports = { DemoMonitor };
