'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Monitor } = require('../src/common/monitor.cjs');

test('the owned server refreshes credentials at startup and reconnect without a desktop app', async t => {
  const client = new EventEmitter();
  client.generation = 1; client.start = async () => {}; client.stop = () => {};
  const reads = [];
  client.request = async (method, params) => {
    if (method === 'account/read') {
      reads.push(params.refreshToken);
      if (client.fail) throw new Error('offline');
      return { account: { type: 'chatgpt', email: 'demo@example.com' } };
    }
    return { rateLimits: { primary: { usedPercent: 20, windowDurationMins: 300 } } };
  };
  const monitor = new Monitor(client); t.after(() => monitor.stop());
  await monitor.refresh(); await monitor.refresh();
  assert.deepEqual(reads, [true, false]); assert.equal(monitor.state.status, 'ready');
  client.emit('disconnected'); client.generation++;
  client.fail = true; await monitor.refresh();
  client.fail = false; await monitor.refresh(); await monitor.refresh();
  assert.deepEqual(reads, [true, false, true, true, false]);
  assert.equal(monitor.state.status, 'ready'); assert.equal(monitor.state.buckets[0].short.remaining, 80);
});
