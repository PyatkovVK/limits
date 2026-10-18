'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ResetNotifications, parseStatus, CHECK_INTERVAL, STATUS_API, LINKS } = require('../src/common/reset-notifications.cjs');
const { words, eventText } = require('../src/common/renderer/reset-strings.js');
const NOW = Date.UTC(2026, 9, 18, 12);
const iso = delta => new Date(NOW + delta).toISOString();
const scheduled = (overrides = {}) => ({ id: 'announced-reset', status: 'scheduled', reset_type: 'regular', announced_at: iso(-60000), scheduled_for: iso(3600000), ...overrides });
const watch = (overrides = {}) => ({ level: 'strong', reset_chance_percent: 80, observed_at: iso(-60000), expires_at: iso(CHECK_INTERVAL * 4), ...overrides });
const status = (scheduledReset = null, activeWatch = null) => ({ meta: { api_version: 'v1' }, data: {
  latest_reset: { id: 'completed-reset', announced_at: iso(-1000) }, scheduled_reset: scheduledReset, active_watch: activeWatch,
} });
const response = (value, code = 200) => ({ ok: code === 200, status: code, json: async () => value });
function fixture(t, options = {}) {
  let now = NOW, calls = [];
  const events = [], timers = new Set();
  const service = new ResetNotifications({ now: () => now,
    setTimer(fn, delay) { const timer = { fn, at: now + delay, unref() {} }; timers.add(timer); return timer; },
    clearTimer(timer) { timers.delete(timer); },
    fetchImpl: async (url, settings) => { calls.push({ url, settings }); return response(status()); },
    notify: event => { events.push(event); return true; }, ...options });
  t.after(() => service.stop());
  return { service, events, timers, calls,
    jump(time) { now = time; },
    async enable() { await service.start(); service.setEnabled(true); if (service.pending) await service.pending; },
    async fire(time) {
      now = time;
      for (const timer of [...timers].filter(timer => timer.at <= now)) { timers.delete(timer); timer.fn(); }
      if (service.pending) await service.pending;
    },
  };
}
function storage(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-reset-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('limits-reset-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

test('reset integration is off by default and never requests or schedules work while disabled', async t => {
  const f = fixture(t);
  await f.service.start(); await f.service.check();
  f.jump(NOW + CHECK_INTERVAL * 4); await f.service.resume();
  assert.equal(f.service.snapshot().enabled, false);
  assert.equal(f.service.snapshot().status, 'disabled');
  assert.equal(f.calls.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.events.length, 0);
  assert.equal(f.service.setEnabled('true').actionError, 'unavailable');
  assert.equal(f.service.snapshot().enabled, false);
});

test('API parser uses only upcoming announcements and active forecasts, never completed resets or remote content', () => {
  const parsed = parseStatus(status(scheduled(), watch()), NOW);
  assert.equal(parsed.scheduled.resetType, 'regular'); assert.equal(parsed.watch.chance, 80);
  assert.deepEqual(Object.keys(parsed), ['scheduled', 'watch']);
  assert.equal(JSON.stringify(parsed).includes('completed-reset'), false);
  assert.equal(JSON.stringify(parsed).includes('source'), false);
  assert.deepEqual(parseStatus(status(null, null), NOW), { scheduled: null, watch: null });
  assert.deepEqual(parseStatus(status(scheduled({ scheduled_for: iso(-1000) }), watch({ expires_at: iso(-1000) })), NOW), { scheduled: null, watch: null });
  assert.equal(parseStatus(status(scheduled({ scheduled_for: null, reset_type: 'banked' })), NOW).scheduled.scheduledFor, null);
  assert.equal(parseStatus(status(null, watch({ reset_chance_percent: null })), NOW).watch.chance, null);
  assert.equal(parseStatus(status(null, watch({ reset_chance_percent: 0 })), NOW).watch.chance, 0);
});

test('malformed or incomplete API data cannot create a reset alert', () => {
  for (const value of [null, {}, { data: {} }, { meta: { api_version: 'v2' }, data: status().data },
    { ...status(), data: { active_watch: null } }, status({}), status(scheduled({ id: '../injected' })),
    status(scheduled({ announced_at: 'bad' })), status(scheduled({ announced_at: iso(60000) })),
    status(scheduled({ scheduled_for: iso(-120000) })), status(scheduled({ reset_type: 'unknown' })),
    status(null, watch({ level: 'confirmed' })), status(null, watch({ reset_chance_percent: 101 })),
    status(null, watch({ reset_chance_percent: 0.5 })), status(null, watch({ expires_at: 'bad' }))]) {
    assert.throws(() => parseStatus(value, NOW), /invalidResponse/);
  }
});

test('enabling checks immediately and scheduled resets take precedence over forecasts without repeated alerts', async t => {
  const f = fixture(t, { fetchImpl: async () => response(status(scheduled(), watch())) });
  await f.enable();
  assert.deepEqual(f.events.map(event => event.kind), ['scheduled']);
  for (let index = 0; index < 3; index++) await f.service.check();
  assert.equal(f.events.length, 1);
  assert.equal(f.service.snapshot().scheduled.scheduledFor, NOW + 3600000);
  f.service.fetchImpl = async () => response(status(scheduled({ id: 'another-reset' })));
  await f.service.check(); assert.equal(f.events.length, 2);
});

test('active forecasts notify once even when probability or strength changes; expired forecasts are silent', async t => {
  let chance = 60, level = 'elevated';
  const f = fixture(t, { fetchImpl: async () => response(status(null, watch({ reset_chance_percent: chance, level }))) });
  await f.enable(); assert.equal(f.events.length, 1); assert.equal(f.events[0].kind, 'forecast');
  chance = 90; level = 'strong';
  await f.service.check(); assert.equal(f.events.length, 1);
  assert.equal(f.service.snapshot().watch.chance, 90);
  f.jump(NOW + CHECK_INTERVAL * 5);
  assert.equal(f.service.snapshot().watch, null);
  await f.service.check(); assert.equal(f.events.length, 1);
  assert.equal(f.service.snapshot().watch, null);
});

test('completed reset changes never notify, including the first check, subsequent checks and restarts', async t => {
  const f = fixture(t);
  await f.enable();
  f.service.fetchImpl = async () => response({ ...status(), data: { ...status().data, latest_reset: { id: 'another-completed-reset' } } });
  await f.service.check();
  assert.equal(f.events.length, 0);
  assert.deepEqual(parseStatus({ ...status(), data: { ...status().data, latest_reset: 'ignored-completed-data' } }, NOW), { scheduled: null, watch: null });
  assert.equal(f.service.snapshot().status, 'ready');
});

test('six-hour scheduling and overdue resume share one request and stop when disabled', async t => {
  const f = fixture(t); await f.enable();
  assert.equal(f.calls.length, 1);
  await f.fire(NOW + CHECK_INTERVAL - 1); assert.equal(f.calls.length, 1);
  await f.fire(NOW + CHECK_INTERVAL); assert.equal(f.calls.length, 2);
  f.jump(NOW + CHECK_INTERVAL * 5);
  const pending = f.service.resume();
  assert.equal(f.service.resume(), pending);
  await pending; assert.equal(f.calls.length, 3);
  await f.service.resume(); assert.equal(f.calls.length, 3);
  f.service.setEnabled(false);
  assert.equal(f.timers.size, 0);
  await f.fire(NOW + CHECK_INTERVAL * 6); await f.service.resume();
  assert.equal(f.calls.length, 3);
});

test('requests are anonymous, fixed to the public status endpoint, and omit cookies and redirects', async t => {
  const f = fixture(t); await f.enable();
  const { url, settings } = f.calls[0];
  assert.equal(url, STATUS_API); assert.equal(settings.credentials, 'omit'); assert.equal(settings.redirect, 'error');
  assert.deepEqual(settings.headers, { Accept: 'application/json', 'User-Agent': 'Limits-reset-notifications' });
  assert.ok(settings.signal instanceof AbortSignal);
});

test('turning off immediately prevents a queued fetch and cancels an in-flight response without alerts', async t => {
  const f = fixture(t); await f.service.start();
  f.service.setEnabled(true); const queued = f.service.pending;
  f.service.setEnabled(false); await queued;
  assert.equal(f.calls.length, 0);
  let finish, signal;
  f.service.fetchImpl = (_url, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); };
  f.service.setEnabled(true); const pending = f.service.pending; await Promise.resolve();
  f.service.setEnabled(false); assert.equal(signal.aborted, true);
  finish(response(status(scheduled()))); await pending;
  assert.equal(f.events.length, 0); assert.equal(f.service.snapshot().status, 'disabled');
  assert.equal(f.timers.size, 0);
});

test('re-enabling cannot let a cancelled request overwrite a fresh response or clear its pending check', async t => {
  let finishOld;
  const f = fixture(t, { fetchImpl: () => new Promise(resolve => { finishOld = resolve; }) });
  await f.service.start(); f.service.setEnabled(true); const old = f.service.pending; await Promise.resolve();
  f.service.setEnabled(false);
  f.service.fetchImpl = async () => response(status(null, watch()));
  f.service.setEnabled(true); const fresh = f.service.pending;
  finishOld(response(status(scheduled())));
  await Promise.all([old, fresh]);
  assert.deepEqual(f.events.map(event => event.kind), ['forecast']);
  assert.equal(f.service.snapshot().scheduled, null); assert.equal(f.service.snapshot().status, 'ready');
  assert.equal(f.service.pending, null);
});

test('timeout also handles a fetch that ignores AbortSignal, and errors remain retryable', async t => {
  const f = fixture(t, { timeout: 50, fetchImpl: () => new Promise(() => {}) });
  await f.service.start(); f.service.setEnabled(true); const pending = f.service.pending; await Promise.resolve();
  await f.fire(NOW + 50); await pending;
  assert.equal(f.service.snapshot().error, 'timeout');
  assert.equal(f.service.snapshot().status, 'error');
  f.service.fetchImpl = async () => response(status());
  await f.service.check(); assert.equal(f.service.snapshot().status, 'ready'); assert.equal(f.service.snapshot().error, null);
});

test('HTTP, JSON, schema and network failures are safe and do not turn into false reset notifications', async t => {
  for (const [fetchImpl, error] of [
    [async () => response({}, 429), 'rateLimited'], [async () => response({}, 503), 'checkFailed'],
    [async () => { throw new Error('private network details'); }, 'checkFailed'],
    [async () => response({}), 'invalidResponse'],
    [async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } }), 'checkFailed'],
  ]) {
    const f = fixture(t, { fetchImpl }); await f.enable();
    assert.equal(f.service.snapshot().status, 'error'); assert.equal(f.service.snapshot().error, error);
    assert.equal(f.events.length, 0); assert.equal(JSON.stringify(f.service.snapshot()).includes('private'), false);
  }
});

