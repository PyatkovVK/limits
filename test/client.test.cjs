const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');
const { CodexClient } = require('../src/common/codex-client.cjs');
const fixture = path.join(__dirname, 'fixtures/server.cjs');
function client(t, timeout = 3000) {
  const value = new CodexClient(process.execPath, { args: [fixture], timeout });
  t.after(() => value.stop()); return value;
}
test('handshake, concurrent requests and unsolicited notifications', async t => {
  const value = client(t); await value.start();
  const notification = once(value, 'notification');
  const results = await Promise.all([value.request('one'), value.request('two'), value.request('notify')]);
  assert.deepEqual(results.map(item => item.method), ['one', 'two', 'notify']);
  assert.equal((await notification)[0], 'account/rateLimits/updated');
  assert.equal(value.pending.size, 0);
});
test('RPC errors reject the matching request', async t => {
  const value = client(t); await value.start(); await assert.rejects(value.request('fail'), { code: -32000 });
  assert.equal(value.pending.size, 0);
});
test('timeout closes the process and allows reconnect', async t => {
  const value = client(t, 500); await value.start(); await assert.rejects(value.request('hang'), /вовремя/);
  assert.equal(value.child, null); assert.equal(value.pending.size, 0);
  await value.start(); assert.equal((await value.request('ok')).method, 'ok');
});
test('process exit rejects outstanding requests', async t => {
  const value = client(t); await value.start(); await assert.rejects(value.request('die'), /закрыто/);
  assert.equal(value.pending.size, 0);
});
