'use strict';
const path = require('node:path');
const { chooseDisplay, notchLayout, hitBounds, contains } = require('./geometry.cjs');
const { readScreens } = require('./screens.cjs');

class AppleNotch {
  constructor({ BrowserWindow, screen, Menu, webPreferences, restrictWindow, resourcesPath, getState, getMenu, onChange, onUnavailable, readNativeScreens = () => readScreens(resourcesPath), now = Date.now }) {
    Object.assign(this, { BrowserWindow, screen, Menu, webPreferences, restrictWindow, getState, getMenu, onChange, onUnavailable, readNativeScreens, now });
    this.phase = 'closed'; this.enabled = false; this.available = false; this.revision = 0; this.activation = 0;
    this.onDisplays = () => { void this.discover().then(() => {
      if (this.enabled && !this.available) { this.disable(); this.onUnavailable(); }
      else if (this.enabled) this.place();
      this.onChange();
    }); };
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, this.onDisplays);
  }

  async prepare() {
    if (this.window) return;
    this.window = new this.BrowserWindow({ width: 484, height: 654, frame: false, transparent: true, backgroundColor: '#00000000', show: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false, roundedCorners: false, type: 'panel', webPreferences: { ...this.webPreferences, backgroundThrottling: false } });
    this.restrictWindow(this.window);
    this.window.setAlwaysOnTop(true, 'pop-up-menu');
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.window.setHiddenInMissionControl(true);
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.on('blur', () => { if (this.enabled && this.phase === 'expanded' && !this.modalOperations) this.collapse(); });
    this.window.on('close', event => { event.preventDefault(); this.collapse(); });
    this.window.webContents.on('context-menu', () => { if (this.enabled) this.Menu.buildFromTemplate(this.getMenu()).popup({ window: this.window }); });
    await this.window.loadFile(path.join(__dirname, '../common/renderer/index.html'), { query: { apple: 'notch' } });
    await this.window.webContents.executeJavaScript('window.limitsMacPanelReady');
  }

  async withModal(operation) {
    this.modalOperations = (this.modalOperations || 0) + 1;
    try { return await operation(); } finally { this.modalOperations--; }
  }

  async discover() {
    const revision = ++this.revision;
    const screens = await this.readNativeScreens();
    if (revision !== this.revision) return;
    const display = chooseDisplay(this.screen.getAllDisplays(), screens, this.screen.getPrimaryDisplay());
    this.available = Boolean(display);
    this.layout = display ? notchLayout(display, screens.find(info => info.id === display.id)) : null;
    this.fitContent();
  }

  fitContent() {
    if (!this.layout || !this.contentHeight) return;
    this.layout.fullHeight = Math.min(this.layout.maxFullHeight, Math.max(this.layout.peekHeight, this.contentHeight + this.layout.capHeight));
  }

  resize(height) {
    if (!Number.isFinite(height) || height <= 0) return false;
    this.contentHeight = Math.ceil(height);
    const previous = this.layout?.fullHeight;
    this.fitContent();
    if (this.layout?.fullHeight !== previous) this.update();
    return true;
  }

  place() {
    if (!this.layout || !this.window || !this.enabled) return;
    this.window.setBounds(this.layout.bounds, false);
    // AppKit may adjust the requested frame: hit testing uses the actual native frame.
    this.layout.bounds = this.window.getBounds();
    this.update();
  }

  async enable() {
    if (this.enabled) return;
    if (!this.available) throw new Error('No physical notch on connected displays');
    const activation = ++this.activation;
    await this.prepare();
    if (activation !== this.activation || !this.available) return;
    this.enabled = true; this.phase = 'closed';
    this.hoverBlocked = false; this.enteredAt = this.leftAt = null;
    this.place();
    this.window.showInactive();
    this.timer = setInterval(() => this.trackPointer(), 50);
    this.trackPointer(); this.onChange();
  }

  disable() {
    this.enabled = false; this.revision++; this.activation++;
    clearInterval(this.timer); this.timer = null;
    this.enteredAt = this.leftAt = null;
    this.phase = 'closed'; this.setInteractive(false);
    this.window?.hide();
  }

  setInteractive(value) {
    if (!this.window || this.window.isDestroyed() || this.interactive === value) return;
    this.interactive = value;
    this.window.setIgnoreMouseEvents(!value, { forward: true });
  }

  trackPointer(point = this.screen.getCursorScreenPoint()) {
    if (!this.enabled || !this.layout) return;
    const inside = contains(hitBounds(this.layout, this.phase), point, this.phase === 'closed' ? 0 : 6);
    this.setInteractive(inside);
    if (this.phase === 'expanded') return;
    if (this.hoverBlocked) { if (!inside) this.hoverBlocked = false; else return; }
    const time = this.now();
    if (inside) {
      this.leftAt = null;
      if (this.enteredAt === null || this.enteredAt === undefined) this.enteredAt = time;
      if (time - this.enteredAt >= 100 && this.phase === 'closed') this.setPhase('peek');
    } else {
      this.enteredAt = null;
      if (this.leftAt === null || this.leftAt === undefined) this.leftAt = time;
      if (time - this.leftAt >= 250 && this.phase === 'peek') this.setPhase('closed');
    }
  }

  setPhase(phase) {
    this.phase = phase; this.update();
  }
  expand() {
    if (!this.enabled || !this.layout) return;
    this.setPhase('expanded'); this.window.show(); this.window.focus();
    this.trackPointer();
  }
  collapse() {
    if (!this.enabled) return;
    this.hoverBlocked = true;
    this.enteredAt = this.now(); this.leftAt = null;
    this.setPhase('closed'); this.setInteractive(false);
    if (this.window.isFocused()) this.window.blur();
  }
  snapshot() { return this.enabled && this.layout ? { phase: this.phase, ...this.layout } : null; }
  update() {
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send('limits:state', { ...this.getState(), appleNotch: this.snapshot() });
  }
  destroy() {
    this.disable();
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) this.screen.removeListener(event, this.onDisplays);
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
}
module.exports = { AppleNotch };
