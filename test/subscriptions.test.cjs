'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Subscriptions } = require('../src/common/ai-connects/codex/subscriptions.cjs');
const { DemoMonitor } = require('../src/common/demo/demo-monitor.cjs');

for (const sourcesName of ['subscriptions.json', 'mac-subscriptions.json']) {
  test(`${sourcesName}: obsolete folder references are ignored without touching external sign-ins`, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-subscriptions-migration-'));
    const home = path.join(root, 'current'), legacyHome = path.join(root, 'old-profile');
    fs.mkdirSync(home); fs.mkdirSync(legacyHome);
    const credentials = path.join(legacyHome, 'auth.json');
    fs.writeFileSync(credentials, 'fixture credentials');
    const connected = '11111111-1111-4111-8111-111111111111';
    const legacyId = 'active-0123456789abcdef01234567';
    fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify({ version: 1,
      profiles: [{ id: 'default' }, { id: connected, nickname: 'Work' }], selectedProfileId: 'default' }));
    fs.writeFileSync(path.join(root, sourcesName), JSON.stringify({ version: 1, mode: 'active',
      selectedProfileId: legacyId, homes: [legacyHome, path.join(root, 'missing-profile')] }));
    const created = [];
    let logouts = 0;
    const options = { root, sourcesName, env: { CODEX_HOME: home }, createMonitor(profile, options) {
      created.push({ id: profile.id, options });
      const monitor = new DemoMonitor(profile);
      monitor.signOut = async () => { logouts++; };
      return monitor;
    } };
    const accounts = new Subscriptions(options);
    t.after(() => { accounts.stop(); fs.rmSync(root, { recursive: true, force: true }); });
    assert.deepEqual(created.map(profile => profile.id), ['default', connected]);
    assert.equal(created[0].options.env.CODEX_HOME, fs.realpathSync(home));
    assert.equal(created[0].options.readOnly, true);
    assert.deepEqual(accounts.snapshot().subscriptions, { mode: 'active', active: 1, connected: 1 });
    assert.equal(accounts.selectedProfileId, 'default');
    assert.throws(() => accounts.selectProfile(legacyId), /Unknown profile/);
    await assert.rejects(accounts.login('default'));
    await assert.rejects(accounts.remove('default'));

    accounts.selectProfile(connected); accounts.setMode('connected');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, sourcesName), 'utf8')),
      { version: 1, mode: 'connected', selectedProfileId: connected });
    accounts.stop(); created.length = 0;
    const restored = new Subscriptions(options); t.after(() => restored.stop());
    assert.equal(restored.selectedProfileId, connected);
    assert.equal(restored.snapshot().displayName, 'Work');
    assert.equal(restored.snapshot().subscriptions.mode, 'connected');
    assert.deepEqual(created.map(profile => profile.id), ['default', connected]);
    assert.equal(logouts, 0);
    assert.equal(fs.readFileSync(credentials, 'utf8'), 'fixture credentials');
  });
}
