'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { chooseDisplay, notchLayout, fitMenuBar, hitBounds, contains } = require('../geometry.cjs');
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
  assert.ok(contains(hitBounds(layout, 'peek'), { x: 900, y: layout.capHeight + 10 }));
  assert.ok(!contains(hitBounds(layout, 'expanded'), { x: 650, y: 300 }));
});
test('the compact notch fills both side margins and keeps them interactive', () => {
  const layout = notchLayout(display, info);
  assert.equal(layout.capWidth, layout.closedWidth);
  for (const offset of [-info.notchWidth / 2 - 6, info.notchWidth / 2 + 6]) {
    assert.equal(contains(hitBounds(layout, 'closed'), { x: 900 + offset, y: info.top / 2 }), true);
  }
  assert.equal(contains(hitBounds(layout, 'closed'), { x: 900 + layout.closedWidth / 2 + 1, y: info.top / 2 }), false);
});
test('both notch hover styles retain the closed width and fit extra information below the cap', () => {
  for (const mode of ['notch', 'island']) {
    const layout = notchLayout(display, info, mode);
    const closed = hitBounds(layout, 'closed');
    const minimal = hitBounds(layout, 'peek');
    assert.equal(layout.hoverStyle, 'minimal');
    assert.equal(layout.peekShowsValues, false);
    assert.equal(minimal.width, closed.width);
    assert.equal(minimal.x, closed.x);
    assert.ok(minimal.height > layout.capHeight);
    fitMenuBar(layout, mode, 2, 'informative');
    const informative = hitBounds(layout, 'peek');
    assert.equal(layout.peekShowsValues, mode === 'notch');
    assert.deepEqual({ ...informative, height: minimal.height }, minimal);
    assert.ok(informative.height > minimal.height);
  }
  const narrow = notchLayout(display, { ...info, menuBarLeft: info.notchX }, 'island');
  assert.equal(narrow.indicatorMode, 'hidden');
  assert.equal(narrow.peekShowsValues, true);
  const fallbackHeight = narrow.peekHeight;
  fitMenuBar(narrow, 'island', 2, 'informative');
  assert.equal(narrow.peekShowsValues, true);
  assert.ok(narrow.peekHeight > fallbackHeight);
});
class FakeWindow extends EventEmitter {
  constructor() { super(); this.webContents = new EventEmitter(); this.webContents.send = (_channel, state) => { this.state = state; }; this.webContents.executeJavaScript = async () => {}; }
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
  const notch = new AppleNotch({ BrowserWindow: FakeWindow, screen, Menu: {}, webPreferences: {}, restrictWindow() {}, getState: () => ({}), getMenu: () => [], onChange() {}, onUnavailable() {}, readNativeScreens: async () => [{ ...info, menuBarLeft: 300, menuBarRight: 1500 }], menuBarGrowDelay: 0, ...options });
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

test('a native background picker keeps the expanded island open and releases the blur guard on failure', async () => {
  const notch = await controller();
  try {
    await notch.enable(); clearInterval(notch.timer); notch.expand();
    await notch.withModal(async () => { notch.window.blur(); assert.equal(notch.phase, 'expanded'); });
    assert.equal(notch.modalOperations, 0);
    await assert.rejects(notch.withModal(async () => { throw new Error('cancelled'); }), /cancelled/);
    assert.equal(notch.modalOperations, 0);
    notch.window.focus(); notch.window.blur(); assert.equal(notch.phase, 'closed');
  } finally { notch.destroy(); }
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

test('expanded content grows and shrinks inside a stationary notch host and survives rediscovery', async () => {
  const notch = await controller();
  try {
    await notch.enable(); clearInterval(notch.timer); notch.expand();
    const host = { ...notch.window.bounds };
    notch.resize(300);
    assert.equal(notch.snapshot().fullHeight, 300 + info.top + 12);
    assert.equal(hitBounds(notch.snapshot(), 'expanded').height, 350);
    assert.deepEqual(notch.window.bounds, host);
    notch.resize(480);
    assert.equal(notch.snapshot().fullHeight, 530);
    notch.resize(300);
    await notch.discover();
    assert.equal(notch.snapshot().fullHeight, 350);
    notch.resize(10000);
    assert.equal(notch.snapshot().fullHeight, 630);
    for (const height of [NaN, Infinity, -1, 0, '320']) assert.equal(notch.resize(height), false);
    notch.resize(300);
    notch.collapse();
    assert.equal(hitBounds(notch.snapshot(), 'closed').height, info.top + 9);
  } finally { notch.destroy(); }
});


test('browser handoff shows a notice, waits, and collapses even if browser never takes focus', async () => {
  const notch = await controller();
  try {
    await notch.enable(); clearInterval(notch.timer); notch.expand();
    await notch.beforeBrowserLogin(async ms => {
      assert.equal(ms, 1200); assert.equal(notch.snapshot().browserOpening, true);
      notch.window.blur(); assert.equal(notch.phase, 'expanded');
    });
    assert.equal(notch.phase, 'closed'); assert.equal(notch.snapshot().browserOpening, false);
    assert.equal(notch.hoverBlocked, true);
  } finally { notch.destroy(); }
});

test('browser handoff does not delay tray mode or collapse a newly enabled notch', async () => {
  const notch = await controller();
  try {
    await notch.beforeBrowserLogin(() => assert.fail('disabled notch delayed login'));
    await notch.enable(); clearInterval(notch.timer); notch.expand();
    await notch.beforeBrowserLogin(async () => {
      notch.disable(); await notch.enable(); clearInterval(notch.timer); notch.expand();
    });
    assert.equal(notch.phase, 'expanded'); assert.equal(notch.snapshot().browserOpening, false);
    await assert.rejects(notch.beforeBrowserLogin(async () => { throw new Error('cancelled'); }), /cancelled/);
    assert.equal(notch.modalOperations, 0); assert.equal(notch.snapshot().browserOpening, false);
  } finally { notch.destroy(); }
});

test('side panel leaves space for both indicators around the physical notch on a secondary screen', () => {
  const secondary = { ...display, bounds: { ...display.bounds, x: -1800, y: -1169 }, workArea: { ...display.workArea, x: -1800, y: -1131 } };
  const layout = notchLayout(secondary, { ...info, menuBarLeft: 300, menuBarRight: 1500 }, 'island');
  const closed = hitBounds(layout, 'closed');
  assert.equal(closed.x + closed.width / 2, -900);
  assert.equal(closed.y, -1169);
  assert.equal(layout.closedWidth - info.notchWidth, 192);
  assert.ok(layout.fullWidth >= layout.closedWidth);
  const notification = hitBounds(layout, 'notification');
  assert.ok(notification.height > closed.height);
  assert.ok(contains(notification, { x: -900, y: -1050 }));
  assert.ok(!contains(closed, { x: -900, y: -1050 }));
  assert.equal(notchLayout(display, {}, 'island'), null);
});

test('switching between notch presentations reuses the host, and island mode restores after display changes', async () => {
  const notch = await controller();
  try {
    await notch.enable(); const host = notch.window;
    await notch.enable('island'); clearInterval(notch.timer);
    assert.equal(notch.window, host); assert.equal(notch.snapshot().mode, 'island');
    assert.equal(notch.snapshot().closedWidth, info.notchWidth + 192);
    await notch.discover();
    assert.equal(notch.snapshot().closedWidth, info.notchWidth + 192);
    await notch.enable('notch'); clearInterval(notch.timer);
    assert.equal(notch.snapshot().closedWidth, info.notchWidth + 24);
    assert.equal(notch.notify({ title: 'Limits', body: 'Tray notification' }), false);
  } finally { notch.destroy(); }
});

test('island notifications queue without focus, expire in order, and ignore stale dismissal/actions', async () => {
  const timers = new Set();
  const notch = await controller({ setTimer(fn) { timers.add(fn); return fn; }, clearTimer(fn) { timers.delete(fn); } });
  try {
    assert.equal(notch.notify({ title: 'Limits', body: 'Disabled' }), false);
    await notch.enable('island'); clearInterval(notch.timer);
    const bounds = { ...notch.window.bounds };
    assert.equal(notch.notify({ title: 'Low allowance', body: '5h: 8%.' }), true);
    const first = notch.snapshot().notification;
    assert.equal(notch.phase, 'notification'); assert.ok(!notch.window.focused);
    assert.equal(notch.notify({ title: 'Codex Resets', body: 'Reset soon', action: 'resets' }), true);
    assert.equal(notch.snapshot().notificationCount, 2);
    assert.equal(notch.dismissNotification(first.id + 1), false);
    assert.equal(notch.activateNotification(first.id + 1), null);
    notch.trackPointer({ x: 900, y: 100 });
    assert.equal(notch.window.ignoring, false);
    [...timers][0](); // Hover keeps the current message readable.
    assert.equal(notch.snapshot().notification.id, first.id);
    notch.trackPointer({ x: 0, y: 1000 });
    [...timers][0]();
    assert.equal(notch.snapshot().notification.title, 'Codex Resets');
    assert.equal(notch.snapshot().notificationCount, 1);
    assert.equal(notch.activateNotification(notch.snapshot().notification.id), 'resets');
    assert.equal(notch.phase, 'closed'); assert.equal(timers.size, 0);
    assert.equal(notch.activateNotification(first.id), null);
    assert.deepEqual(notch.window.bounds, bounds);
  } finally { notch.destroy(); }
});

test('an incoming message preserves expanded Settings and all notification work stops on disable', async () => {
  const timers = new Set();
  const notch = await controller({ setTimer(fn) { timers.add(fn); return fn; }, clearTimer(fn) { timers.delete(fn); } });
  try {
    await notch.enable('island'); clearInterval(notch.timer); notch.expand();
    notch.notify({ title: 'Limits', body: 'A message while Settings is open' });
    assert.equal(notch.phase, 'expanded');
    await notch.withModal(async () => { [...timers][0](); assert.equal(notch.snapshot().notificationCount, 1); });
    notch.collapse(); assert.equal(notch.phase, 'notification');
    notch.disable(); assert.equal(timers.size, 0); assert.equal(notch.notifications.length, 0);
    await notch.enable('island'); clearInterval(notch.timer);
    assert.equal(notch.phase, 'closed'); assert.equal(notch.snapshot().notification, null);
  } finally { notch.destroy(); }
});

test('confirmed occupied menu space never paints wings over neighbouring controls', () => {
  const cases = [{ ...info, menuBarLeft: 760, menuBarRight: 1500 },
    { ...info, menuBarLeft: 300, menuBarRight: 1040 },
    { ...info, menuBarLeft: 1100, menuBarRight: 700 }];
  for (const native of cases) {
    const layout = notchLayout(display, native, 'island');
    assert.equal(layout.indicatorMode, 'hidden');
    assert.equal(layout.closedWidth, info.notchWidth);
    assert.equal(layout.closedHeight, info.top);
    assert.equal(layout.peekWidth, layout.closedWidth);
    for (const phase of ['closed', 'peek', 'expanded', 'notification']) {
      const bounds = hitBounds(layout, phase);
      for (const x of [info.notchX - 1, info.notchX + info.notchWidth + 1]) {
        assert.equal(contains(bounds, { x, y: 20 }, 6), false, phase);
      }
      assert.equal(contains(bounds, { x: 900, y: info.top + 2 }), phase !== 'closed', phase);
    }
  }
});

test('the tighter side controls a centred panel and hover uses the same edges', () => {
  for (const native of [{ ...info, menuBarLeft: info.notchX - 36, menuBarRight: 1500 },
    { ...info, menuBarLeft: 300, menuBarRight: info.notchX + info.notchWidth + 36 }]) {
    const layout = notchLayout(display, native, 'island');
    assert.equal(layout.indicatorMode, 'values');
    const closed = hitBounds(layout, 'closed'), hover = hitBounds(layout, 'peek');
    assert.equal(closed.x, hover.x);
    assert.equal(closed.width, hover.width);
    assert.equal(closed.width, info.notchWidth + 56);
    assert.equal(closed.x + closed.width / 2, 900);
    assert.ok(closed.x >= native.menuBarLeft + 8);
    assert.ok(closed.x + closed.width <= native.menuBarRight - 8);
    assert.ok(layout.capWidth <= layout.menuBarWidth);
  }
});

test('expanded shoulders start below the entire menu bar on scaled displays', () => {
  const scaled = { ...display, workArea: { ...display.workArea, y: 39 } };
  const layout = notchLayout(scaled, { ...info, menuBarLeft: 760, menuBarRight: 1500 }, 'island');
  assert.equal(layout.capHeight, 39);
  assert.equal(layout.closedHeight, info.top);
  assert.equal(contains(hitBounds(layout, 'closed'), { x: 900, y: 38.5 }, 6), false);
  for (const phase of ['expanded', 'notification']) {
    const bounds = hitBounds(layout, phase);
    assert.equal(contains(bounds, { x: info.notchX - 4, y: 38.5 }), false);
    assert.equal(contains(bounds, { x: info.notchX - 4, y: 40 }), true);
  }
});

test('verified free space preserves menu-bar meters and negative monitor coordinates stay safe', () => {
  const native = { ...info, menuBarLeft: 300, menuBarRight: 1500 };
  const secondary = { ...display, bounds: { ...display.bounds, x: -1800, y: -1169 }, workArea: { ...display.workArea, x: -1800, y: -1131 } };
  const layout = notchLayout(secondary, native, 'island');
  assert.equal(layout.metersTop, 0);
  assert.equal(layout.closedHeight, info.top);
  assert.equal(layout.metersHeight, layout.closedHeight);
  assert.ok(layout.menuBarWidth >= layout.fullWidth);
  for (const phase of ['closed', 'peek', 'expanded', 'notification']) {
    const bounds = hitBounds(layout, phase);
    const capWidth = Math.min(bounds.width, layout.capWidth);
    assert.equal(contains(bounds, { x: -900 + capWidth / 2 - 1, y: -1150 }), true);
    assert.equal(contains(bounds, { x: -900 + capWidth / 2 + 1, y: -1150 }, 6), false);
  }
});

test('changing menu occupancy preserves the host, expanded content and queued notifications', async () => {
  let native = { ...info, menuBarLeft: 300, menuBarRight: 1500 };
  const notch = await controller({ readNativeScreens: async () => [native] });
  try {
    await notch.enable('island'); clearInterval(notch.timer);
    await notch.refreshMenuBar();
    assert.equal(notch.snapshot().metersTop, 0);
    const host = { ...notch.window.bounds };
    notch.expand(); notch.resize(300);
    notch.notify({ title: 'Limits', body: 'Keep this message' });
    native = { ...info, menuBarLeft: 760, menuBarRight: 1080 };
    await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'hidden');
    assert.equal(notch.snapshot().peekWidth, notch.snapshot().closedWidth);
    assert.equal(notch.phase, 'expanded');
    assert.equal(notch.snapshot().fullHeight, 300 + info.top + 12);
    assert.equal(notch.snapshot().notification.body, 'Keep this message');
    assert.deepEqual(notch.window.bounds, host);
    notch.collapse(); assert.equal(notch.phase, 'notification');
    notch.dismissNotification(notch.snapshot().notification.id);
    notch.trackPointer({ x: 1011, y: 20 });
    assert.equal(notch.window.ignoring, true);
    notch.trackPointer({ x: 1009, y: 20 });
    assert.equal(notch.window.ignoring, false);
    const lastWidth = notch.snapshot().menuBarWidth;
    notch.readNativeScreens = async () => { throw new Error('Native probe failed'); };
    await notch.refreshMenuBar();
    assert.equal(notch.snapshot().menuBarWidth, lastWidth);
  } finally { notch.destroy(); }
});

test('menu-bar polling coalesces slow probes, ignores late results and stops when disabled', async () => {
  const notch = await controller();
  try {
    await notch.enable('island');
    assert.ok(notch.menuBarTimer);
    let resume, reads = 0;
    notch.readNativeScreens = () => { reads++; return new Promise(resolve => { resume = resolve; }); };
    const pending = notch.refreshMenuBar();
    await notch.refreshMenuBar();
    assert.equal(reads, 1);
    const layout = notch.layout;
    const width = layout.menuBarWidth;
    notch.disable();
    assert.equal(notch.menuBarTimer, null);
    resume([{ ...info, menuBarLeft: 0, menuBarRight: 1800 }]);
    await pending;
    assert.equal(notch.layout, layout);
    assert.equal(notch.layout.menuBarWidth, width);
    assert.equal(notch.menuBarPending, false);
  } finally { notch.destroy(); }
});

test('menu space shrinks promptly, grows after stability, and ignores small width changes', async () => {
  let time = 0;
  let native = { ...info, menuBarLeft: 760, menuBarRight: 1080 };
  const notch = await controller({ now: () => time, menuBarGrowDelay: 1000, readNativeScreens: async () => [native] });
  try {
    await notch.enable('island'); clearInterval(notch.timer); clearInterval(notch.menuBarTimer);
    assert.equal(notch.snapshot().indicatorMode, 'hidden');
    native = { ...info, menuBarLeft: 300, menuBarRight: 1500 }; await notch.refreshMenuBar();
    native.menuBarLeft = 300.5;
    time = 1000; await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'full');
    native = { ...info, menuBarLeft: 700, menuBarRight: 1500 };
    await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'values');
    assert.equal(notch.snapshot().closedWidth, 384);
    for (const left of [700.5, 699.5, 700, 701, 700]) {
      native.menuBarLeft = left; time += 1000; await notch.refreshMenuBar();
      assert.equal(notch.snapshot().closedWidth, 384);
    }
    native.menuBarLeft = 300; await notch.refreshMenuBar();
    time += 500; await notch.refreshMenuBar();
    assert.equal(notch.snapshot().closedWidth, 384);
    native = { ...info, menuBarLeft: 760, menuBarRight: 1080 }; await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'hidden');
    native = { ...info, menuBarLeft: 300, menuBarRight: 1500 };
    time += 500; await notch.refreshMenuBar();
    time += 999; await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'hidden');
    time += 1; await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'full');
    assert.equal(notch.snapshot().peekWidth, notch.snapshot().closedWidth);
  } finally { notch.destroy(); }
});

