'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { Subscriptions: AppleAccounts } = require('../../common/subscriptions.cjs');
const { Monitor } = require('../../common/monitor.cjs');
const { DemoMonitor } = require('../../common/demo-monitor.cjs');

function setup(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'limits-linux-accounts-test-')));
  const shared = path.join(root, 'external'); fs.mkdirSync(shared);
  const monitors = new Map();
  const createMonitor = (profile, options) => {
    const monitor = new DemoMonitor(profile); monitor.options = options;
    monitor.login = async () => 'https://auth.openai.com/test';
    monitor.cancelLogin = async () => {};
    monitor.client.request = async method => { monitor.lastRequest = method; return {}; };
    monitors.set(profile.id, monitor); return monitor;
  };
  const options = { root, env: { CODEX_HOME: shared, OPENAI_API_KEY: 'fixture-key', PATH: '/bin' }, createMonitor };
  const accounts = new AppleAccounts(options);
  t.after(() => { accounts.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, shared, monitors, options, accounts };
}

test('Linux distinguishes connected subscriptions and current Codex sources without replacing existing profiles', t => {
  const { accounts, monitors, options } = setup(t);
  const work = accounts.add(); accounts.selectProfile(work); accounts.rename(work, 'Work');
  const snapshot = accounts.snapshot();
  assert.equal(snapshot.profiles.length, 2);
  assert.equal(snapshot.profiles[0].source, 'active'); assert.equal(snapshot.profiles[0].readOnly, true);
  assert.equal(snapshot.profiles[1].source, 'connected'); assert.equal(snapshot.profiles[1].readOnly, false);
  assert.equal(monitors.get('default').options.env.OPENAI_API_KEY, undefined);
  assert.equal(monitors.get('default').options.readOnly, true);
  assert.match(monitors.get(work).options.env.CODEX_HOME, /accounts/);
  accounts.setMode('connected');
  const restored = new AppleAccounts(options); t.after(() => restored.stop());
  assert.equal(restored.snapshot().subscriptions.mode, 'connected');
  assert.equal(restored.snapshot().selectedProfileId, work);
  assert.equal(restored.snapshot().displayName, 'Work');
  assert.throws(() => accounts.setMode('unknown'));
});

test('multiple local Codex homes remain visible, persist and can be forgotten without logout', async t => {
  const { accounts, root, shared, options, monitors } = setup(t);
  const another = path.join(root, 'vscode'); fs.mkdirSync(another);
  assert.equal(accounts.addSource(shared), 'default');
  const id = accounts.addSource(another);
  assert.equal(accounts.addSource(another), id);
  assert.equal(accounts.snapshot().profiles.length, 2);
  assert.equal(monitors.get(id).options.env.CODEX_HOME, fs.realpathSync(another));
  accounts.selectProfile(id);
  const restored = new AppleAccounts(options); t.after(() => restored.stop());
  assert.equal(restored.snapshot().selectedProfileId, id);
  assert.equal(restored.snapshot().subscriptions.active, 2);
  assert.ok(!fs.readFileSync(path.join(root, 'accounts.json'), 'utf8').includes(id));
  await assert.rejects(accounts.login(id));
  await accounts.remove(id);
  assert.equal(monitors.get(id).lastRequest, undefined, 'forgetting a source must never log it out');
  assert.equal(fs.existsSync(another), true);
  assert.equal(accounts.snapshot().selectedProfileId, 'default');
  await assert.rejects(accounts.remove('default'));
});

test('current-account polling reloads external sign-in changes without forced refresh-token rotation', async t => {
  class Client extends EventEmitter {
    generation = 0; reads = []; connected = false;
    account = { type: 'chatgpt', email: 'first@example.com', planType: 'plus' };
    async start() { if (!this.connected) { this.connected = true; this.generation++; } }
    async request(method, params) {
      if (method === 'account/read') { this.reads.push(params.refreshToken); return { account: this.account }; }
      return { rateLimits: { primary: { usedPercent: this.account.email.startsWith('first') ? 10 : 80, windowDurationMins: 300 } } };
    }
    stop() { if (this.connected) { this.connected = false; this.emit('disconnected'); } }
  }
  const client = new Client(); const monitor = new Monitor(client, { refreshCredentials: false, reloadOnPoll: true });
  t.after(() => monitor.stop());
  await monitor.refresh();
  assert.equal(monitor.state.buckets[0].short.remaining, 90);
  client.account = { type: 'chatgpt', email: 'second@example.com', planType: 'business' };
  const states = []; monitor.on('state', state => states.push({ email: state.account?.email, value: state.buckets[0]?.short.remaining, error: state.error }));
  await monitor.refresh();
  assert.equal(client.generation, 2);
  assert.deepEqual(client.reads, [false, false]);
  assert.equal(monitor.state.account.email, 'second@example.com');
  assert.equal(monitor.state.buckets[0].short.remaining, 20);
  assert.ok(!states.some(state => state.email === 'second@example.com' && state.value === 90));
  assert.ok(states.every(state => state.error === null));
  client.account = null; await monitor.refresh();
  assert.equal(monitor.state.status, 'signed-out'); assert.deepEqual(monitor.state.buckets, []);
});

test('startup account notifications do not cause an external reconnect loop', async t => {
  const client = new EventEmitter();
  client.generation = 0;
  client.start = async () => {
    if (client.connected) return;
    client.connected = true; client.generation++;
    client.emit('notification', 'account/updated', {});
  };
  client.stop = () => { client.connected = false; };
  client.request = async method => method === 'account/read' ? { account: { type: 'chatgpt', email: 'fixture@example.com' } } : { rateLimits: {} };
  const monitor = new Monitor(client, { refreshCredentials: false, reloadOnPoll: true });
  t.after(() => monitor.stop());
  await monitor.refresh();
  while (monitor.inflight) await monitor.inflight;
  assert.equal(client.generation, 1);
  assert.equal(monitor.state.status, 'ready');
});
