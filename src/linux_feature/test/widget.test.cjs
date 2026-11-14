'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { EventEmitter } = require('node:events');
const { LinuxWidget } = require('../widget/host.cjs');
const { widgetBounds } = require('../widget/widget-bounds.cjs');

class Window extends EventEmitter {
  constructor(options) {
    super(); this.options = options;
    this.visible = options.show !== false;
    this.bounds = { x: 0, y: 0, width: 280, height: 56 }; this.webContents = new EventEmitter();
  }
  isDestroyed() { return this.closed || false; } getBounds() { return this.bounds; }
  setBounds(bounds) { this.bounds = bounds; this.emit('move'); }
  isVisible() { return Boolean(this.visible); }
  showInactive() { this.visible = true; } hide() { this.visible = false; }
  destroy() { this.closed = true; } async loadFile(file) { this.file = file; }
}

test('Linux widget clamps negative-origin/small displays and validates widths', () => {
  const area = { x: -800, y: -600, width: 400, height: 300 };
  assert.deepEqual(widgetBounds(area, 280, { x: -1000, y: 0 }), { x: -792, y: -364, width: 280, height: 56 });
  assert.equal(widgetBounds(area, 999).width, 280);
  assert.equal(widgetBounds({ x: 0, y: 0, width: 220, height: 50 }, 400).width, 204);
});
test('widget mode, visibility, persistence, reset and event cleanup work without Windows helpers', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-widget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const screen = new EventEmitter(); screen.getPrimaryDisplay = screen.getDisplayMatching = () => ({ workArea: { x: 0, y: 0, width: 1280, height: 800 } });
  const settings = { width: 280, visible: true, displayMode: 'tray' };
  const options = { BrowserWindow: Window, screen, root, getSettings: () => settings, restrictWindow() {} };
  const widget = new LinuxWidget(options); t.after(() => widget.destroy());
  await widget.start(); assert.equal(widget.window.visible, false);
  assert.equal(widget.window.file, path.resolve(__dirname, '../widget/renderer/widget.html'));
  settings.displayMode = 'widget'; widget.apply(settings); assert.equal(widget.window.visible, true);
  widget.savePosition(); assert.equal(fs.existsSync(path.join(root, 'linux-widget-position.json')), false);
  widget.window.bounds = { ...widget.window.bounds, x: 100, y: 200 }; widget.savePosition();
  const restored = new LinuxWidget(options); t.after(() => restored.destroy());
  await restored.start(); assert.equal(restored.window.bounds.x, 100); assert.equal(restored.window.bounds.y, 200);
  settings.visible = false; widget.apply(settings); assert.equal(widget.window.visible, false);
  widget.reset(); assert.equal(fs.existsSync(path.join(root, 'linux-widget-position.json')), false);
  widget.destroy(); restored.destroy();
  assert.equal(screen.listenerCount('display-added'), 0);
});

test('widget restores and debounces manual moves through an injected store without filesystem access', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const screen = new EventEmitter();
  screen.getPrimaryDisplay = screen.getDisplayMatching = () => ({ workArea: { x: 0, y: 0, width: 1280, height: 800 } });
  const saved = [];
  let cleared = false;
  const widget = new LinuxWidget({
    BrowserWindow: Window, screen, restrictWindow() {},
    getSettings: () => ({ width: 280, visible: true, displayMode: 'widget' }),
    positionStore: {
      load: () => ({ x: 100, y: 200 }),
      save: point => saved.push(point),
      clear: () => { cleared = true; }
    }
  });
  t.after(() => widget.destroy());
  await widget.start();
  assert.equal(widget.window.bounds.x, 100);
  t.mock.timers.tick(200);
  assert.deepEqual(saved, [], 'restoring placement must not write it back');
  widget.window.setBounds({ ...widget.window.bounds, x: 300, y: 400 });
  t.mock.timers.tick(150);
  widget.window.setBounds({ ...widget.window.bounds, x: 320, y: 420 });
  t.mock.timers.tick(199);
  assert.deepEqual(saved, []);
  t.mock.timers.tick(1);
  assert.deepEqual(saved, [{ x: 320, y: 420 }]);
  screen.emit('display-metrics-changed');
  assert.equal(widget.window.bounds.x, 320);
  widget.reset();
  assert.equal(cleared, true);
  assert.equal(widget.window.bounds.x, 984, 'reset restores default placement');
});