test('passive polling measures a status item once per stable app layout', async () => {
  let context = 'app-a';
  let right = 1090;
  let activeReads = 0;
  const notch = await controller({ readNativeScreens: async ({ measureStatusItems } = {}) => {
    if (measureStatusItems) activeReads++;
    return [{ ...info, menuBarContext: context, menuBarRight: measureStatusItems ? right : null }];
  } });
  try {
    await notch.enable('island'); clearInterval(notch.timer); clearInterval(notch.menuBarTimer);
    assert.equal(activeReads, 1);
    assert.equal(notch.snapshot().closedWidth, 364);
    for (let i = 0; i < 5; i++) await notch.refreshMenuBar();
    assert.equal(activeReads, 1);
    await notch.discover();
    assert.equal(notch.snapshot().closedWidth, 364);
    context = 'app-b'; await notch.refreshMenuBar();
    context = 'app-a'; await notch.refreshMenuBar();
    assert.equal(activeReads, 1);
    context = 'app-c'; right = 1060;
    await notch.refreshMenuBar();
    assert.equal(activeReads, 1);
    await notch.refreshMenuBar();
    assert.equal(activeReads, 2);
    assert.equal(notch.snapshot().closedWidth, 304);
    await notch.refreshMenuBar();
    assert.equal(activeReads, 2);
  } finally { notch.destroy(); }
});

