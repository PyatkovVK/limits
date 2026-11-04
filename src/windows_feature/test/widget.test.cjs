'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TaskbarWidget } = require('../widget.cjs');
const { widgetBounds } = require('../taskbar.cjs');
const { EventEmitter } = require('node:events');

test('shell-driven native movement never overwrites the saved drag position', () => {
  class Window extends EventEmitter {
    constructor() { super(); this.webContents = new EventEmitter(); }
    loadFile() { return new Promise(() => {}); }
    isDestroyed() { return false; }
    destroy() { this.emit('closed'); }
  }
  const saved = { width: 280, xRatio: .25 };
  const host = new TaskbarWidget({ BrowserWindow: Window, getSettings: () => saved,
    restrictWindow() {}, onMove(bounds) { saved.xRatio = bounds.x / 1920; } });
  void host.start();
  let prevented = 0;
  host.window.emit('will-move', { preventDefault() { prevented++; } }, { x: 1400, y: 1032, width: 280, height: 39 });
  assert.equal(prevented, 1);
  assert.equal(saved.xRatio, .25, 'Only explicit pointer dragging may change the preference');
  host.stop();
});

test('one continuous cursor drag crosses centered buttons into the left gap and back', () => {
  const metrics = { available: true, visible: true, bar: { x: 0, y: 1032, width: 1920, height: 48 },
    tray: { x: 1750 }, occupied: [{ x: 750, y: 1032, width: 650, height: 48 }] };
  const settings = { width: 280 };
  let bounds = widgetBounds(metrics, settings);
  const host = new TaskbarWidget({ onMove(value) {
    settings.xRatio = value.x / metrics.bar.width;
    bounds = widgetBounds(metrics, settings);
  } });
  host.window = { isDestroyed: () => false, isVisible: () => true, getBounds: () => bounds };
  const rightX = bounds.x;
  host.drag('start', { x: rightX + 25 });
  // Small pointer steps reproduce a drag that got stuck when each native
  // window move started over from bounds clamped beside the centered buttons.
  for (let x = rightX + 25; x >= 125; x -= 10) host.drag('move', { x });
  host.drag('move', { x: 125 });
  assert.equal(bounds.x, 100);
  for (let x = 125; x <= rightX + 25; x += 10) host.drag('move', { x });
  host.drag('end', { x: rightX + 25 });
  assert.equal(bounds.x, rightX);
  assert.equal(host.drag('move', { x: 125 }), false);
});

test('widget drag ignores invalid phases and stops on cancellation or hidden windows', () => {
  let moves = 0;
  const host = new TaskbarWidget({ onMove() { moves++; } });
  assert.equal(host.drag('start', { x: 1 }), false);
  host.window = { isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 100 }) };
  for (const [phase, x] of [['move', 120], ['unknown', 120], ['start', NaN], ['start', Infinity]]) assert.equal(host.drag(phase, { x }), false);
  host.drag('start', { x: 125 }); host.drag('cancel', { x: 150 });
  assert.equal(host.drag('move', { x: 180 }), false);
  assert.equal(moves, 0);
  host.window.isVisible = () => false;
  assert.equal(host.drag('start', { x: 125 }), false);
});

test('stationary clicks and small pointer jitter do not move the widget or count as a drag', () => {
  let moves = 0;
  const host = new TaskbarWidget({ onMove() { moves++; } });
  host.window = { isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 100 }) };
  host.drag('start', { x: 125, y: 10 });
  assert.equal(host.drag('move', { x: 126, y: 11 }), false);
  assert.equal(host.drag('end', { x: 126, y: 11 }), false);
  assert.equal(moves, 0);
  host.drag('start', { x: 125, y: 10 });
  assert.equal(host.drag('move', { x: 145, y: 10 }), true);
  assert.equal(host.drag('end', { x: 125, y: 10 }), true, 'Returning to the original position still counts as a drag');
  assert.equal(moves, 2);
});

test('native gestures use event positions even when the live cursor has already reached the release point', () => {
  const moves = [], clicks = [], menus = [];
  const bounds = { x: 100, y: 1039, width: 280, height: 34 };
  const host = new TaskbarWidget({ screen: { screenToDipPoint: point => ({ x: point.x / 2, y: point.y / 2 }) },
    onMove(next) { moves.push(next.x); bounds.x = next.x; },
    getMenu: () => [], Menu: { buildFromTemplate: () => ({ popup: () => menus.push(true) }) } });
  host.window = { isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ ...bounds }),
    webContents: { send: channel => clicks.push(channel) } };
  const input = (type, x, button = 'left') => host.nativeInput({ type, x: x * 2, y: 2100, button });
  input('mouseDown', 125);
  input('mouseMove', 85);
  input('mouseMove', -300); // Keep capture outside the original widget and across displays.
  input('mouseUp', -300);
  assert.equal(bounds.x, -325);
  assert.deepEqual(clicks, [], 'Dragging must not also open details');
  const count = moves.length;
  input('mouseMove', 700);
  assert.equal(moves.length, count, 'Release ends the drag');
  input('mouseDown', -300);
  input('mouseUp', -300);
  assert.deepEqual(clicks, ['limits:windows-widget-click']);
  input('mouseDown', -300, 'right'); input('mouseUp', -300, 'right');
  assert.equal(menus.length, 1, 'Right-click keeps the context menu');
});
