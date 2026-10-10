const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLimits, selectedBucket, windowView, isStale } = require('../src/limits.cjs');
const win = (usedPercent, windowDurationMins) => ({ usedPercent, windowDurationMins, resetsAt: 1800000000 });

test('prefers multi-bucket response over legacy and selects Codex', () => {
  const buckets = normalizeLimits({ rateLimits: { primary: win(99, 300) }, rateLimitsByLimitId: { other: { primary: win(3, 300) }, codex: { primary: win(28, 300), secondary: win(54, 10080) } } });
  const bucket = selectedBucket({ buckets });
  assert.equal(bucket.id, 'codex'); assert.equal(bucket.short.remaining, 72); assert.equal(bucket.weekly.remaining, 46);
});
test('uses duration rather than primary/secondary position', () => {
  const [bucket] = normalizeLimits({ rateLimits: { primary: win(7, 10080), secondary: win(21, 300) } });
  assert.equal(bucket.short.remaining, 79); assert.equal(bucket.weekly.remaining, 93);
});
test('missing and invalid values are unavailable, never zero or 100', () => {
  const [bucket] = normalizeLimits({ rateLimits: { primary: win(null, 300) } });
  assert.equal(bucket.short.remaining, null); assert.equal(bucket.weekly.remaining, null);
  assert.equal(windowView({ usedPercent: NaN }).remaining, null);
  assert.equal(windowView({ usedPercent: '12' }).remaining, null);
  assert.deepEqual(normalizeLimits(null), []);
});
test('clamps percentages and preserves precision', () => {
  assert.equal(windowView(win(101, 300)).remaining, 0);
  assert.equal(windowView(win(-5, 300)).remaining, 100);
  assert.equal(windowView(win(25.25, 300)).remaining, 74.8);
});
test('other durations do not get mislabeled as five hours', () => {
  const [bucket] = normalizeLimits({ rateLimits: { primary: win(25, 60) } });
  assert.equal(bucket.short.remaining, null); assert.equal(bucket.other[0].remaining, 75);
});
test('staleness includes errors, absent timestamps and elapsed time', () => {
  assert.equal(isStale({ updatedAt: 1000 }, 91001), true);
  assert.equal(isStale({ updatedAt: 1000 }, 5000), false);
  assert.equal(isStale({ updatedAt: 1000, error: 'offline' }, 5000), true);
  assert.equal(isStale({}), true);
});
