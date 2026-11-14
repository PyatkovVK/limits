const test = require('node:test');
const assert = require('node:assert/strict');
const { bitmap, png } = require('../tray/tray-icon.cjs');

test('icons distinguish unavailable quotas from zero and keep a complete 100% bar', () => {
  const unknown = bitmap(), zero = bitmap({ remaining: 0 }), full = bitmap({ remaining: 100 });
  assert.equal(unknown.label, '—'); assert.equal(zero.label, '0'); assert.equal(full.label, '100');
  const bar = result => [...Array(14)].map((_, x) => [...result.pixels.subarray((13 * 16 + x + 1) * 4, (13 * 16 + x + 1) * 4 + 3)]);
  assert.ok(bar(zero).every(pixel => pixel.join() === '75,75,75'));
  assert.ok(bar(full).every(pixel => pixel.join() === full.color.join()));
  assert.notDeepEqual(unknown.pixels, zero.pixels);
  for (const remaining of [null, NaN, -1, 0, 7, 27.2, 99, 100, 150]) {
    const data = png({ remaining, size: 32 });
    assert.equal(data.readUInt32BE(16), 32); assert.equal(data.readUInt32BE(20), 32);
  }
});
test('stale and low quotas use distinct colors; light theme numbers stay dark', () => {
  assert.deepEqual(bitmap({ remaining: 7 }).color, [255, 134, 134]);
  assert.deepEqual(bitmap({ remaining: 7, stale: true }).color, [145, 145, 145]);
  assert.notDeepEqual(bitmap({ remaining: 50, kind: 'short' }).color, bitmap({ remaining: 50, kind: 'weekly' }).color);
  assert.notDeepEqual(bitmap({ remaining: 50, dark: true }).pixels, bitmap({ remaining: 50, dark: false }).pixels);
});
