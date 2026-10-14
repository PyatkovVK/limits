'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Updates, CHECK_INTERVAL, normalizeVersion, compareVersions, newestRelease, validatedReleaseUrl, fetchReleases } = require('../src/common/updates.cjs');
const release = tag => ({ tag_name: tag, draft: false, prerelease: false, html_url: `https://github.com/PyatkovVK/limits/releases/tag/${tag}` });
const response = (items, status = 200) => ({ ok: status === 200, status, json: async () => items });
function fixture(t, options = {}) {
  let time = 1000, requests = 0;
  const timers = new Set();
  const updates = new Updates({ currentVersion: '1.3.0', now: () => time,
    setTimer(fn, delay) { const timer = { fn, at: time + delay, unref() {} }; timers.add(timer); return timer; },
    clearTimer(timer) { timers.delete(timer); },
    fetchImpl: async () => { requests++; return response([release('v1.3')]); }, ...options });
  t.after(() => updates.stop());
  return { updates, timers, requests: () => requests, time: () => time,
    jump(value) { time = value; },
    async fire(value) {
      time = value;
      for (const timer of [...timers].filter(timer => timer.at <= time)) { timers.delete(timer); timer.fn(); }
      if (updates.pending) await updates.pending;
    },
  };
}

test('versions normalize tags, compare numerically and reject non-stable or ambiguous strings', () => {
  assert.equal(normalizeVersion('v1.3'), '1.3.0');
  assert.equal(normalizeVersion('1.3.0'), '1.3.0');
  assert.equal(compareVersions('v1.3', '1.3.0'), 0);
  assert.equal(compareVersions('1.10', '1.9.99'), 1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.3.1', '1.3'), 1);
  for (const value of ['1', '01.3', '1.3-beta', 'v1.3.0+build', '1.3.0.1', '1.3\n', '9007199254740992.0', null, 13]) assert.equal(normalizeVersion(value), null);
  assert.throws(() => compareVersions('invalid', '1.3'), /invalidVersion/);
});

test('selection finds the highest stable version even when release publication order differs', () => {
  const selected = newestRelease([release('v1.3'), { ...release('v9.0'), draft: true }, { ...release('v8.0'), prerelease: true },
    release('v1.10'), release('v1.9'), release('v2.0-beta'), null]);
  assert.equal(selected.version, '1.10.0');
  assert.equal(selected.url, 'https://github.com/PyatkovVK/limits/releases/tag/v1.10');
  assert.throws(() => newestRelease([]), /noRelease/);
  assert.throws(() => newestRelease({ tag: '1.3' }), /invalidResponse/);
});

test('release opening rejects other hosts, repositories, protocols and unexpected URL components', () => {
  for (const url of ['http://github.com/PyatkovVK/limits/releases/tag/v1.4', 'https://github.com.evil.test/PyatkovVK/limits/releases/tag/v1.4',
    'https://github.com/PyatkovVK/other/releases/tag/v1.4', 'https://github.com/PyatkovVK/limits/releases/tag/v1.5',
    'https://user@github.com/PyatkovVK/limits/releases/tag/v1.4', 'https://github.com:8443/PyatkovVK/limits/releases/tag/v1.4',
    'https://github.com/PyatkovVK/limits/releases/tag/v1.4?next=evil', 'https://github.com/PyatkovVK/limits/releases/tag/v1.4#x', 'file:///tmp/release']) {
    assert.throws(() => validatedReleaseUrl(url, 'v1.4'), /invalidResponse/);
  }
  assert.throws(() => newestRelease([{ ...release('v1.4'), html_url: 'https://evil.test' }]), /invalidResponse/);
});

test('release API pagination keeps requests anonymous and reads newer versions on later pages', async () => {
  const calls = [];
  const items = await fetchReleases({ signal: new AbortController().signal, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return response(calls.length === 1 ? Array.from({ length: 100 }, () => release('v1.0')) : [release('v1.10')]);
  } });
  assert.equal(newestRelease(items).version, '1.10.0');
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /per_page=100&page=2$/);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await assert.rejects(fetchReleases({ signal: new AbortController().signal, fetchImpl: async () => response(Array(100).fill(release('v1.0'))) }), /invalidResponse/);
});

test('startup checks immediately, repeats at six hours, and stops all scheduling on quit', async t => {
  const f = fixture(t);
  const initial = f.updates.start();
  assert.equal(f.updates.snapshot().status, 'checking');
  await initial;
  assert.equal(f.requests(), 1);
  assert.equal(f.updates.snapshot().status, 'current');
  await f.fire(1000 + CHECK_INTERVAL - 1); assert.equal(f.requests(), 1);
  await f.fire(1000 + CHECK_INTERVAL); assert.equal(f.requests(), 2);
  assert.equal(f.updates.snapshot().checkedAt, f.time());
  f.updates.stop(); assert.equal(f.timers.size, 0);
  await f.updates.check(); assert.equal(f.requests(), 2);
});

test('resume checks only when overdue and does not replay missed intervals', async t => {
  const f = fixture(t);
  await f.updates.start();
  f.jump(1001); await f.updates.resume(); assert.equal(f.requests(), 1);
  f.jump(1000 + CHECK_INTERVAL * 4); await f.updates.resume(); assert.equal(f.requests(), 2);
  await f.updates.resume(); assert.equal(f.requests(), 2);
  await f.fire(f.time() + CHECK_INTERVAL); assert.equal(f.requests(), 3);
});

