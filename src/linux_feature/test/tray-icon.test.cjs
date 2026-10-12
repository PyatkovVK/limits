const test = require('node:test');
const assert = require('node:assert/strict');
const { bitmap, png } = require('../tray-icon.cjs');
const { createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { TrayPresentation } = require('../../common/tray.cjs');

test('classic pixels match the archived 1.0.0 Linux renderer exactly', () => {
  const digest = createHash('sha256');
  for (const size of [16, 20, 24, 40]) for (const kind of ['short', 'weekly']) for (const remaining of [null, 0, 7, 53, 100]) for (const stale of [false, true]) {
    digest.update(bitmap({ size, kind, remaining, stale, style: 'classic' }).pixels);
  }
  assert.equal(digest.digest('hex'), '0e0e4ad400c17229cb4f75d22d06efdbe4ab298ce42958feefb07b6d7cfcbf96');
});
test('bar icons put the fixed period above a proportional bar and distinguish unavailable values', () => {
  for (const [language, labels] of [['ru', ['5ч', '7д']], ['en', ['5h', '7d']]]) for (const [index, kind] of ['short', 'weekly'].entries()) {
    const bar = bitmap({ style: 'bar', kind, remaining: 50, language });
    assert.equal(bar.label, labels[index]);
    for (let x = 2; x < 18; x++) {
      const offset = (16 * 20 + x) * 4;
      assert.deepEqual([...bar.pixels.subarray(offset, offset + 3)], x < 10 ? bar.color : [91, 102, 114]);
    }
    assert.notDeepEqual(bar.pixels, bitmap({ kind, remaining: 50 }).pixels);
    assert.notDeepEqual(bitmap({ style: 'bar', remaining: null, stale: true }).pixels, bitmap({ style: 'bar', remaining: 0, stale: true }).pixels);
  }
});
test('switching Linux styles updates both existing tray icons without recreating them', () => {
  class Tray extends EventEmitter {
    constructor(image) { super(); this.image = image; this.updates = 0; }
    setImage(image) { this.image = image; this.updates++; }
    setToolTip() {} setContextMenu() {}
  }
  const view = new TrayPresentation({ Tray, Menu: { buildFromTemplate: () => [] }, nativeImage: { createFromBuffer(buffer) { return { buffer, addRepresentation() {} }; } }, platform: 'linux', onClick() {} });
  const state = { mode: 'tray', bucket: { short: { remaining: 53 }, weekly: { remaining: 53 } }, language: 'ru', menu: [] };
  view.update(state);
  const trays = view.entries.map(entry => entry.tray), classic = trays.map(tray => tray.image.buffer);
  view.update({ ...state, linuxTrayStyle: 'bar' });
  assert.deepEqual(view.entries.map(entry => entry.tray), trays);
  trays.forEach((tray, i) => assert.notDeepEqual(tray.image.buffer, classic[i]));
  const updates = trays.map(tray => tray.updates);
  view.update({ ...state, linuxTrayStyle: 'bar' });
  assert.deepEqual(trays.map(tray => tray.updates), updates);
  view.update({ ...state, linuxTrayStyle: 'classic' });
  trays.forEach((tray, i) => assert.deepEqual(tray.image.buffer, classic[i]));
});

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
