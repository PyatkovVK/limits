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
  async start() {
    if (this.stopped) return;
    this.window = new this.BrowserWindow({ width: this.getSettings().width, height: 34, minHeight: 28, resizable: false, frame: false, thickFrame: false, show: false, skipTaskbar: true, focusable: false, alwaysOnTop: true, backgroundColor: '#171717', hasShadow: false, webPreferences: this.webPreferences });
    const created = this.window;
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
