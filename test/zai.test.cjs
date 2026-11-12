'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ZaiClient, QUOTA_URL } = require('../src/common/ai-connects/zai/client.cjs');
const { ZaiController } = require('../src/common/ai-connects/zai/controller.cjs');
const { normalizeQuota } = require('../src/common/ai-connects/zai/quota.cjs');
const { Monitor } = require('../src/common/core/monitor.cjs');
const { isStale } = require('../src/common/core/limits.cjs');

const key = 'zai-fixture.secret';
const reset = 1793830124999;
const quota = { level: 'pro', limits: [
  { type: 'CREDIT_LIMIT', unit: 6, number: 1, usage: 60000, remaining: 0, percentage: 100, nextResetTime: reset },
  { type: 'TIME_LIMIT', unit: 5, number: 1, percentage: 9 },
  { type: 'CREDIT_LIMIT', unit: 3, number: 5, usage: 12000, remaining: 8646, percentage: 27 }
] };
const success = data => Response.json({ code: 200, success: true, data });
const noPlan = () => Response.json({ code: 500, success: false, msg: '当前用户不存在coding plan' });

test('Z.ai quota requests use the official plugin header and return only safe errors', async () => {
  const requests = [];
  const client = new ZaiClient({ fetch: async (...args) => { requests.push(args); return success(quota); } });
  assert.deepEqual(await client.quota(key), quota);
  const [[url, options]] = requests;
  assert.equal(url, QUOTA_URL);
  assert.equal(options.method, 'GET');
  assert.equal(options.headers.Authorization, key);
  assert.equal(options.redirect, 'error');
  await assert.rejects(client.quota('invalid\nkey'), { code: 'invalidApiKey' });
  assert.equal(requests.length, 1);

  for (const [response, code] of [
    [new Response(key, { status: 401 }), 'invalidApiKey'],
    [Response.json({ code: 403, success: false, msg: key }), 'invalidApiKey'],
    [noPlan(), 'codingPlanRequired'],
    [Response.json({ code: 500, success: false, msg: key }), 'quotaRefreshFailed'],
    [new Response(key, { status: 429 }), 'quotaRefreshFailed'],
    [new Response('not json'), 'quotaRefreshFailed']
  ]) {
    client.fetch = async () => response;
    await assert.rejects(client.quota(key), { code, message: code });
  }
});

test('Z.ai maps both windows by duration, preserves zero and leaves absent resets and windows unknown', () => {
  const [group] = normalizeQuota(quota).groups;
  assert.equal(group.plan, 'Pro');
  assert.deepEqual(group.metrics.map(({ id, value, resetsAt }) => ({ id, value, resetsAt })), [
    { id: 'short', value: 72.1, resetsAt: null },
    { id: 'weekly', value: 0, resetsAt: reset }
  ]);
  const legacy = normalizeQuota({ level: key, limits: [
    { type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 0, nextResetTime: key },
    { type: 'TOKENS_LIMIT', unit: 6, number: 1, percentage: 200 }
  ] }).groups[0];
  assert.equal(legacy.plan, null);
  assert.deepEqual(legacy.metrics.map(metric => [metric.value, metric.resetsAt]), [[100, null], [null, null]]);
  assert.throws(() => normalizeQuota({ limits: [] }), { code: 'quotaRefreshFailed' });
});

test('Z.ai polling keeps the previous sample on a failure and clears it when access is lost', async t => {
  let response = () => success(quota), requests = 0;
  const client = new ZaiClient({ fetch: async () => { requests++; return response(); } });
  const monitor = new Monitor(new ZaiController({ credentials: { read: () => key }, client }));
  t.after(() => monitor.stop());
  await Promise.all([monitor.refresh(), monitor.refresh()]);
  assert.equal(requests, 1);
  assert.equal(monitor.state.interval, 60);
  const { updatedAt } = monitor.state;
  assert.equal(monitor.state.buckets[0].weekly.resetsAt, reset / 1000);

  response = () => { throw new Error(key); };
  await monitor.refresh();
  assert.equal(isStale(monitor.state), true);
  assert.equal(monitor.state.updatedAt, updatedAt);
  assert.equal(monitor.state.buckets[0].short.remaining, 72.1);
  assert.ok(!JSON.stringify(monitor.state).includes(key));

  response = noPlan;
  await monitor.refresh();
  assert.equal(monitor.state.status, 'unsupported');
  assert.equal(monitor.state.error, 'codingPlanRequired');
  assert.equal(monitor.state.buckets.length, 0);
  assert.equal(monitor.state.updatedAt, null);
});
