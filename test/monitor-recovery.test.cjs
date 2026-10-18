'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Monitor } = require('../src/common/monitor.cjs');

const quota = { rateLimits: { primary: { usedPercent: 40, windowDurationMins: 300 } } };
const turn = () => new Promise(resolve => setImmediate(resolve));
class Client extends EventEmitter {
  generation = 0;
  connected = false;
  stops = 0;
  reads = [];
  account = { type: 'chatgpt', email: 'test@example.com' };
  async start() {
    if (this.connected) return;
    this.connected = true; this.generation++;
    this.stale = false;
  }
  async request(method, params) {
    if (method === 'account/read') {
      this.reads.push(params.refreshToken);
      return { account: this.account };
    }
    if (method === 'account/login/start') return { loginId: 'login', authUrl: 'https://auth.openai.com/test' };
    if (method === 'account/rateLimits/read') {
      if (this.offline || this.stale) throw Object.assign(new Error('Unavailable'), { code: -32000 });
      if (this.hang) return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
      return quota;
    }
    return {};
  }
  stop() {
    if (!this.connected) return;
    this.connected = false; this.stops++;
    this.pending?.reject(new Error('Disconnected')); this.pending = null;
    this.emit('disconnected');
  }
}
function setup(t) {
  const client = new Client(); const monitor = new Monitor(client);
  t.after(() => monitor.stop());
  return { client, monitor };
}

test('a stale live session is replaced on the automatic retry and normal polls do not rotate credentials', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { client, monitor } = setup(t);
  await monitor.refresh(); await monitor.refresh();
  const updatedAt = monitor.state.updatedAt;
  client.stale = true;
  t.mock.timers.tick(30000); await turn();
  assert.equal(monitor.state.status, 'error');
  assert.equal(monitor.state.updatedAt, updatedAt);
  assert.equal(monitor.state.buckets[0].short.remaining, 60);
  assert.equal(monitor.state.interval, 60);
  assert.equal(client.connected, false);
  t.mock.timers.tick(60000); await turn();
  assert.equal(monitor.state.status, 'ready');
  assert.equal(monitor.state.error, null);
  assert.equal(monitor.state.interval, 30);
  assert.equal(client.generation, 2);
  await monitor.refresh();
  assert.deepEqual(client.reads, [true, false, false, true, false]);
});

test('offline retries stay bounded and recover after the network returns', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, monitor } = setup(t);
  await monitor.refresh(); client.offline = true;
  for (const delay of [60, 120, 240, 300, 300]) {
    await monitor.refresh();
    assert.equal(monitor.state.interval, delay);
    const generation = client.generation;
    t.mock.timers.tick(delay * 1000 - 1); await turn();
    assert.equal(client.generation, generation, 'no immediate retry loop');
  }
  client.offline = false;
  t.mock.timers.tick(1); await turn();
  assert.equal(monitor.state.status, 'ready');
  assert.equal(monitor.failures, 0);
});

test('wake cancels a pre-suspend request, coalesces recovery triggers and polls a fresh server immediately', async t => {
  const { client, monitor } = setup(t);
  await monitor.refresh(); client.hang = true;
  const old = monitor.refresh(); await turn();
  assert.ok(client.pending);
  client.hang = false;
  const recovery = monitor.reconnect();
  assert.equal(monitor.reconnect(), recovery);
  await Promise.all([old, recovery]);
  assert.equal(client.stops, 1);
  assert.equal(client.generation, 2);
  assert.equal(monitor.state.status, 'ready');
  assert.equal(monitor.state.refreshing, false);
  assert.equal(monitor.failures, 0);
  assert.deepEqual(client.reads, [true, false, true]);
});

test('wake skips a five-minute backoff without clearing the last sample', async t => {
  const { client, monitor } = setup(t);
  await monitor.refresh(); client.offline = true;
  for (let i = 0; i < 4; i++) await monitor.refresh();
  assert.equal(monitor.state.interval, 300);
  const samples = [];
  monitor.on('state', state => samples.push(state.buckets.length));
  client.offline = false; await monitor.reconnect();
  assert.equal(monitor.state.status, 'ready');
  assert.equal(monitor.state.interval, 30);
  assert.ok(samples.every(count => count === 1));
});

test('an intentional reconnect preserves a healthy status but still reports a failed recovery', async t => {
  const { client, monitor } = setup(t);
  await monitor.refresh();
  const errors = [];
  monitor.on('state', state => { if (state.error) errors.push(state.error); });
  await monitor.reconnect();
  assert.deepEqual(errors, []);
  client.offline = true; await monitor.reconnect();
  assert.equal(monitor.state.error, 'refreshFailed');
});

test('a late response from before reconnect cannot publish old-account limits', async t => {
  const { client, monitor } = setup(t);
  await monitor.refresh(); client.hang = true;
  const old = monitor.refresh(); await turn();
  const pending = client.pending;
  // Simulate a response already being delivered as the old process is stopped.
  client.stop = () => { client.connected = false; pending.resolve({ rateLimits: { primary: { usedPercent: 99, windowDurationMins: 300 } } }); };
  client.hang = false; client.account = { type: 'chatgpt', email: 'other@example.com' };
  const samples = [];
  monitor.on('state', state => { if (state.buckets.length) samples.push(state.buckets[0].short.remaining); });
  await Promise.all([old, monitor.reconnect()]);
  assert.equal(monitor.state.account.email, 'other@example.com');
  assert.equal(monitor.state.status, 'ready');
  assert.ok(samples.every(remaining => remaining === 60), 'the old response must never replace the cached sample');
});

test('recovery preserves an active browser sign-in and its login lock', async t => {
  const { client, monitor } = setup(t);
  client.account = null;
  await monitor.login();
  const attempt = monitor.loginAttempt;
  await monitor.reconnect();
  assert.equal(client.stops, 0);
  assert.equal(monitor.loginAttempt, attempt);
  assert.equal(monitor.loginId, 'login');
  assert.equal(monitor.state.status, 'signing-in');
});

test('browser sign-in starting as recovery is queued also retains its connection', async t => {
  const { client, monitor } = setup(t);
  client.account = null;
  const recovery = monitor.reconnect();
  const login = monitor.login();
  await Promise.all([recovery, login]);
  assert.equal(client.stops, 0);
  assert.equal(monitor.loginId, 'login');
});

test('shutdown prevents recovery and does not publish a refresh failure for cancelled requests', async t => {
  const { client, monitor } = setup(t);
  await monitor.refresh(); client.hang = true;
  const old = monitor.refresh(); await turn();
  monitor.stop(); await old;
  assert.equal(monitor.state.error, null);
  await monitor.reconnect();
  assert.equal(client.generation, 1);
  assert.equal(client.connected, false);
});
