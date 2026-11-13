'use strict';
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { TaskbarProbe } = require('../taskbar/probe.cjs');
const { WidgetPlacement } = require('../taskbar/widget-placement.cjs');
const { taskbarHelperPath } = require('../taskbar/helper.cjs');
const { WidgetInput } = require('./input.cjs');

class TaskbarWidget extends EventEmitter {
  constructor({ BrowserWindow, screen, Menu, webPreferences, restrictWindow, getSettings, getMenu, onMove, resourcesPath }) {
    super();
    Object.assign(this, { BrowserWindow, screen, Menu, webPreferences, restrictWindow, getSettings, getMenu, onMove });
    this.helperPath = taskbarHelperPath(resourcesPath);
    this.input = new WidgetInput();
    this.stopped = false;
  }
  drag(phase, point) {
    return this.input.drag(this.window, phase, point, bounds => this.onMove(bounds));
  }
  nativeInput(input) {
    const target = this.window;
    if (!target || target.isDestroyed() || !target.isVisible()) return;
    const point = this.screen.screenToDipPoint({ x: input.x, y: input.y });
    this.input.handleNative(input, point, {
      drag: (phase, position) => this.drag(phase, position),
      click: () => target.webContents.send('limits:windows-widget-click'),
      openMenu: () => this.openMenu(target),
    });
  }
  openMenu(window) {
    this.Menu.buildFromTemplate(this.getMenu()).popup({ window });
  }
  async start() {
    if (this.stopped) return;
    this.window = new this.BrowserWindow({ width: this.getSettings().width, height: 34, minHeight: 28, resizable: false, frame: false, thickFrame: false, show: false, skipTaskbar: true, focusable: false, alwaysOnTop: true, backgroundColor: '#171717', hasShadow: false, webPreferences: this.webPreferences });
    const created = this.window;
    this.input.reset();
    created.on('hide', () => this.input.reset());
    this.restrictWindow(created);
    this.placement = new WidgetPlacement(created, { setParented: (parented, bounds) =>
      this.probe?.setParented(parented, this.screen.dipToScreenRect(created, bounds)) });
    this.emit('window', created, this.placement);
    created.on('closed', () => {
      if (this.stopped || this.window !== created) return;
      this.probe?.stop();
      this.window = null; this.placement = null;
      this.emit('window', null, null);
      // Windows destroys child windows when Explorer recreates the taskbar.
      this.retry = setTimeout(() => { if (!this.stopped) void this.start().catch(error => this.emit('failure', error)); }, 250);
    });
    // Placement and shell transitions are not user drags. Persist only the
    // explicit pointer gesture handled by drag(), including its grab offset.
    created.on('will-move', event => event.preventDefault());
    created.webContents.on('context-menu', () => this.openMenu(created));
    await created.loadFile(path.join(__dirname, 'renderer/widget.html'));
    if (created.isDestroyed() || this.stopped) return;
    const handle = created.getNativeWindowHandle();
    const id = handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
    this.probe = new TaskbarProbe(this.helperPath, { args: [String(process.pid), id] });
    this.probe.on('input', input => { if (this.window === created) this.nativeInput(input); });
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
module.exports = { TaskbarWidget };