test('a narrow panel recovers after switching between already running apps', async () => {
  let time = 0;
  let foreground = 1;
  let right = 1052;
  let activeReads = 0;
  const notch = await controller({ now: () => time, menuBarGrowDelay: 1000, readNativeScreens: async ({ measureStatusItems } = {}) => {
    if (measureStatusItems) activeReads++;
    return [{ ...info, menuBarContext: 'unchanged', menuBarForeground: foreground, menuBarRight: measureStatusItems ? right : null }];
  } });
  try {
    await notch.enable('island'); clearInterval(notch.timer); clearInterval(notch.menuBarTimer);
    assert.equal(notch.snapshot().closedWidth, 288);
    foreground = 2; right = 1119;
    await notch.refreshMenuBar();
    assert.equal(activeReads, 1);
    time = 1000; await notch.refreshMenuBar();
    assert.equal(activeReads, 2);
    assert.equal(notch.snapshot().closedWidth, 288);
    time = 2000; await notch.refreshMenuBar();
    assert.equal(notch.snapshot().indicatorMode, 'full');
    assert.equal(notch.snapshot().closedWidth, 412);
    foreground = 3;
    await notch.refreshMenuBar();
    await notch.refreshMenuBar();
    assert.equal(activeReads, 2);
  } finally { notch.destroy(); }
});

