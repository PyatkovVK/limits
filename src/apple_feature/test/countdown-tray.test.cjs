'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { menuBitmap, png } = require('../tray-icon.cjs');
const now = 1700000000000;
test('5h menu indicator includes a readable hours/minutes timer at every Retina scale', () => {
  const options = { remaining: 72, resetsAt: now / 1000 + 2 * 3600 + 20 * 60, now };
  assert.equal(menuBitmap(options).countdown, '2:20');
  assert.notDeepEqual(menuBitmap(options).pixels, menuBitmap({ ...options, now: now + 60000 }).pixels);
  for (const size of [16, 32, 48]) {
    const data = png({ ...options, size });
    assert.equal(data.readUInt32BE(16), 104 * size / 16);
    assert.equal(data.readUInt32BE(20), 18 * size / 16);
  }
});
test('missing or expired reset times never imply replenished quota', () => {
  assert.equal(menuBitmap({ remaining: 0 }).countdown, '—');
  const expired = menuBitmap({ remaining: 0, resetsAt: now / 1000 - 10, now });
  assert.equal(expired.countdown, '0:00'); assert.equal(expired.value, 0);
  assert.equal(menuBitmap({ resetsAt: Number.MAX_SAFE_INTEGER, now }).countdown, '—');
});
test('weekly indicator retains its compact menu-bar width', () => {
  assert.equal(menuBitmap({ kind: 'weekly', remaining: 100, now }).width, 64);
});
test('clock advancement redraws the 5h image without a quota or server update', context => {
  const { EventEmitter } = require('node:events');
  const { TrayPresentation } = require('../../common/tray.cjs');
  let clock = now;
  context.mock.method(Date, 'now', () => clock);
  class Tray extends EventEmitter {
    constructor() { super(); this.images = 0; }
    setImage(image) { this.image = image; this.images++; }
    setToolTip() {} destroy() {}
  }
  const nativeImage = { createFromBuffer: buffer => ({ buffer, addRepresentation() {} }) };
  const view = new TrayPresentation({ Tray, nativeImage, Menu: { buildFromTemplate: value => value }, platform: 'darwin', onClick() {} });
  const state = { mode: 'tray', bucket: { short: { remaining: 72, resetsAt: now / 1000 + 3600 }, weekly: { remaining: 46 } }, menu: [] };
  view.update(state);
  const [short, weekly] = view.entries.map(entry => entry.tray);
  const images = [short.images, weekly.images], before = short.image.buffer;
  clock += 60000; view.update(state);
  assert.equal(short.images, images[0] + 1); assert.equal(weekly.images, images[1]);
  assert.notDeepEqual(short.image.buffer, before);
  view.destroy();
});