test('enabled choice and deduplication survive restart; missing, invalid and corrupt choices default to off', async t => {
  const root = storage(t), file = path.join(root, 'reset-notifications.json');
  const first = fixture(t, { root, fetchImpl: async () => response(status(scheduled())) }); await first.enable();
  assert.equal(first.events.length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { enabled: true, seen: ['scheduled:announced-reset'] });
  first.service.stop();
  const next = fixture(t, { root, fetchImpl: async () => response(status(scheduled())) }); await next.service.start();
  assert.equal(next.service.snapshot().enabled, true); assert.equal(next.events.length, 0);
  next.service.setEnabled(false);
  assert.equal(fixture(t, { root }).service.snapshot().enabled, false);
  for (const content of ['{bad json', '{"enabled":"true"}', '{"enabled":1,"seen":null}']) {
    fs.writeFileSync(file, content);
    const f = fixture(t, { root }); await f.service.start(); assert.equal(f.service.snapshot().enabled, false); assert.equal(f.calls.length, 0);
  }
});

test('a preference storage failure leaves notifications off and never starts networking', async t => {
  const root = storage(t), invalidRoot = path.join(root, 'file'); fs.writeFileSync(invalidRoot, 'not a directory');
  const f = fixture(t, { root: invalidRoot }); await f.service.start();
  assert.equal(f.service.setEnabled(true).actionError, 'saveFailed');
  assert.equal(f.service.snapshot().enabled, false); assert.equal(f.calls.length, 0);
});

