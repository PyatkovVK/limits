const test = require('node:test');
const assert = require('node:assert/strict');
const { format } = require('../src/renderer/countdown.js');
const now = 1000000000000;
test('reset countdown uses server timestamp and counts down across hour/minute boundaries', () => {
  const resetsAt = now / 1000 + 8340;
  assert.equal(format(resetsAt, now), '2:19');
  assert.equal(format(resetsAt, now + 60000), '2:18');
  assert.equal(format(resetsAt, now + 4740000), '1:00');
  assert.equal(format(resetsAt, now + 4800000), '0:59');
});
test('last partial minute is shown until expiry and expired timestamps never go negative', () => {
  assert.equal(format(now / 1000 + 1, now), '0:01');
  assert.equal(format(now / 1000, now), '0:00');
  assert.equal(format(now / 1000 - 3600, now), '0:00');
});
test('absent or invalid reset times remain unknown', () => {
  for (const value of [null, undefined, 0, -1, NaN, Infinity, '123']) assert.equal(format(value, now), '—');
});
