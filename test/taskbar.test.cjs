const test = require('node:test');
const assert = require('node:assert/strict');
const { widgetBounds, TaskbarProbe } = require('../src/taskbar.cjs');
const path = require('node:path');
const { once } = require('node:events');
const base = { available: true, visible: true, fullscreen: false, bar: { x: 0, y: 1032, width: 1920, height: 48 }, tray: { x: 1650, y: 1032, width: 270, height: 48 } };
test('widget lies inside taskbar and leaves system tray unobstructed', () => {
  const b = widgetBounds(base);
  assert.deepEqual(b, { x: 1322, y: 1039, width: 320, height: 34 });
  assert.ok(b.x + b.width < base.tray.x);
});
test('dragged position is clamped and survives a monitor origin change', () => {
  const metrics = { ...base, bar: { x: -1920, y: 1032, width: 1920, height: 48 }, tray: { x: -270, y: 1032, width: 270, height: 48 } };
  assert.equal(widgetBounds(metrics, { xRatio: .3 }).x, -1344);
  assert.equal(widgetBounds(base, { xRatio: 1 }).x, 1322);
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