test('notification failure is visible and permits retry rather than permanently swallowing the event', async t => {
  const f = fixture(t, { fetchImpl: async () => response(status(scheduled())), notify: () => false }); await f.enable();
  assert.equal(f.service.snapshot().notificationError, 'notificationFailed'); assert.equal(f.service.seen.size, 0);
  f.service.notify = () => true; await f.service.check(); assert.equal(f.service.seen.size, 1);
  f.service.deliveryFailed('scheduled:announced-reset'); assert.equal(f.service.seen.size, 0);
  assert.equal(f.service.snapshot().notificationError, 'notificationFailed');
});

test('demo simulates forecasts, announcements, failures and links with zero real side effects', async t => {
  const root = storage(t);
  const f = fixture(t, { root, demo: true, fetchImpl: () => assert.fail('No demo network'), notify: () => assert.fail('No demo OS notification'), openExternal: () => assert.fail('No demo browser') });
  const events = []; f.service.on('notification', value => events.push(value));
  await f.enable();
  await f.service.setDemoScenario('scheduled'); await f.service.setDemoScenario('forecast');
  assert.deepEqual(events.map(event => event.kind), ['scheduled', 'forecast']);
  await f.service.setDemoScenario('error'); assert.equal(f.service.snapshot().error, 'checkFailed');
  await f.service.setDemoScenario('quiet'); assert.equal(f.service.snapshot().watch, null);
  assert.deepEqual(await f.service.openLink('site'), { opened: true, simulated: true });
  assert.equal(fs.existsSync(path.join(root, 'reset-notifications.json')), false);
});

