'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { AiController } = require('../src/common/ai-connects/ai-controller.cjs');
const { ControllerRegistry, registry } = require('../src/common/ai-connects/registry.cjs');
const { snapshot } = require('../src/common/ai-connects/contracts.cjs');
const { CodexController } = require('../src/common/ai-connects/codex/controller.cjs');
const { Monitor } = require('../src/common/monitor.cjs');
const { Accounts } = require('../src/common/accounts.cjs');
const { view, format } = require('../src/common/renderer/metrics.js');
const { isStale } = require('../src/common/limits.cjs');
const { TrayPresentation } = require('../src/common/tray.cjs');
const { MoneyController } = require('./fixtures/money-controller.cjs');

test('the abstract contract rejects incomplete controllers and production registers only Codex', () => {
  assert.throws(() => new AiController(), { code: 'controllerContract' });
  class MissingMethods extends AiController {}
  assert.throws(() => new MissingMethods(), { code: 'controllerContract' });
  assert.deepEqual([...registry.providers.keys()], ['codex']);
});
test('a monetary controller uses the shared scheduler and schema, retaining zero, units and stale samples', async t => {
  const controller = new MoneyController({ profileId: 'money-profile' }); const monitor = new Monitor(controller);
  t.after(() => monitor.stop());
  await Promise.all([monitor.refresh(), monitor.refresh()]);
  assert.equal(controller.calls, 1);
  assert.equal(monitor.state.profileId, 'money-profile');
  const diagnostics = []; monitor.on('diagnostic', value => diagnostics.push(value));
  controller.emit('diagnostic', { stage: 'private', code: 'private', accessToken: 'private' });
  assert.deepEqual(diagnostics, [{ stage: 'refresh', code: 'operationFailed' }]);
  assert.deepEqual(monitor.state.buckets, [], 'money is never projected into percentage windows');
  let display = view(monitor.state, 'en');
  assert.match(display.primary.formatted, /12\.50.*USD|USD.*12\.50/);
  assert.equal(display.primary.label, 'Balance');
  assert.equal(display.metrics[1].formatted, '0 requests');
  assert.equal(display.primary.resetsAt, null);
  const updatedAt = monitor.state.updatedAt;
  controller.offline = true; await monitor.refresh();
  assert.equal(monitor.state.status, 'error'); assert.equal(monitor.state.updatedAt, updatedAt); assert.equal(isStale(monitor.state), true);
  assert.equal(view(monitor.state).primary.value, 12.5);
  assert.ok(!JSON.stringify(monitor.state).includes('secret'));
  controller.offline = false; controller.balance = 0; await monitor.reconnect();
  display = view(monitor.state, 'ru'); assert.equal(display.primary.value, 0); assert.equal(display.primary.label, 'Баланс');
  controller.balance = null; await monitor.refresh(); assert.equal(view(monitor.state).primary.formatted, '—');
  const missingPrimary = { ...monitor.state, displaySchema: { ...monitor.state.displaySchema, primaryMetricId: 'absent' } };
  assert.equal(view(missingPrimary).primary, null, 'a missing primary cannot select an unrelated count');
});
test('snapshots exclude credentials and invalid values while preserving money and currency', () => {
  const state = snapshot({ account: { email: 'test@example.com', accessToken: 'private' }, accessToken: 'private', error: 'private',
    groups: [{ id: 'g', metrics: [{ id: 'a', type: 'money', value: 12.3456, currency: 'EUR', accessToken: 'private' },
      { id: 'b', type: 'percentage', value: Infinity }, { id: 'c', type: 'money', value: 20, currency: 'invalid' }] }],
    displaySchema: { script: 'private', groups: [{ id: 'g', metrics: [{ id: 'a', label: { en: '<text>' }, html: 'private' }] }] } });
  assert.equal(state.groups[0].metrics[0].value, 12.3456); assert.equal(state.groups[0].metrics[0].currency, 'EUR');
  assert.equal(state.groups[0].metrics[1].value, null); assert.equal(state.groups[0].metrics[2].value, null);
  assert.ok(!JSON.stringify(state).includes('private'));
  assert.match(format(state.groups[0].metrics[0], 'en'), /EUR/);
});
test('provider polling policy controls cadence and freshness; failed reconnects still become stale', async t => {
  const controller = new MoneyController(); controller.pollIntervalMs = 600000;
  const monitor = new Monitor(controller); t.after(() => monitor.stop());
  await monitor.refresh();
  assert.equal(monitor.state.interval, 600);
  assert.equal(isStale(monitor.state, monitor.state.updatedAt + 120000), false);
  controller.offline = true; await monitor.reconnect();
  assert.equal(monitor.state.error, 'refreshFailed'); assert.equal(isStale(monitor.state), true);
});
function storage(t) {
  const parent = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'providers-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), parent); assert.ok(path.basename(root).startsWith('providers-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
test('a new class and registry entry suffice for account orchestration and persisted provider selection', async t => {
  const root = storage(t);
  const providers = new ControllerRegistry().register('test-money', { create: options => new MoneyController(options) });
  const accounts = new Accounts({ root, registry: providers, initialProfiles: [{ id: 'default', providerId: 'test-money' }] });
  t.after(() => accounts.stop());
  const work = accounts.add('test-money'); accounts.selectProfile(work); accounts.rename(work, 'Wallet');
  await accounts.refresh();
  assert.equal(accounts.snapshot().providerId, 'test-money'); assert.equal(accounts.snapshot().profileId, work);
  assert.deepEqual(accounts.snapshot().providers, [{ id: 'test-money', name: 'test-money' }]);
  assert.equal(view(accounts.snapshot(), 'en').primary.value, 12.5);
  const restored = new Accounts({ root, registry: providers }); t.after(() => restored.stop());
  assert.equal(restored.selectedProfileId, work); assert.equal(restored.snapshot().displayName, 'Wallet');
  assert.equal(restored.profiles[1].providerId, 'test-money');
});
test('legacy profiles remain Codex; an unknown provider never invokes a factory or loads credentials', async t => {
  const root = storage(t); const unknown = '00000000-0000-4000-8000-000000000001';
  fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify({ selectedProfileId: unknown, profiles: [{ id: 'default', nickname: 'Old' }, { id: unknown, providerId: 'missing', nickname: 'Saved' }] }));
  let calls = 0;
  const accounts = new Accounts({ root, createMonitor(profile, options) { calls++; assert.equal(profile.providerId, 'codex'); return new Monitor(new MoneyController(options)); } });
  t.after(() => accounts.stop());
  assert.equal(calls, 1); assert.equal(accounts.profiles[0].providerId, 'codex');
  assert.equal(accounts.snapshot().providerId, 'missing'); assert.equal(accounts.snapshot().error, 'providerUnavailable');
  await accounts.refresh(); assert.equal(calls, 1); assert.equal(accounts.snapshot().account, null);
});
test('disconnect ignores a delayed monetary sample and removes controller subscriptions', async () => {
  const controller = new MoneyController(); const monitor = new Monitor(controller);
  let release; controller.gate = new Promise(resolve => { release = resolve; });
  const pending = monitor.refresh(); await new Promise(resolve => setImmediate(resolve));
  monitor.stop(); release(); await pending;
  assert.equal(monitor.state.updatedAt, null); assert.equal(controller.listenerCount('state'), 0); assert.equal(controller.listenerCount('refresh-requested'), 0);
});
test('Codex access checks and notifications cannot expose credentials or revive a disconnected account', async t => {
  const client = new EventEmitter(); client.start = async () => {}; client.stop = () => {};
  client.request = async method => method === 'account/read' ? { account: { type: 'chatgpt', email: 'test@example.com', accessToken: 'private' } } : { rateLimits: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1800000000 } } };
  const controller = new CodexController(client); const monitor = new Monitor(controller); t.after(() => monitor.stop());
  await controller.connect(); assert.equal((await controller.checkAccess()).status, 'ready'); await monitor.refresh();
  assert.equal(view(monitor.state).primary.value, 75); assert.equal(view(monitor.state).primary.resetsAt, 1800000000000);
  assert.ok(!JSON.stringify(monitor.state).includes('private'));
  assert.equal(controller.isSignInUrlAllowed('https://auth.openai.com/test'), true);
  for (const url of ['http://auth.openai.com', 'https://auth.openai.com.evil.test', 'https://evil.test']) assert.equal(controller.isSignInUrlAllowed(url), false);
  monitor.stop(); client.emit('notification', 'account/rateLimits/updated', { rateLimits: { primary: { usedPercent: 99, windowDurationMins: 300 } } });
  assert.equal(view(monitor.state).primary.value, 75); assert.equal(client.listenerCount('notification'), 0);
});
test('the native tray shows the monetary primary metric without percent thresholds', async t => {
  const controller = new MoneyController(); const monitor = new Monitor(controller); t.after(() => monitor.stop()); await monitor.refresh();
  class Tray extends EventEmitter { setImage(image) { this.image = image; } setToolTip(text) { this.tooltip = text; } setContextMenu() {} destroy() {} }
  const tray = new TrayPresentation({ Tray, Menu: { buildFromTemplate: value => value }, nativeImage: { createFromBuffer: buffer => ({ buffer }) }, appIcon: {}, platform: 'win32', onClick() {} });
  tray.update({ mode: 'tray', metricsState: monitor.state, language: 'en', menu: [] });
  assert.equal(tray.entries.length, 1); assert.match(tray.entries[0].tray.tooltip, /USD/); assert.doesNotMatch(tray.entries[0].tray.tooltip, /%/);
  assert.equal(tray.entries[0].image.buffer.readUInt32BE(16), 32);
  tray.destroy();
});
