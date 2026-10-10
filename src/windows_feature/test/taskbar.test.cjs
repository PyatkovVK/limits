const test = require('node:test');
const assert = require('node:assert/strict');
const { widgetBounds, TaskbarProbe, WidgetPlacement } = require('../taskbar.cjs');
const path = require('node:path');
const { once } = require('node:events');
const base = { available: true, visible: true, fullscreen: false, bar: { x: 0, y: 1032, width: 1920, height: 48 }, tray: { x: 1650, y: 1032, width: 270, height: 48 } };
test('widget lies inside taskbar and leaves system tray unobstructed', () => {
  const b = widgetBounds(base);
  assert.deepEqual(b, { x: 1362, y: 1039, width: 280, height: 34 });
  assert.ok(b.x + b.width < base.tray.x);
});
test('dragged position is clamped and survives a monitor origin change', () => {
  const metrics = { ...base, bar: { x: -1920, y: 1032, width: 1920, height: 48 }, tray: { x: -270, y: 1032, width: 270, height: 48 } };
  assert.equal(widgetBounds(metrics, { xRatio: .3 }).x, -1344);
  assert.equal(widgetBounds(base, { xRatio: 1 }).x, 1362);
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

function fakeWidget() {
  return {
    bounds: { x: 0, y: 0, width: 320, height: 39 }, visible: false,
    isDestroyed: () => false,
    isVisible() { return this.visible; },
    getBounds() { return { ...this.bounds }; },
    setBounds(bounds) { this.bounds = { ...bounds, height: Math.max(39, bounds.height) }; },
    showInactive() { this.visible = true; },
    hide() { this.visible = false; }
  };
}
test('polling accepted Windows bounds never repeatedly resizes or shows the widget', () => {
  const target = fakeWidget();
  const placement = new WidgetPlacement(target);
  for (let i = 0; i < 100; i++) placement.apply(base, { visible: true, width: 320 });
  assert.deepEqual(placement.changes, { bounds: 1, shows: 1, hides: 0 });
  assert.equal(target.bounds.height, 39); // Windows rejected the requested 34 px height.
});
test('hiding and returning from fullscreen each happen once without redundant resizing', () => {
  const placement = new WidgetPlacement(fakeWidget());
  const settings = { visible: true };
  placement.apply(base, settings);
  for (let i = 0; i < 10; i++) placement.apply({ ...base, fullscreen: true }, settings);
  for (let i = 0; i < 10; i++) placement.apply(base, settings);
  assert.deepEqual(placement.changes, { bounds: 1, shows: 2, hides: 1 });
});
test('actual geometry changes still update widget position and width', () => {
  const placement = new WidgetPlacement(fakeWidget());
  placement.apply(base, { visible: true });
  placement.apply(base, { visible: true, width: 400 });
  const moved = { ...base, bar: { ...base.bar, y: 900 } };
  placement.apply(moved, { visible: true, width: 400 });
  assert.deepEqual(placement.changes, { bounds: 3, shows: 1, hides: 0 });
  assert.equal(placement.window.bounds.y, 907);
});

function probe(t, options = {}) {
  const value = new TaskbarProbe(process.execPath, { args: [path.join(__dirname, 'fixtures/taskbar.cjs')], interval: 50, retryDelay: 30, timeout: 500, ...options });
  t.after(() => value.stop());
  return value;
}
function nextAvailable(value) {
  return new Promise(resolve => {
    const onMetrics = metrics => { if (metrics.available) { value.off('metrics', onMetrics); resolve(metrics); } };
    value.on('metrics', onMetrics);
  });
}
test('geometry helper restarts after exiting and continues reporting', { timeout: 5000 }, async t => {
  const value = probe(t);
  assert.equal((await value.start()).available, true);
  const oldChild = value.child;
  const restored = nextAvailable(value);
  oldChild.kill();
  await restored;
  assert.notEqual(value.child.pid, oldChild.pid);
});
test('unresponsive geometry helper is replaced and stop prevents restart', { timeout: 5000 }, async t => {
  const value = probe(t, { args: [path.join(__dirname, 'fixtures/taskbar.cjs'), '--hang-after-first'], timeout: 150 });
  await value.start();
  const oldChild = value.child;
  await nextAvailable(value);
  assert.notEqual(value.child.pid, oldChild.pid);
  const stopped = value.child;
  const exited = once(stopped, 'exit');
  value.stop();
  await exited;
  assert.equal(value.child, null);
  assert.equal(value.stopped, true);
});
