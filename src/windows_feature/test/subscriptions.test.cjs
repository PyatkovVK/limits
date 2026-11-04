'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Subscriptions } = require('../../common/subscriptions.cjs');
const { DemoMonitor } = require('../../common/demo-monitor.cjs');

test('Windows tracks the current Codex home alongside connected subscriptions and preserves selection', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-win-subscriptions-'));
  const home = path.join(root, 'Codex Personal');
  fs.mkdirSync(home);
  const monitors = new Map();
  let logouts = 0;
  const options = { root, env: { CODEX_HOME: home, OPENAI_API_KEY: 'fixture', CODEX_API_KEY: 'fixture' }, createMonitor(profile, options) {
    const monitor = new DemoMonitor(profile); monitor.options = options;
    monitor.client.request = async () => { logouts++; return {}; };
    monitors.set(profile.id, monitor); return monitor;
  } };
  const accounts = new Subscriptions(options);
  t.after(() => { accounts.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  const connected = accounts.add();
  const state = accounts.snapshot();
  assert.deepEqual([state.subscriptions.active, state.subscriptions.connected], [1, 1]);
  assert.equal(monitors.get('default').options.env.OPENAI_API_KEY, undefined);
  assert.equal(monitors.get('default').options.env.CODEX_API_KEY, undefined);
  assert.equal(monitors.get('default').options.readOnly, true);
  assert.equal(monitors.get(connected).options.readOnly, undefined);
  accounts.selectProfile(connected); accounts.setMode('active');
  const restored = new Subscriptions(options); t.after(() => restored.stop());
  assert.equal(restored.selectedProfileId, connected);
  assert.equal(restored.snapshot().subscriptions.mode, 'active');
  await assert.rejects(accounts.login('default'));
  await assert.rejects(accounts.remove('default'));
  assert.equal(logouts, 0); assert.equal(fs.existsSync(home), true);
  assert.equal(accounts.selectedProfileId, connected);
});
