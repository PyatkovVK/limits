'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Accounts, clientOptions } = require('../src/accounts.cjs');

function fixture(t) {
  const parent = path.resolve(__dirname, '../artifacts');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'accounts-test-'));
  t.after(() => {
    if (!root.startsWith(parent + path.sep)) throw new Error('Unsafe test cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  });
  const clients = new Map();
  function createMonitor(profile, options) {
    const monitor = new EventEmitter();
    monitor.client = new EventEmitter();
    monitor.client.start = async () => {};
    monitor.client.request = async method => { monitor.lastRequest = method; return {}; };
    monitor.state = { account: null, buckets: [], selectedId: 'codex', status: 'signed-out', updatedAt: null, error: null };
    monitor.refresh = async () => monitor.state;
    monitor.login = async () => { monitor.loginCount = (monitor.loginCount || 0) + 1; return 'https://auth.openai.com/test'; };
    monitor.cancelLogin = async () => { monitor.cancelled = true; };
    monitor.stop = () => { monitor.stopped = true; };
    monitor.select = id => { monitor.state.selectedId = id; };
    monitor.options = options;
    clients.set(profile.id, monitor);
    return monitor;
  }
  return { root, createMonitor, clients, accounts: new Accounts({ root, createMonitor }) };
}
function connect(monitor, email, remaining) {
  monitor.state = { ...monitor.state, status: 'ready', account: { type: 'chatgpt', email, planType: 'plus' }, updatedAt: Date.now(), buckets: [{ id: 'codex', short: { remaining }, weekly: { remaining: remaining + 1 } }] };
  monitor.emit('state');
}
test('independent accounts, unlimited profiles, selection and nicknames survive restart', t => {
  const { accounts, clients, root, createMonitor } = fixture(t);
  const work = accounts.add();
  connect(clients.get('default'), 'personal@example.com', 72);
  connect(clients.get(work), 'work@example.com', 38);
  accounts.rename('default', 'Sam'); accounts.rename(work, ' sam ');
  assert.deepEqual(accounts.snapshot().profiles.map(p => p.displayName), ['Sam (personal@example.com)', 'sam (work@example.com)']);
  assert.equal(accounts.snapshot().buckets[0].short.remaining, 72);
  clients.get(work).state.error = 'disconnected'; clients.get(work).emit('state');
  assert.equal(accounts.snapshot().error, null);
  accounts.selectProfile(work);
  assert.equal(accounts.snapshot().buckets[0].short.remaining, 38);
  assert.equal(accounts.snapshot().error, 'disconnected');
  for (let i = 0; i < 5; i++) accounts.add();
  assert.equal(accounts.snapshot().profiles.length, 7);
  assert.equal(new Accounts({ root, createMonitor }).selectedProfileId, work);
  const saved = fs.readFileSync(path.join(root, 'accounts.json'), 'utf8');
  assert.ok(!saved.includes('personal@example.com'));
  assert.ok(!saved.includes('buckets'));
});
test('private Codex homes and file stores cannot share credentials or environment API keys', () => {
  const env = { CODEX_HOME: 'shared', OPENAI_API_KEY: 'private-test-key', CODEX_API_KEY: 'other-test-key', PATH: 'bin' };
  assert.equal(clientOptions('root', { id: 'default' }, env).env, env);
  const a = clientOptions('root', { id: 'a' }, env), b = clientOptions('root', { id: 'b' }, env);
  assert.notEqual(a.env.CODEX_HOME, b.env.CODEX_HOME);
  assert.equal(a.env.OPENAI_API_KEY, undefined);
  assert.equal(a.env.CODEX_API_KEY, undefined);
  assert.ok(a.args.includes('cli_auth_credentials_store="file"'));
  assert.equal(env.CODEX_HOME, 'shared');
});
test('browser login is serialized until completion or cancellation', async t => {
  const { accounts, clients } = fixture(t);
  const a = accounts.add(), b = accounts.add();
  await accounts.login(a);
  await assert.rejects(accounts.login(b), { code: 'loginBusy' });
  assert.equal(clients.get(b).loginCount, undefined);
  clients.get(a).client.emit('notification', 'account/login/completed', { success: true });
  await accounts.login(b);
  await accounts.cancelLogin(b);
  assert.equal(clients.get(b).cancelled, true);
  assert.equal(accounts.snapshot().loginProfileId, null);
});
test('removing a private selected profile logs out only it and returns widget to the shared account', async t => {
  const { accounts, clients } = fixture(t);
  const work = accounts.add(); accounts.selectProfile(work);
  await accounts.remove(work);
  assert.equal(clients.get(work).lastRequest, 'account/logout');
  assert.equal(clients.get(work).stopped, true);
  assert.equal(clients.get('default').lastRequest, undefined);
  assert.equal(accounts.selectedProfileId, 'default');
  await assert.rejects(accounts.remove('default'));
});
test('corrupt registry IDs cannot escape the account directory', t => {
  const { root, createMonitor } = fixture(t);
  fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify({ profiles: [{ id: '../../escape' }, { id: 'default', nickname: '\u0000Hello' }, { id: 'default' }], selectedProfileId: '../../escape' }));
  const accounts = new Accounts({ root, createMonitor });
  assert.equal(accounts.profiles.length, 1);
  assert.equal(accounts.profiles[0].nickname, 'Hello');
  assert.equal(accounts.selectedProfileId, 'default');
});
test('refresh waits for a queued account reread before returning a snapshot', async t => {
  const { accounts, clients } = fixture(t);
  const monitor = clients.get('default');
  let finish;
  monitor.refresh = async () => {
    monitor.inflight = new Promise(resolve => { finish = () => {
      connect(monitor, 'personal@example.com', 72);
      monitor.inflight = null; resolve();
    }; });
  };
  let returned = false;
  const result = accounts.refresh().then(snapshot => { returned = true; return snapshot; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(returned, false);
  finish();
  assert.equal((await result).buckets[0].short.remaining, 72);
});
