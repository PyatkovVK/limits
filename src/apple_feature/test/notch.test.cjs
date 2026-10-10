'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { chooseDisplay, notchLayout, hitBounds, contains } = require('../geometry.cjs');
const { AppleNotch } = require('../notch.cjs');
const display = { id: 1, bounds: { x: 0, y: 0, width: 1800, height: 1169 }, workArea: { x: 0, y: 38, width: 1800, height: 1080 } };
const info = { id: 1, top: 38, notchX: 790, notchWidth: 220 };

test('notch mode requires a physical notch on an active display', () => {
  assert.equal(chooseDisplay([display], [], display), null);
  assert.equal(chooseDisplay([display], [{ ...info, top: 0 }], display), null);
  assert.equal(chooseDisplay([display], [{ ...info, id: 2 }], display), null);
  assert.equal(notchLayout(display), null);
});
test('uses the notched MacBook screen even when an external monitor is primary', () => {
  const external = { ...display, id: 2 };
  assert.equal(chooseDisplay([external, display], [info], external), display);
  const secondary = { ...display, bounds: { ...display.bounds, x: -1800, y: -1169 }, workArea: { ...display.workArea, x: -1800, y: -1131 } };
  const layout = notchLayout(secondary, info);
  assert.equal(layout.bounds.y, -1169);
  assert.equal(hitBounds(layout, 'closed').x + layout.closedWidth / 2, -900);
  assert.ok(layout.bounds.x >= secondary.bounds.x);
});
test('hit testing includes the visible island and passes through the transparent remainder', () => {
  const layout = notchLayout(display, info);
  assert.ok(contains(hitBounds(layout, 'closed'), { x: 900, y: 40 }));
  assert.ok(!contains(hitBounds(layout, 'closed'), { x: 900, y: 110 }));
  assert.ok(contains(hitBounds(layout, 'peek'), { x: 900, y: 110 }));
  assert.ok(!contains(hitBounds(layout, 'expanded'), { x: 650, y: 300 }));
});
class FakeWindow extends EventEmitter {
  constructor() { super(); this.webContents = new EventEmitter(); this.webContents.send = (_channel, state) => { this.state = state; }; }
  setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setHiddenInMissionControl() {}
  setIgnoreMouseEvents(value) { this.ignoring = value; }
  isDestroyed() { return Boolean(this.destroyed); }
  async loadFile() {}
  setBounds(bounds) { this.bounds = bounds; } getBounds() { return this.bounds; }
  showInactive() { this.visible = true; } show() { this.visible = true; }
  focus() { this.focused = true; } isFocused() { return this.focused; }
  blur() { this.focused = false; this.emit('blur'); }
  hide() { this.visible = false; } destroy() { this.destroyed = true; }
}
async function controller(options = {}) {
  const screen = Object.assign(new EventEmitter(), { getAllDisplays: () => [display], getPrimaryDisplay: () => display, getCursorScreenPoint: () => ({ x: 0, y: 1000 }) });
  const notch = new AppleNotch({ BrowserWindow: FakeWindow, screen, Menu: {}, webPreferences: {}, restrictWindow() {}, getState: () => ({}), getMenu: () => [], onChange() {}, onUnavailable() {}, readNativeScreens: async () => [info], ...options });
  await notch.discover();
  return notch;
}
test('hover waits, leaving collapses, click focuses, and Esc stays collapsed until pointer leaves', async () => {
  let time = 0;
  const notch = await controller({ now: () => time });
  try {
    await notch.enable(); clearInterval(notch.timer);
    const inside = { x: 900, y: 40 }, outside = { x: 0, y: 1000 };
    notch.trackPointer(inside); assert.equal(notch.phase, 'closed');
    assert.equal(notch.window.ignoring, false);
    time = 101; notch.trackPointer(inside); assert.equal(notch.phase, 'peek');
    notch.trackPointer(outside); assert.equal(notch.window.ignoring, true);
    time = 352; notch.trackPointer(outside); assert.equal(notch.phase, 'closed');
    notch.expand(); assert.equal(notch.phase, 'expanded'); assert.ok(notch.window.focused);
    notch.collapse(); time = 500; notch.trackPointer(inside); assert.equal(notch.phase, 'closed');
    notch.trackPointer(outside); notch.trackPointer(inside); time = 601; notch.trackPointer(inside); assert.equal(notch.phase, 'peek');
    notch.disable(); assert.equal(notch.window.visible, false); assert.equal(notch.snapshot(), null);
  } finally { notch.destroy(); }
});
test('no-notch machines create no overlay and cannot enable notch mode', async () => {
  const notch = await controller({ readNativeScreens: async () => [] });
  assert.equal(notch.available, false);
  await assert.rejects(notch.enable(), /No physical notch/);
  assert.equal(notch.window, undefined);
  notch.destroy();
});
test('switching back while the overlay loads cancels activation', async () => {
  const notch = await controller();
  let resume;
  notch.prepare = () => new Promise(resolve => { resume = resolve; });
  const pending = notch.enable(); notch.disable(); resume(); await pending;
  assert.equal(notch.enabled, false); assert.equal(notch.timer, null);
  notch.destroy();
});
test('disconnecting the notched screen disables its overlay and requests tray fallback', async () => {
  let native = [info], unavailable = false;
  const notch = await controller({ readNativeScreens: async () => native, onUnavailable: () => { unavailable = true; } });
  try {
    await notch.enable(); native = [];
    notch.screen.emit('display-removed');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(notch.available, false); assert.equal(notch.enabled, false); assert.ok(unavailable);
  } finally { notch.destroy(); }
});
