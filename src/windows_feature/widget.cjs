'use strict';
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { TaskbarProbe, WidgetPlacement } = require('./taskbar.cjs');

function taskbarHelperPath(resourcesPath) {
  return resourcesPath ? path.join(resourcesPath, 'taskbar-helper.exe') : path.join(__dirname, '..', '..', 'build', 'taskbar-helper.exe');
}
class TaskbarWidget extends EventEmitter {
  constructor({ BrowserWindow, Menu, webPreferences, restrictWindow, getSettings, getMenu, onMove, resourcesPath }) {
    super();
    Object.assign(this, { BrowserWindow, Menu, webPreferences, restrictWindow, getSettings, getMenu, onMove });
    this.helperPath = taskbarHelperPath(resourcesPath);
    this.stopped = false;
  }
  drag(phase, point) {
    if (!this.window || this.window.isDestroyed() || !this.window.isVisible()) return false;
    if (!['start', 'move', 'end', 'cancel'].includes(phase) || !Number.isFinite(point?.x)) return false;
    if (phase === 'start') {
      this.dragOffset = point.x - this.window.getBounds().x;
      this.dragStart = { ...point };
      this.dragMoved = false;
      return true;
    }
    if (!Number.isFinite(this.dragOffset)) return false;
    // Keep the original grab offset even while placement clamps the window to
    // a free gap. Native dragging restarts from the clamped bounds and can get
    // stuck at the centered task buttons before reaching the left-hand gap.
    if (phase !== 'cancel') {
      if (Math.hypot(point.x - this.dragStart.x, (point.y || 0) - (this.dragStart.y || 0)) >= 4) this.dragMoved = true;
      if (this.dragMoved) this.onMove({ ...this.window.getBounds(), x: point.x - this.dragOffset });
    }
    const moved = this.dragMoved;
    if (phase !== 'move') this.dragOffset = null;
    return moved;
  }
  async start() {
    if (this.stopped) return;
    this.window = new this.BrowserWindow({ width: this.getSettings().width, height: 34, minHeight: 28, resizable: false, frame: false, thickFrame: false, show: false, skipTaskbar: true, focusable: false, alwaysOnTop: true, backgroundColor: '#171717', hasShadow: false, webPreferences: this.webPreferences });
    const created = this.window;
    this.dragOffset = null;
    created.on('hide', () => { this.dragOffset = null; });
    this.restrictWindow(created);
    this.placement = new WidgetPlacement(created);
    this.emit('window', created, this.placement);
    created.on('closed', () => {
      if (this.stopped || this.window !== created) return;
      this.probe?.stop();
      this.window = null; this.placement = null;
      this.emit('window', null, null);
      // Windows destroys owned windows when Explorer recreates the taskbar.
      this.retry = setTimeout(() => { if (!this.stopped) void this.start().catch(error => this.emit('failure', error)); }, 250);
    });
    created.on('will-move', (event, bounds) => { event.preventDefault(); this.onMove(bounds); });
    created.webContents.on('context-menu', () => this.Menu.buildFromTemplate(this.getMenu()).popup({ window: created }));
    await created.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
    if (created.isDestroyed() || this.stopped) return;
    const handle = created.getNativeWindowHandle();
    const id = handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
    this.probe = new TaskbarProbe(this.helperPath, { args: [String(process.pid), id] });
    this.emit('probe', this.probe);
    this.probe.on('metrics', metrics => this.emit('metrics', metrics));
    await this.probe.start();
    this.emit('ready');
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.probe?.stop();
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
}
module.exports = { TaskbarWidget, taskbarHelperPath };
