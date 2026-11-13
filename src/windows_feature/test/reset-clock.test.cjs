'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { format } = require('../renderer/reset-clock.js');

test('Windows reset clocks distinguish today, tomorrow and weekly dates in local time', () => {
  const now = new Date(2026, 9, 26, 23, 30).getTime();
  assert.equal(format(new Date(2026, 9, 26, 23, 55).getTime() / 1000, 'ru', now), '23:55');
  assert.equal(format(new Date(2026, 9, 27, 1, 5).getTime() / 1000, 'ru', now), '27.10 01:05');
  assert.equal(format(new Date(2026, 10, 2, 18, 0).getTime() / 1000, 'en', now), '02/11 18:00');
  for (const value of [null, undefined, NaN, Infinity, -1, 0, 1e20, '123']) assert.equal(format(value), '—');
});