test('link actions accept only the fixed site and author, never API-supplied or renderer-supplied URLs', async t => {
  const urls = [], f = fixture(t, { openExternal: async url => { urls.push(url); } });
  for (const kind of ['site', 'author']) assert.equal((await f.service.openLink(kind)).opened, true);
  assert.deepEqual(urls, [LINKS.site, LINKS.author]);
  for (const input of ['https://evil.test', 'file:///C:/', '__proto__', 'constructor', '', null]) assert.equal((await f.service.openLink(input)).error, 'unavailable');
  assert.equal(urls.length, 2);
  f.service.stop(); assert.equal((await f.service.openLink('site')).error, 'unavailable');
});

test('notification language distinguishes a forecast from a confirmed announcement and credits the integration', () => {
  for (const language of ['ru', 'en']) {
    const t = words[language], future = parseStatus(status(scheduled(), watch()), NOW);
    assert.ok(eventText(future.scheduled, language).includes(t.scheduled));
    assert.ok(eventText(future.watch, language).includes(t.forecastHint));
    assert.ok(eventText(future.watch, language).includes('80%'));
    assert.ok(t.description.includes('codex-resets.com')); assert.ok(t.description.includes('6'));
    assert.equal(eventText({ ...future.watch, chance: null }, language).includes('null'), false);
  }
});

test('quitting aborts pending work without late state updates, alerts or timers', async t => {
  const f = fixture(t, { fetchImpl: () => new Promise(() => {}) });
  await f.service.start(); f.service.setEnabled(true); const pending = f.service.pending; await Promise.resolve();
  let updates = 0; f.service.on('state', () => updates++);
  f.service.stop(); await pending;
  assert.equal(updates, 0); assert.equal(f.events.length, 0); assert.equal(f.timers.size, 0);
});
