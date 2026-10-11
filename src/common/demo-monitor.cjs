'use strict';
const { EventEmitter } = require('node:events');
class DemoMonitor extends EventEmitter {
  constructor(profile) {
    super();
    this.client = new EventEmitter();
    this.client.start = async () => {};
    this.client.request = async () => ({});
    const work = profile.id !== 'default';
    const now = Math.floor(Date.now() / 1000);
    this.state = { status: 'ready', error: null, refreshing: false, selectedId: 'codex', updatedAt: Date.now(), account: { type: 'chatgpt', email: work ? 'work@example.com' : 'demo@example.com', planType: work ? 'business' : 'plus' }, buckets: [{ id: 'codex', name: 'Codex', short: { remaining: work ? 38 : 72, resetsAt: now + 8340 }, weekly: { remaining: work ? 81 : 46, resetsAt: now + 345600 }, other: [] }] };
  }
  async refresh() { this.state.updatedAt = Date.now(); this.emit('state', this.state); return this.state; }
  select() {}
  stop() {}
}
module.exports = { DemoMonitor };
