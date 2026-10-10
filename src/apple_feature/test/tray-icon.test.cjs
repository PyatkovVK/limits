'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { menuBitmap, png } = require('../menu-image.cjs');

test('Mac indicators have separate period labels and Retina representations', () => {
  assert.equal(menuBitmap({ remaining: 72 }).label, '5h 72%');
  assert.equal(menuBitmap({ kind: 'weekly', remaining: 46 }).label, '7d 46%');
  for (const size of [16, 32, 48]) {
    const data = png({ remaining: 100, size });
    assert.equal(data.readUInt32BE(16), 64 * size / 16);
    assert.equal(data.readUInt32BE(20), 18 * size / 16);
  }
});
test('Mac progress distinguishes missing, zero, full, low and stale limits', () => {
  const missing = menuBitmap(), zero = menuBitmap({ remaining: 0 }), full = menuBitmap({ remaining: 100 });
  assert.notDeepEqual(missing.pixels, zero.pixels);
  const center = image => [...image.pixels.subarray((13 * image.width + 30) * 4, (13 * image.width + 30) * 4 + 4)];
  assert.equal(center(zero)[3], 45);
  assert.deepEqual(center(full), [...full.color, 255]);
  assert.notDeepEqual(menuBitmap({ remaining: 5 }).color, menuBitmap({ remaining: 50 }).color);
  assert.notDeepEqual(menuBitmap({ remaining: 50 }).color, menuBitmap({ remaining: 50, stale: true }).color);
});
