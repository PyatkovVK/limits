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

test('crowded centered taskbar shrinks the widget in the gap beside the tray', () => {
  const metrics = { ...base, occupied: [{ x: 900, y: 1032, width: 514, height: 48 }] };
  const bounds = widgetBounds(metrics, { width: 400 });
  assert.deepEqual(bounds, { x: 1422, y: 1039, width: 220, height: 34 });
  assert.ok(bounds.x >= 900 + 514 + 8);
  assert.ok(bounds.x + bounds.width <= base.tray.x - 8);
  // The saved width is a preference: it returns when the taskbar has more room.
  assert.equal(widgetBounds(base, { width: 400 }).width, 400);
});

test('a full right side moves the widget left without covering Widgets or centered apps', () => {
  const metrics = { ...base, occupied: [
    { x: 900, y: 1032, width: 650, height: 48 },
    { x: 0, y: 1032, width: 210, height: 48 },
  ] };
  assert.deepEqual(widgetBounds(metrics), { x: 612, y: 1039, width: 280, height: 34 });
  assert.equal(widgetBounds(metrics, { xRatio: 0 }).x, 218);
  assert.equal(widgetBounds(metrics, { xRatio: 1 }).x, 612);
});

test('overlapping taskbar controls form one obstacle and dragging snaps to a free gap', () => {
  const metrics = { ...base, occupied: [
    { x: 1080, y: 1032, width: 470, height: 48 },
    { x: 900, y: 1032, width: 300, height: 48 },
    { x: 940, y: 1032, width: 40, height: 48 },
  ] };
  assert.equal(widgetBounds(metrics, { xRatio: .6 }).x, 612);
  assert.equal(widgetBounds(metrics).width, 280);
});

test('fallback geometry works on negative monitor origins and 200 DIP is the compact minimum', () => {
  const metrics = { ...base, bar: { ...base.bar, x: -1920 }, tray: { ...base.tray, x: -270 },
    occupied: [{ x: -1020, y: 1032, width: 534, height: 48 }] };
  assert.deepEqual(widgetBounds(metrics), { x: -478, y: 1039, width: 200, height: 34 });
  metrics.occupied[0].width++;
  assert.equal(widgetBounds(metrics).x, -1308);
});

test('a taskbar without a readable free gap hides the widget rather than covering controls', () => {
  assert.equal(widgetBounds({ ...base, occupied: [{ x: 56, y: 1032, width: 1586, height: 48 }] }), null);
});

test('off-taskbar and unavailable accessibility geometry preserve the usual tray placement', () => {
  for (const occupied of [null, [], [{ x: 0, y: 900, width: 1920, height: 30 }]]) {
    assert.deepEqual(widgetBounds({ ...base, occupied }), widgetBounds(base));
  }
});

function fakeWidget() {
  return {
    bounds: { x: 0, y: 0, width: 320, height: 39 }, visible: false, aboveTaskbar: false, raises: 0,
    isDestroyed: () => false,
    isVisible() { return this.visible; },
    getBounds() { return { ...this.bounds }; },
    setBounds(bounds) { this.bounds = { ...bounds, height: Math.max(39, bounds.height) }; },
    showInactive() { this.visible = true; this.aboveTaskbar = false; },
    moveTop() { assert.ok(this.visible, 'Raise the widget after showing it'); this.aboveTaskbar = true; this.raises++; },
    hide() { this.visible = false; this.aboveTaskbar = false; }
  };
}
test('polling accepted Windows bounds never repeatedly resizes or shows the widget', () => {
  const target = fakeWidget();
  const placement = new WidgetPlacement(target);
  for (let i = 0; i < 100; i++) placement.apply(base, { visible: true, width: 320 });
  assert.deepEqual(placement.changes, { bounds: 1, shows: 1, hides: 0 });
  assert.equal(target.bounds.height, 39); // Windows rejected the requested 34 px height.
  assert.equal(target.raises, 1);
  assert.equal(target.aboveTaskbar, true);
});

test('the first taskbar observation shows the widget above Explorer without activation', () => {
  const target = fakeWidget();
  // No focus/show method: initial display must preserve the foreground app.
  const placement = new WidgetPlacement(target);
  placement.apply(base, { visible: true });
  assert.equal(target.isVisible(), true);
  assert.equal(target.aboveTaskbar, true);
  assert.equal(target.raises, 1);
});
test('hiding and returning from fullscreen each happen once without redundant resizing', () => {
  const placement = new WidgetPlacement(fakeWidget());
  const settings = { visible: true };
  placement.apply(base, settings);
  for (let i = 0; i < 10; i++) placement.apply({ ...base, fullscreen: true }, settings);
  for (let i = 0; i < 10; i++) placement.apply(base, settings);
  assert.deepEqual(placement.changes, { bounds: 1, shows: 2, hides: 1 });
  assert.equal(placement.window.aboveTaskbar, true);
  assert.equal(placement.window.raises, 2);
});

test('hidden settings and unavailable taskbars do not raise the widget; restoring it does', () => {
  const target = fakeWidget();
  const placement = new WidgetPlacement(target);
  const settings = { visible: true };
  for (const metrics of [{ available: false }, { ...base, visible: false }, { ...base, fullscreen: true }]) {
    placement.apply(metrics, settings);
  }
  placement.apply(base, { visible: false });
  assert.equal(target.raises, 0);
  placement.apply(base, settings);
  placement.apply(base, { visible: false });
  placement.apply(base, settings);
  assert.equal(target.aboveTaskbar, true);
  assert.equal(target.raises, 2);
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
  // Child startup uses real I/O; advance only probe deadlines and retries explicitly.
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
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
test('geometry helper retries after a startup timeout reports unavailable', { timeout: 5000 }, async t => {
  const value = probe(t);
  const started = value.start();
  const oldChild = value.child;
  t.mock.timers.tick(value.timeout);
  assert.deepEqual(await started, { available: false });
  assert.equal(value.child, null);
  const restored = nextAvailable(value);
  t.mock.timers.tick(value.retryDelay);
  assert.equal((await restored).available, true);
  assert.notEqual(value.child.pid, oldChild.pid);
});

test('geometry helper restarts after exiting and continues reporting', { timeout: 5000 }, async t => {
  const value = probe(t);
  assert.equal((await value.start()).available, true);
  const oldChild = value.child;
  const unavailable = once(value, 'metrics');
  const restored = nextAvailable(value);
  oldChild.kill();
  assert.equal((await unavailable)[0].available, false);
  t.mock.timers.tick(value.retryDelay);
  await restored;
  assert.notEqual(value.child.pid, oldChild.pid);
});
test('unresponsive geometry helper is replaced and stop prevents restart', { timeout: 5000 }, async t => {
  const value = probe(t, { args: [path.join(__dirname, 'fixtures/taskbar.cjs'), '--hang-after-first'], timeout: 150 });
  assert.equal((await value.start()).available, true);
  const oldChild = value.child;
  const unavailable = once(value, 'metrics');
  t.mock.timers.tick(value.interval);
  t.mock.timers.tick(value.timeout);
  assert.equal((await unavailable)[0].available, false);
  assert.equal(value.child, null);
  const restored = nextAvailable(value);
  t.mock.timers.tick(value.retryDelay);
  await restored;
  assert.notEqual(value.child.pid, oldChild.pid);
  const stopped = value.child;
  const exited = once(stopped, 'exit');
  value.stop();
  await exited;
  t.mock.timers.tick(value.retryDelay + value.interval + value.timeout);
  assert.equal(value.child, null);
  assert.equal(value.stopped, true);
});
