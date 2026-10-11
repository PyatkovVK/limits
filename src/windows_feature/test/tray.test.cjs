const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { bitmap, png } = require('../tray-icon.cjs');
const { TrayPresentation, tooltip } = require('../../common/tray.cjs');

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
test('tooltips include account, quota, countdown and data availability in either language', () => {
  const now = 1000000;
  const state = { account: { email: 'test@example.com', planType: 'plus' }, bucket: { name: 'Codex', short: { remaining: 27, resetsAt: now / 1000 + 8340 } }, language: 'ru' };
  assert.match(tooltip('short', state, now), /Пятичасовой лимит[\s\S]*test@example.com[\s\S]*27%[\s\S]*2:19/);
  assert.match(tooltip('short', { ...state, language: 'en', stale: true }, now), /Five-hour limit[\s\S]*Data is out of date/);
  assert.match(tooltip('weekly', state, now), /нет данных/);
});

class FakeTray extends EventEmitter {
  constructor(image, id) { super(); this.image = image; this.id = id; this.images = 0; this.destroyed = false; }
  setImage(image) { this.image = image; this.images++; }
  setToolTip(value) { this.tooltip = value; }
  setContextMenu(menu) { this.menu = menu; }
  popUpContextMenu(menu) { this.popup = menu; }
  getBounds() { return { x: 10, y: 20, width: 16, height: 16 }; }
  destroy() { this.destroyed = true; }
}
const nativeImage = { createFromBuffer(buffer) { return { buffer, addRepresentation() {} }; } };
test('ordinary polls preserve tray objects and images; switching modes destroys only the previous set', () => {
  const clicks = [];
  const view = new TrayPresentation({ Tray: FakeTray, Menu: { buildFromTemplate: menu => menu }, nativeImage, appIcon: {}, onClick: (_, kind) => clicks.push(kind) });
  const state = { mode: 'tray', bucket: { short: { remaining: 27 }, weekly: { remaining: 64 } }, language: 'ru', stale: false, menu: [{ label: 'Exit' }] };
  view.update(state);
  const original = view.entries.map(entry => entry.tray);
  const images = original.map(tray => tray.images);
  for (let i = 0; i < 50; i++) view.update({ ...state });
  assert.deepEqual(view.entries.map(entry => entry.tray), original);
  assert.deepEqual(original.map(tray => tray.images), images);
  view.entries.forEach(entry => entry.tray.emit('click'));
  assert.deepEqual(clicks, ['short', 'weekly']);
  view.update({ ...state, bucket: { ...state.bucket, short: { remaining: 26 } } });
  assert.equal(original[0].images, images[0] + 1); assert.equal(original[1].images, images[1]);
  view.update({ ...state, mode: 'widget' });
  assert.equal(view.entries.length, 1); assert.ok(original.every(tray => tray.destroyed));
  const appTray = view.entries[0].tray;
  view.update(state);
  assert.ok(appTray.destroyed); assert.equal(view.entries.length, 2);
  view.destroy(); assert.equal(view.entries.length, 0);
});
test('Mac tray clicks open details while right-click opens the menu without intercepting activation', () => {
  let clicks = 0;
  const view = new TrayPresentation({ Tray: FakeTray, Menu: { buildFromTemplate: menu => menu }, nativeImage, appIcon: {}, platform: 'darwin', onClick: () => clicks++ });
  view.update({ mode: 'tray', menu: [{ label: 'Quit' }] });
  const tray = view.entries[0].tray;
  assert.equal(tray.menu, undefined);
  tray.emit('click'); tray.emit('right-click');
  assert.equal(clicks, 1);
  assert.deepEqual(tray.popup, [{ label: 'Quit' }]);
});
test('Linux tray skips Windows GUIDs and unsupported bounds API', () => {
  const view = new TrayPresentation({ Tray: FakeTray, Menu: { buildFromTemplate: menu => menu }, nativeImage, appIcon: {}, platform: 'linux', onClick() {} });
  view.update({ mode: 'tray', menu: [] });
  assert.equal(view.entries[0].tray.id, undefined);
  view.entries[0].tray.getBounds = () => { throw new Error('Unsupported API'); };
  assert.equal(view.bounds(), null);
});
