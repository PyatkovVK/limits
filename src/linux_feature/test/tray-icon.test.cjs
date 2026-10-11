const test = require('node:test');
const assert = require('node:assert/strict');
const { bitmap, png } = require('../tray-icon.cjs');

test('Linux badges stay separated and readable when GTK and panel themes differ', () => {
  const dark = bitmap({ remaining: 53, dark: true });
  const light = bitmap({ remaining: 53, dark: false });
  assert.deepEqual(dark.pixels, light.pixels);
  for (const size of [16, 20, 24, 32, 40, 48, 60]) {
    const { pixels } = bitmap({ remaining: 53, size });
    for (let y = 0; y < size; y++) {
      assert.equal(pixels[(y * size) * 4 + 3], 0);
      assert.equal(pixels[(y * size + size - 1) * 4 + 3], 0);
    }
  }
  function luminance(rgb) {
    return rgb.map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((total, channel, i) => total + channel * [0.2126, 0.7152, 0.0722][i], 0);
  }
  for (const kind of ['short', 'weekly']) {
    const badge = bitmap({ kind, remaining: 53 });
    assert.ok((luminance([250, 252, 255]) + 0.05) / (luminance(badge.surface) + 0.05) >= 7);
  }
});

test('equal and stale Linux quotas remain distinguishable by period', () => {
  for (const remaining of [null, 0, 7, 53, 100]) for (const stale of [false, true]) {
    const short = bitmap({ kind: 'short', remaining, stale });
    const weekly = bitmap({ kind: 'weekly', remaining, stale });
    assert.notEqual(short.period, weekly.period);
    assert.notDeepEqual(short.pixels, weekly.pixels);
  }
  assert.notDeepEqual(bitmap({ remaining: null }).pixels, bitmap({ remaining: 0 }).pixels);
  assert.notDeepEqual(bitmap({ remaining: 7 }).color, bitmap({ remaining: 53 }).color);
  assert.notDeepEqual(bitmap({ remaining: 7 }).color, bitmap({ remaining: 7, stale: true }).color);
  for (const remaining of [null, NaN, -1, 0, 99, 100, 150]) {
    const encoded = png({ remaining, size: 40 });
    assert.equal(encoded.readUInt32BE(16), 40);
    assert.equal(encoded.readUInt32BE(20), 40);
  }
});
