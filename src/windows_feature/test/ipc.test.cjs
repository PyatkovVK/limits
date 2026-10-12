'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { installWindowsBridge } = require('../ipc.cjs');
const windowsI18n = require('../i18n.js');

function fixture() {
  const handlers = new Map(), registered = [], removed = [];
  const window = new EventEmitter();
  window.isDestroyed = () => false;
  window.webContents = { mainFrame: {}, session: {
    registerPreloadScript(value) { registered.push(value); return 'windows-preload'; },
    unregisterPreloadScript(id) { removed.push(id); },
  } };
  const widgetWindow = () => ({ isDestroyed: () => false, webContents: { mainFrame: {} } });
  const moves = [], sizes = [];
  const host = { window: widgetWindow(), drag(phase, point) { moves.push({ phase, point }); return true; } };
  installWindowsBridge({ window, getWidgetHost: () => host,
    screen: { getCursorScreenPoint: () => ({ x: 300, y: 1040 }) },
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn), removeHandler: channel => handlers.delete(channel) },
    panel: { resize(height) { sizes.push(height); return true; } },
  });
  const eventFor = target => ({ sender: target.webContents, senderFrame: target.webContents.mainFrame });
  return { window, host, widgetWindow, handlers, registered, removed, moves, sizes, eventFor };
}

test('Windows IPC accepts only the details frame for sizing and the current widget frame for dragging', () => {
  const f = fixture(), resize = f.handlers.get('limits:windows-panel-size'), drag = f.handlers.get('limits:widget-drag');
  assert.equal(resize(f.eventFor(f.window), 245), true);
  assert.equal(resize(f.eventFor(f.host.window), 900), false);
  assert.equal(resize({ ...f.eventFor(f.window), senderFrame: {} }, 900), false);
  assert.deepEqual(f.sizes, [245]);
  assert.equal(drag(f.eventFor(f.window), 'start'), false);
  assert.equal(drag({ ...f.eventFor(f.host.window), senderFrame: {} }, 'start'), false);
  assert.equal(drag(f.eventFor(f.host.window), 'start'), true);
  assert.deepEqual(f.moves, [{ phase: 'start', point: { x: 300, y: 1040 } }]);
  const oldWindow = f.host.window;
  f.host.window = f.widgetWindow();
  assert.equal(drag(f.eventFor(oldWindow), 'move'), false);
  assert.equal(drag(f.eventFor(f.host.window), 'move'), true);
});

test('the Windows feature owns preload registration and releases its IPC on close', () => {
  const f = fixture();
  assert.deepEqual(f.registered, [{ type: 'frame', filePath: path.resolve(__dirname, '../preload.cjs') }]);
  f.window.emit('closed');
  assert.equal(f.handlers.size, 0);
  assert.deepEqual(f.removed, ['windows-preload']);
});

test('Windows dragging hints live in the feature translations and retain fallback behavior', () => {
  assert.match(windowsI18n.t('ru', 'drag'), /любую часть/);
  assert.match(windowsI18n.t('en', 'footnote'), /any part/);
  assert.equal(windowsI18n.t('other', 'drag'), windowsI18n.t('ru', 'drag'));
  assert.equal(windowsI18n.t('en', 'refresh'), null);
});
