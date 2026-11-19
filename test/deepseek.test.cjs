'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DeepSeekClient, BALANCE_URL, KEY_URL } = require('../src/common/ai-connects/deepseek/client.cjs');
const { DeepSeekController } = require('../src/common/ai-connects/deepseek/controller.cjs');
const { CredentialStore } = require('../src/common/ai-connects/deepseek/credentials.cjs');
const { normalizeBalance } = require('../src/common/ai-connects/deepseek/balance.cjs');
const { ControllerRegistry } = require('../src/common/ai-connects/registry.cjs');
const { Accounts } = require('../src/common/core/accounts.cjs');
const { Monitor } = require('../src/common/core/monitor.cjs');
const { MoneyController } = require('./fixtures/money-controller.cjs');
const { isStale } = require('../src/common/core/limits.cjs');
const { view } = require('../src/common/renderer/metrics.js');
const sample = () => ({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '12.3456', granted_balance: '0', topped_up_balance: '12.3456' }] });
const key = 'sk-deepseek-fixture-secret';
const memory = () => ({ value: null, writes: 0, read() { return this.value; }, write(value) { this.value = value; this.writes++; }, clear() { this.value = null; } });
function directory(t) {
  const parent = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'limits-deepseek-'));
  t.after(() => { assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('limits-deepseek-')); fs.rmSync(root, { recursive: true, force: true }); });
  return root;
}
function encryption() {
  const secret = crypto.randomBytes(32);
  return { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'test',
    encryptString(value) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secret, iv); const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]); },
    decryptString(value) { const cipher = crypto.createDecipheriv('aes-256-gcm', secret, value.subarray(0, 12)); cipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString('utf8'); } };
}

