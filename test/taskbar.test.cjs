const test = require('node:test');
const assert = require('node:assert/strict');
const { widgetBounds } = require('../src/taskbar.cjs');
const base = { available: true, visible: true, fullscreen: false, bar: { x: 0, y: 1032, width: 1920, height: 48 }, tray: { x: 1650, y: 1032, width: 270, height: 48 } };
test('widget lies inside taskbar and leaves system tray unobstructed', () => {
  const b = widgetBounds(base);
  assert.deepEqual(b, { x: 1122, y: 1033, width: 520, height: 46 });
  assert.ok(b.x + b.width < base.tray.x);
});
test('dragged position is clamped and survives a monitor origin change', () => {
  const metrics = { ...base, bar: { x: -1920, y: 1032, width: 1920, height: 48 }, tray: { x: -270, y: 1032, width: 270, height: 48 } };
  assert.equal(widgetBounds(metrics, { xRatio: .3 }).x, -1344);
  assert.equal(widgetBounds(base, { xRatio: 1 }).x, 1122);
  assert.equal(widgetBounds(base, { xRatio: -1 }).x, 56);
});
test('hidden taskbar and fullscreen applications suppress widget', () => {
  assert.equal(widgetBounds({ ...base, visible: false }), null);
  assert.equal(widgetBounds({ ...base, fullscreen: true }), null);
  assert.equal(widgetBounds({ available: false }), null);
});
test('DIP taskbar geometry with small height remains in bounds', () => {
  const b = widgetBounds({ ...base, bar: { x: 0, y: 688, width: 1280, height: 32 }, tray: { x: 1100 } });
  assert.ok(b.height === 30 && b.y + b.height <= 720);
});
