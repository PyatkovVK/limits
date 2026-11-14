'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Accounts } = require('../src/common/core/accounts.cjs');
const { registry } = require('../src/common/ai-connects/registry.cjs');
const { isStale } = require('../src/common/core/limits.cjs');
const { KimiController, USAGE_URL } = require('../src/common/ai-connects/kimi/controller.cjs');

test('the Claude status line supplies an isolated local sample with source timestamps', async t => {
  const artifacts = path.resolve(__dirname, '../artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const root = fs.mkdtempSync(path.join(artifacts, "claude 'test'-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const accounts = new Accounts({ root });
  t.after(() => accounts.stop());
  const id = accounts.add('claude');
  const { statusLine } = JSON.parse(accounts.setup(id));
  const monitor = accounts.monitors.get(id);
  await monitor.refresh();
  assert.equal(monitor.state.error, 'claudeWaitingForUsage');
  const run = input => {
    const result = spawnSync(statusLine.command, { shell: true, encoding: 'utf8', input: JSON.stringify(input) });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const reset = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(run({ rate_limits: {
    five_hour: { used_percentage: 100, resets_at: reset },
    seven_day: { used_percentage: 20, resets_at: reset - 7200 }
  }, session_id: 'private-session', cwd: 'private-path' }), '5h: 0% left');
  const sample = path.join(root, 'accounts', id, 'claude-quota.json');
  assert.doesNotMatch(fs.readFileSync(sample, 'utf8'), /private/);
  assert.equal(run({}), '');
  await monitor.refresh();
  accounts.selectProfile(id);
  const { updatedAt, buckets } = accounts.snapshot();
  assert.equal(buckets[0].short.remaining, 0);
  assert.equal(buckets[0].short.resetsAt, reset);
  assert.equal(buckets[0].weekly, null);
  await monitor.refresh();
  assert.equal(accounts.snapshot().updatedAt, updatedAt);
  assert.equal(isStale(accounts.snapshot(), updatedAt + 120000), true);

  const restored = new Accounts({ root });
  t.after(() => restored.stop());
  await restored.monitors.get(id).refresh();
  assert.equal(restored.snapshot().buckets[0].short.remaining, 0);
  await accounts.remove(id);
  assert.equal(fs.existsSync(sample), false);
});

test('Kimi prefers quota counters over inconsistent ratios and refreshes without exposing keys', async () => {
  const key = 'kimi-test-secret';
  const resetTime = new Date(Date.now() + 3600000).toISOString();
  let response = {
    usage: { limit: '100', used: '100', resetTime },
    limits: [{ window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' }, detail: { limit: '200', remaining: '155' } }],
    usages: { limit_5h: { used_ratio: 0, reset_time: resetTime }, limit_7d: { used_ratio: 0 } }
  };
  let status = 200;
  const controller = registry.create('kimi', {
    credentials: { read: () => key },
    fetch: async (url, options) => {
      assert.equal(url, USAGE_URL);
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, `Bearer ${key}`);
      return Response.json(response, { status });
    }
  });
  assert.ok(controller instanceof KimiController);
  await controller.refresh();
  const { updatedAt, buckets } = controller.state;
  assert.equal(buckets[0].short.remaining, 77.5);
  assert.equal(buckets[0].weekly.remaining, 0);
  assert.equal(buckets[0].short.resetsAt, Date.parse(resetTime) / 1000);
  assert.doesNotMatch(JSON.stringify(controller.state), /kimi-test-secret/);
  status = 403;
  await controller.refresh();
  assert.equal(controller.state.error, 'kimiQuotaRefreshFailed');
  assert.equal(controller.state.updatedAt, updatedAt);
  assert.equal(controller.state.buckets[0].weekly.remaining, 0);

  status = 200;
  response = { usages: { limit_5h: { used_ratio: 0.33, reset_time: 'invalid' } } };
  await controller.refresh();
  assert.equal(controller.state.buckets[0].short.remaining, 67);
  assert.equal(controller.state.buckets[0].short.resetsAt, null);
  assert.equal(controller.state.buckets[0].weekly, null);
  status = 401;
  await controller.refresh();
  assert.equal(controller.state.error, 'invalidApiKey');
  assert.deepEqual(controller.state.groups, []);
});
