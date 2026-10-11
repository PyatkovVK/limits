const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Monitor } = require('../src/common/monitor.cjs');
const quota = { rateLimits: { primary: { usedPercent: 40, windowDurationMins: 300 }, secondary: { usedPercent: 80, windowDurationMins: 10080 } } };
class FakeClient extends EventEmitter {
  account = { type: 'chatgpt', email: 'test@example.com', planType: 'plus' };
  count = 0;
  fail = false;
  async start() {}
  stop() {}
  async request(method) {
    if (this.fail) throw new Error('offline');
    if (method === 'account/read') return { account: this.account };
    this.count++; return quota;
  }
}
function setup(t) { const client = new FakeClient(); const monitor = new Monitor(client); t.after(() => monitor.stop()); return { client, monitor }; }
test('coalesces concurrent polls and keeps last sample on network failure', async t => {
  const { client, monitor } = setup(t);
  await Promise.all([monitor.refresh(), monitor.refresh()]); assert.equal(client.count, 1);
  assert.equal(monitor.state.buckets[0].short.remaining, 60);
  client.fail = true; await monitor.refresh();
  assert.equal(monitor.state.status, 'error'); assert.equal(monitor.state.buckets[0].short.remaining, 60);
  client.fail = false; await monitor.refresh(); assert.equal(monitor.state.error, null); assert.equal(monitor.failures, 0);
});
test('logout and account switch remove old percentages', async t => {
  const { client, monitor } = setup(t); await monitor.refresh();
  client.account = null; await monitor.refresh(); assert.equal(monitor.state.status, 'signed-out'); assert.deepEqual(monitor.state.buckets, []);
  client.account = { type: 'apiKey' }; await monitor.refresh(); assert.equal(monitor.state.status, 'unsupported'); assert.deepEqual(monitor.state.buckets, []);
});

test('a fresh account offers browser sign-in and loads limits after authentication completes', async t => {
  const { client, monitor } = setup(t);
  client.account = null;
  const requests = [];
  const request = client.request.bind(client);
  client.request = async (method, params) => {
    requests.push({ method, params });
    if (method === 'account/login/start') return { loginId: 'login-1', authUrl: 'https://auth.openai.com/test' };
    if (method === 'account/login/cancel') return {};
    return request(method);
  };
  await monitor.refresh();
  assert.equal(monitor.state.status, 'signed-out');
  assert.equal(monitor.state.error, null);
  assert.equal(client.count, 0);
  assert.equal(await monitor.login(), 'https://auth.openai.com/test');
  assert.equal(monitor.state.status, 'signing-in');
  assert.deepEqual(requests.find(item => item.method === 'account/login/start').params, { type: 'chatgpt' });
  await monitor.cancelLogin();
  assert.equal(monitor.state.status, 'signed-out');
  assert.deepEqual(requests.find(item => item.method === 'account/login/cancel').params, { loginId: 'login-1' });
  await monitor.login();
  client.account = { type: 'chatgpt', email: 'test@example.com', planType: 'plus' };
  client.emit('notification', 'account/login/completed', { success: true });
  while (monitor.inflight) await monitor.inflight;
  assert.equal(monitor.state.status, 'ready');
  assert.equal(monitor.state.buckets[0].short.remaining, 60);
});
test('updates from a different bucket preserve other bucket data', async t => {
  const { client, monitor } = setup(t); await monitor.refresh();
  client.emit('notification', 'account/rateLimits/updated', { rateLimits: { limitId: 'other', primary: { usedPercent: 5, windowDurationMins: 300 } } });
  assert.equal(monitor.state.buckets.length, 2); assert.equal(monitor.state.buckets[0].short.remaining, 60);
  monitor.select('other'); assert.equal(monitor.state.selectedId, 'other');
});
test('stop prevents further network refreshes', async t => {
  const { client, monitor } = setup(t); monitor.stop(); await monitor.refresh(); assert.equal(client.count, 0);
});
test('account notification during a poll cannot restore old-account quotas', async t => {
  const { client, monitor } = setup(t);
  let release;
  let signal;
  const requested = new Promise(resolve => { signal = resolve; });
  client.request = async method => {
    if (method === 'account/read') return { account: client.account };
    signal(); return new Promise(resolve => { release = resolve; });
  };
  const refresh = monitor.refresh(); await requested;
  client.account = null;
  client.emit('notification', 'account/updated', { authMode: null });
  release(quota); await refresh;
  if (monitor.inflight) await monitor.inflight;
  assert.deepEqual(monitor.state.buckets, []); assert.equal(monitor.state.account, null);
});