test('unavailable metadata does not remove side values and a known right boundary still constrains them', () => {
  for (const native of [info, { ...info, menuBarLeft: null, menuBarRight: null }, { ...info, menuBarLeft: NaN, menuBarRight: 1500 }]) {
    const layout = notchLayout(display, native, 'island');
    assert.equal(layout.indicatorMode, 'full');
    assert.equal(layout.closedWidth, info.notchWidth + 192);
    assert.equal(layout.peekWidth, layout.closedWidth);
  }
  const native = { ...info, menuBarLeft: null, menuBarRight: info.notchX + info.notchWidth + 64 };
  const layout = notchLayout(display, native, 'island');
  assert.equal(layout.indicatorMode, 'values');
  assert.ok(layout.closedWidth > info.notchWidth);
  assert.equal(layout.closedWidth, layout.peekWidth);
  const bounds = hitBounds(layout, 'closed');
  assert.ok(bounds.x + bounds.width <= native.menuBarRight - 8);
});

test('probe failures retain the last real measurement instead of collapsing the panel', async () => {
  const notch = await controller();
  try {
    await notch.enable('island'); clearInterval(notch.timer); clearInterval(notch.menuBarTimer);
    const before = notch.snapshot();
    notch.readNativeScreens = async () => [];
    await notch.refreshMenuBar();
    assert.equal(notch.snapshot().closedWidth, before.closedWidth);
    assert.equal(notch.snapshot().indicatorMode, 'full');
    notch.readNativeScreens = async () => [{ ...info, menuBarLeft: null, menuBarRight: null }];
    await notch.refreshMenuBar();
    assert.equal(notch.snapshot().menuBarWidth, before.menuBarWidth);
  } finally { notch.destroy(); }
});

test('cancelling the pre-show menu probe cannot show a late notch window', async () => {
  const notch = await controller();
  let resume;
  notch.readNativeScreens = () => new Promise(resolve => { resume = resolve; });
  try {
    const pending = notch.enable('island');
    while (!resume) await new Promise(resolve => setImmediate(resolve));
    notch.disable();
    resume([{ ...info, menuBarLeft: 300, menuBarRight: 1500 }]);
    await pending;
    assert.equal(notch.enabled, false);
    assert.equal(Boolean(notch.window.visible), false);
    assert.equal(notch.timer, null);
  } finally { notch.destroy(); }
});
