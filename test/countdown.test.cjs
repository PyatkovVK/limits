const test = require('node:test');
const assert = require('node:assert/strict');
const { format } = require('../src/common/renderer/countdown.js');
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


test('compact days show days and hours, switching to hours:minutes below one day', () => {
  const ru = { compactDays: true, language: 'ru' }, en = { compactDays: true, language: 'en' };
  const reset = now / 1000 + (5 * 24 + 20) * 3600;
  assert.equal(format(reset, now, ru), '5д20ч');
  assert.equal(format(reset, now, en), '5d20h');
  assert.equal(format(now / 1000 + 86400, now, ru), '1д0ч');
  assert.equal(format(now / 1000 + 16 * 3600 + 39 * 60, now, ru), '16:39');
  assert.equal(format(now / 1000 + 23 * 3600 + 59 * 60, now, ru), '23:59');
  assert.equal(format(reset, now), '140:00', 'Other surfaces keep their existing format');
  assert.equal(format(now / 1000 - 1, now, ru), '0:00');
  for (const value of [null, undefined, 0, -1, NaN, Infinity, '123']) assert.equal(format(value, now, ru), '—');
});