test('DeepSeek only reads the balance endpoint and sanitizes authentication, HTTP and malformed responses', async () => {
  const calls = [];
  const client = new DeepSeekClient({ fetch: async (...args) => { calls.push(args); return Response.json(sample()); } });
  assert.deepEqual(await client.balance(key), sample());
  assert.equal(calls[0][0], BALANCE_URL); assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].redirect, 'error'); assert.equal(calls[0][1].headers.Authorization, `Bearer ${key}`);
  for (const status of [401, 403, 429, 500, 503]) {
    client.fetch = async () => new Response(key, { status });
    const code = [401, 403].includes(status) ? 'invalidApiKey' : 'balanceRefreshFailed';
    await assert.rejects(client.balance(key), { message: code, code });
  }
  client.fetch = async () => { throw new Error(key); };
  await assert.rejects(client.balance(key), { message: 'balanceRefreshFailed' });
  client.fetch = async () => new Response('not json');
  await assert.rejects(client.balance(key), { message: 'balanceRefreshFailed' });
  await assert.rejects(client.balance('bad\r\nkey'), { code: 'invalidApiKey' });
});
test('balance normalization preserves precision, real zero, missing values and distinct currencies', () => {
  const raw = sample(); raw.balance_infos.push({ currency: 'CNY', total_balance: '0', granted_balance: '', topped_up_balance: 'NaN' }, { currency: 'USD', total_balance: '999' }, { currency: 'BAD' });
  const state = normalizeBalance(raw);
  assert.equal(state.groups.length, 2); assert.equal(state.accountAvailable, true);
  assert.equal(state.groups[0].metrics[0].value, 12.3456);
  assert.equal(state.groups[1].metrics[0].value, 0);
  assert.equal(state.groups[1].metrics[1].value, null); assert.equal(state.groups[1].metrics[2].value, null);
  assert.deepEqual(state.groups.map(group => group.metrics[0].currency), ['USD', 'CNY']);
  for (const value of [null, {}, { is_available: true }, { is_available: 1, balance_infos: [] }]) assert.throws(() => normalizeBalance(value), { code: 'balanceRefreshFailed' });
});
test('encrypted credentials survive reload per profile, clear locally and refuse insecure storage', t => {
  const root = directory(t), safeStorage = encryption();
  const a = new CredentialStore(path.join(root, 'a', 'key.bin'), safeStorage);
  const b = new CredentialStore(path.join(root, 'b', 'key.bin'), safeStorage);
  assert.equal(a.read(), null); a.write(key); b.write('sk-other');
  assert.equal(fs.readFileSync(a.file).includes(Buffer.from(key)), false);
  assert.equal(new CredentialStore(a.file, safeStorage).read(), key);
  a.clear(); a.clear(); assert.equal(a.read(), null); assert.equal(b.read(), 'sk-other');
  for (const unavailable of [undefined, { isEncryptionAvailable: () => false }, { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'basic_text' }]) {
    const store = new CredentialStore(path.join(root, 'blocked.bin'), unavailable);
    assert.throws(() => store.write(key), { code: 'credentialStorageUnavailable' }); assert.equal(fs.existsSync(store.file), false);
  }
  fs.writeFileSync(b.file, 'corrupt'); assert.throws(() => b.read(), { code: 'credentialStorageUnavailable' });
});
test('DeepSeek polls independently, retains stale samples, reports exhausted funds and clears invalid credentials', async t => {
  const credentials = memory(); credentials.value = key;
  let response = sample(), fail = false, calls = 0;
  const controller = new DeepSeekController({ credentials, client: { async balance() { calls++; if (fail) throw new Error(key); return response; } } });
  const monitor = new Monitor(controller); t.after(() => monitor.stop());
  await Promise.all([monitor.refresh(), monitor.refresh()]); assert.equal(calls, 1);
  assert.equal(monitor.intervalMs, 60000); assert.equal(view(monitor.state).primary.value, 12.3456); assert.equal(monitor.state.buckets.length, 0);
  assert.equal(controller.getCredentialsUrl(), KEY_URL);
  const updatedAt = monitor.state.updatedAt;
  fail = true; await monitor.refresh(); assert.equal(isStale(monitor.state), true); assert.equal(monitor.state.updatedAt, updatedAt);
  assert.equal(view(monitor.state).primary.value, 12.3456); assert.ok(!JSON.stringify(monitor.state).includes(key));
  fail = false; response = { is_available: false, balance_infos: [{ currency: 'USD', total_balance: '0' }] };
  await monitor.refresh(); assert.equal(monitor.state.status, 'ready'); assert.equal(monitor.state.accountAvailable, false);
  assert.equal(view(monitor.state).primary.value, 0); assert.equal(isStale(monitor.state), false);
  controller.client.balance = async () => { throw Object.assign(new Error(key), { code: 'invalidApiKey' }); };
  await monitor.refresh(); assert.equal(monitor.state.status, 'signed-out'); assert.equal(monitor.state.groups.length, 0);
  assert.equal(credentials.value, key, 'a rejected key remains replaceable without silently deleting storage');
});
function accounts(t) {
  const root = directory(t), stores = new Map(); let gate;
  const client = { async balance(value) { if (gate) await gate; if (value === 'bad') throw Object.assign(new Error(key), { code: 'invalidApiKey' }); return sample(); } };
  const registry = new ControllerRegistry().register('test-money', { create: options => new MoneyController(options) }).register('deepseek', {
    name: 'DeepSeek', authentication: 'api-key', create: options => new DeepSeekController(options),
    connectionOptions({ profile }) { if (!stores.has(profile.id)) stores.set(profile.id, memory()); return { credentials: stores.get(profile.id), client }; }
  });
  const service = new Accounts({ root, registry, initialProfiles: [{ id: 'default', providerId: 'test-money' }] });
  t.after(() => service.stop());
  return { service, root, stores, client, block() { let release; gate = new Promise(resolve => { release = resolve; }); return () => { gate = null; release(); }; } };
}
test('connecting a key creates a profile only after validation, persists no secrets and starts the next poll without a second read', async t => {
  const { service, root, stores, client } = accounts(t);
  let calls = 0; const balance = client.balance; client.balance = async value => { calls++; return balance(value); };
  const pending = service.beginKeyConnection('deepseek');
  assert.equal(service.profiles.length, 1); assert.equal(fs.existsSync(path.join(root, 'accounts.json')), false);
  assert.equal(service.credentialsUrl(pending.id), KEY_URL);
  await assert.rejects(service.submitKeyConnection(pending.id, 'bad'), { code: 'invalidApiKey' });
  assert.equal(service.profiles.length, 1); assert.equal(service.snapshot().keyConnection.phase, 'waiting');
  const id = await service.submitKeyConnection(pending.id, key);
  assert.equal(calls, 2); assert.equal(stores.get(id).value, key); assert.equal(service.snapshot().keyConnection, null);
  assert.equal(service.profiles.length, 2); assert.ok(service.monitors.get(id).timer);
  service.selectProfile(id); assert.equal(service.snapshot().displayName, 'DeepSeek');
  assert.ok(!fs.readFileSync(path.join(root, 'accounts.json'), 'utf8').includes(key));
  assert.ok(!JSON.stringify(service.snapshot()).includes(key));
  const restored = new Accounts({ root, registry: service.registry }); t.after(() => restored.stop());
  await restored.refresh(); assert.equal(restored.snapshot().providerId, 'deepseek'); assert.equal(view(restored.snapshot()).primary.value, 12.3456);
  await service.remove(id); assert.equal(stores.get(id).value, null); assert.equal(service.profiles.length, 1);
});
test('cancelling, disconnecting and removing profiles ignore delayed key checks and preserve other accounts', async t => {
  const { service, stores, block } = accounts(t);
  let pending = service.beginKeyConnection('deepseek'); const release = block();
  const submission = service.submitKeyConnection(pending.id, key);
  assert.throws(() => service.beginKeyConnection('deepseek'), { code: 'loginBusy' });
  await assert.rejects(service.submitKeyConnection(pending.id, key), { code: 'loginBusy' });
  service.cancelKeyConnection(pending.id); release();
  await assert.rejects(submission, { code: 'loginIncomplete' });
  assert.equal(service.profiles.length, 1); assert.equal([...stores.values()].some(store => store.writes), false);
  pending = service.beginKeyConnection('deepseek'); const id = await service.submitKeyConnection(pending.id, key);
  service.rename(id, 'Wallet'); service.selectProfile(id);
  pending = service.beginKeyConnection('deepseek', id);
  await assert.rejects(service.submitKeyConnection(pending.id, 'bad'), { code: 'invalidApiKey' });
  assert.equal(stores.get(id).value, key); assert.equal(view(service.snapshot()).primary.value, 12.3456);
  const unblock = block(); const replacing = service.submitKeyConnection(pending.id, 'sk-replacement');
  await service.remove(id); unblock(); await assert.rejects(replacing, { code: 'loginIncomplete' });
  assert.equal(stores.get(id).value, null); assert.equal(service.profiles.length, 1); assert.equal(service.snapshot().keyConnection, null);
});
test('replacing a validated key keeps profile identity and disconnects the old poller', async t => {
  const { service, stores, block } = accounts(t);
  let pending = service.beginKeyConnection('deepseek'); const id = await service.submitKeyConnection(pending.id, key);
  service.rename(id, 'My balance'); service.selectProfile(id);
  const previous = service.monitors.get(id), release = block();
  const poll = previous.refresh();
  pending = service.beginKeyConnection('deepseek', id);
  const replacing = service.submitKeyConnection(pending.id, 'sk-replacement');
  release(); await replacing; await poll;
  assert.equal(previous.stopped, true); assert.equal(stores.get(id).value, 'sk-replacement');
  assert.equal(service.selectedProfileId, id); assert.equal(service.snapshot().displayName, 'My balance'); assert.equal(service.profiles.length, 2);
});
test('stopping an in-flight balance poll aborts it and ignores a delayed sample', async () => {
  const credentials = memory(); credentials.value = key;
  let release, signal;
  const gate = new Promise(resolve => { release = resolve; });
  const controller = new DeepSeekController({ credentials, client: { async balance(_key, incoming) { signal = incoming; await gate; return sample(); } } });
  const monitor = new Monitor(controller), pending = monitor.refresh();
  await new Promise(resolve => setImmediate(resolve)); monitor.stop();
  assert.equal(signal.aborted, true); release(); await pending;
  assert.equal(monitor.state.updatedAt, null); assert.equal(monitor.state.groups.length, 0); assert.equal(credentials.value, key);
});