test('manual checks share startup and overdue resume requests without duplicating network work', async t => {
  let resolve, requests = 0;
  const f = fixture(t, { fetchImpl: () => { requests++; return new Promise(done => { resolve = done; }); } });
  const first = f.updates.start();
  const manual = f.updates.check(); assert.equal(first, manual);
  await Promise.resolve();
  f.jump(1000 + CHECK_INTERVAL * 2);
  assert.equal(f.updates.resume(), first);
  assert.equal(requests, 1);
  resolve(response([release('v1.4')])); await first;
  assert.equal(f.updates.snapshot().release.version, '1.4.0');
});

test('timeouts abort hung requests, remain errors and allow retry', async t => {
  const f = fixture(t, { timeout: 50, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) });
  const pending = f.updates.start(); await Promise.resolve();
  await f.fire(1050); await pending;
  assert.equal(f.updates.snapshot().status, 'error'); assert.equal(f.updates.snapshot().error, 'timeout');
  assert.equal(f.updates.snapshot().release, null);
  f.updates.fetchImpl = async () => response([release('v1.3')]);
  await f.updates.check(); assert.equal(f.updates.snapshot().status, 'current');
});

test('API limits, offline failures, invalid metadata and missing releases are not reported as current', async t => {
  for (const [fetchImpl, error] of [
    [async () => response([], 403), 'rateLimited'], [async () => response([], 429), 'rateLimited'],
    [async () => { throw new Error('private network details'); }, 'checkFailed'],
    [async () => response({ error: 'invalid' }), 'invalidResponse'], [async () => response([]), 'noRelease'],
    [async () => ({ ok: true, json: async () => { throw new Error('malformed JSON'); } }), 'checkFailed'],
  ]) {
    const { updates } = fixture(t, { fetchImpl }); await updates.check();
    assert.equal(updates.snapshot().status, 'error'); assert.equal(updates.snapshot().error, error);
  }
});

test('equal and older releases are never offered', async t => {
  for (const tag of ['v1.3', 'v1.3.0', 'v1.2.99']) {
    const { updates } = fixture(t, { fetchImpl: async () => response([release(tag)]) });
    await updates.check(); assert.equal(updates.snapshot().status, 'current'); assert.equal(updates.snapshot().offer, null);
  }
});

test('dismissal persists across checks and restarts while newer releases are offered', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-updates-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('limits-updates-')); fs.rmSync(root, { recursive: true, force: true }); });
  const fetchImpl = async () => response([release('v1.4')]);
  const { updates } = fixture(t, { root, fetchImpl });
  await updates.check(); assert.equal(updates.snapshot().offer.version, '1.4.0');
  assert.deepEqual(updates.dismiss('9.0.0'), { error: 'unavailable' });
  updates.dismiss('1.4.0'); await updates.check();
  assert.equal(updates.snapshot().offer, null); assert.equal(updates.snapshot().release.version, '1.4.0');
  const restored = fixture(t, { root, fetchImpl }).updates;
  await restored.check(); assert.equal(restored.snapshot().offer, null);
  restored.fetchImpl = async () => response([release('v1.5')]);
  await restored.check(); assert.equal(restored.snapshot().offer.version, '1.5.0');
  fs.writeFileSync(path.join(root, 'update-settings.json'), '{corrupt');
  const repaired = fixture(t, { root, fetchImpl }).updates;
  await repaired.check(); assert.equal(repaired.snapshot().offer.version, '1.4.0');
});

test('the release action opens only stored validated metadata and handles browser failures', async t => {
  const opened = [];
  const { updates } = fixture(t, { fetchImpl: async () => response([release('v1.4')]), openExternal: async url => { opened.push(url); } });
  assert.deepEqual(await updates.openRelease(), { error: 'unavailable' });
  await updates.check();
  const snapshot = updates.snapshot(); snapshot.release.url = 'https://evil.test';
  assert.deepEqual(await updates.openRelease(), { opened: true, simulated: false });
  assert.deepEqual(opened, [release('v1.4').html_url]); assert.equal(updates.snapshot().offer, null);
  updates.state.release.url = 'https://evil.test';
  assert.deepEqual(await updates.openRelease(), { error: 'openFailed' }); assert.equal(opened.length, 1);
  await updates.check(); updates.openExternal = async () => { throw new Error('browser missing'); };
  assert.deepEqual(await updates.openRelease(), { error: 'openFailed' });
  assert.deepEqual(updates.setDemoScenario('available'), { error: 'unavailable' });
});

test('quitting cancels an in-flight request without late state changes', async t => {
  let signal, changes = 0;
  const { updates, timers } = fixture(t, { fetchImpl: (_url, options) => {
    signal = options.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  updates.on('state', () => changes++);
  const pending = updates.start(); await Promise.resolve();
  updates.stop(); await pending;
  assert.equal(signal.aborted, true); assert.equal(changes, 1); assert.equal(timers.size, 0);
});

test('demo simulates every state and release opening without network or browser access', async t => {
  const f = fixture(t, { demo: true, fetchImpl: () => assert.fail('Demo contacted GitHub'), openExternal: () => assert.fail('Demo opened browser') });
  let pending = f.updates.start(); await Promise.resolve(); await f.fire(1300); await pending;
  assert.equal(f.updates.snapshot().status, 'current');
  pending = f.updates.setDemoScenario('available'); await Promise.resolve(); await f.fire(1600); await pending;
  assert.equal(f.updates.snapshot().status, 'available'); assert.equal(f.updates.snapshot().offer.version, '1.4.0');
  assert.deepEqual(await f.updates.openRelease(), { opened: true, simulated: true });
  pending = f.updates.setDemoScenario('error'); await Promise.resolve(); await f.fire(1900); await pending;
  assert.equal(f.updates.snapshot().status, 'error');
});
