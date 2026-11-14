'use strict';
const { chooseDisplay, notchLayout, fitMenuBar, hitBounds, contains } = require('./geometry.cjs');
const { readScreens } = require('./screens.cjs');
const { MenuBarMeasurement } = require('./menu-bar.cjs');
const { NotchNotifications } = require('./notifications.cjs');
const { createNotchWindow, loadNotchWindow } = require('./window.cjs');

const displayEvents = ['display-added', 'display-removed', 'display-metrics-changed'];

class AppleNotch {
  #notifications;

  constructor({
    BrowserWindow, screen, Menu, webPreferences, restrictWindow, resourcesPath,
    getState, getMenu, onChange, onUnavailable,
    readNativeScreens = options => readScreens(resourcesPath, options),
    now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, menuBarGrowDelay = 1000
  }) {
    Object.assign(this, { BrowserWindow, screen, Menu, webPreferences, restrictWindow, getState, getMenu, onChange, onUnavailable, readNativeScreens, now });
    this.mode = 'notch';
    this.phase = 'closed';
    this.enabled = false;
    this.available = false;
    this.revision = 0;
    this.activation = 0;
    this.menuBar = new MenuBarMeasurement({
      readScreens: options => this.readNativeScreens(options),
      now,
      growDelay: menuBarGrowDelay
    });
    this.#notifications = new NotchNotifications({
      setTimer, clearTimer,
      shouldKeepVisible: () => this.interactive || this.modalOperations,
      onChange: showCurrent => {
        if (showCurrent && this.phase !== 'expanded') this.phase = 'notification';
        if (!this.#notifications.current && this.phase === 'notification') this.collapse();
        else this.update();
      }
    });
    this.onDisplays = async () => {
      await this.discover();
      if (this.enabled && !this.available) { this.disable(); this.onUnavailable(); }
      else if (this.enabled) this.place();
      this.onChange();
    };
    for (const event of displayEvents) screen.on(event, this.onDisplays);
  }

  get screenInfo() { return this.menuBar.info; }

  async prepare() {
    if (this.window) return;
    this.window = createNotchWindow({
      BrowserWindow: this.BrowserWindow,
      webPreferences: this.webPreferences,
      restrictWindow: window => this.restrictWindow(window),
      onBlur: () => { if (this.enabled && this.phase === 'expanded' && !this.modalOperations) this.collapse(); },
      onClose: () => this.collapse(),
      onContextMenu: () => { if (this.enabled) this.Menu.buildFromTemplate(this.getMenu()).popup({ window: this.window }); }
    });
    await loadNotchWindow(this.window);
  }

  async withModal(operation) {
    this.modalOperations = (this.modalOperations || 0) + 1;
    try { return await operation(); } finally { this.modalOperations--; }
  }

  async beforeBrowserLogin(wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
    if (!this.enabled || this.phase !== 'expanded') return;
    const activation = this.activation;
    this.browserOpening = true; this.update();
    try {
      await this.withModal(() => wait(1200));
      if (this.enabled && this.activation === activation) this.collapse();
    } finally { this.browserOpening = false; this.update(); }
  }

  async discover() {
    const revision = ++this.revision;
    const screens = await this.readNativeScreens();
    if (revision !== this.revision) return;
    const display = chooseDisplay(this.screen.getAllDisplays(), screens, this.screen.getPrimaryDisplay());
    this.available = Boolean(display);
    const info = screens.find(info => info.id === display?.id);
    this.display = display;
    const measured = this.menuBar.remember(info);
    this.layout = display ? notchLayout(display, measured, this.mode) : null;
    this.fitContent();
  }

  fitContent() {
    if (!this.layout || !this.contentHeight) return;
    this.layout.fullHeight = Math.min(this.layout.maxFullHeight, Math.max(this.layout.peekHeight, this.contentHeight + this.layout.contentTop));
  }

  async refreshMenuBar({ initial = false } = {}) {
    if (!this.enabled || !this.layout) return;
    const activation = this.activation;
    const revision = this.revision;
    const isCurrent = () => this.enabled && activation === this.activation && revision === this.revision;
    const { indicatorMode, menuBarWidth } = this.layout;
    const width = await this.menuBar.refresh({
      display: this.display, indicatorMode, previousWidth: menuBarWidth, mode: this.mode, initial, isCurrent
    });
    if (width === null || !isCurrent()) return;
    this.layout.menuBarWidth = width;
    this.update();
    this.trackPointer();
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

  async enable(mode = 'notch') {
    if (!['notch', 'island'].includes(mode)) throw new Error('Unknown notch presentation');
    if (this.enabled && this.mode === mode) return;
    if (this.enabled) this.disable();
    if (!this.available) throw new Error('No physical notch on connected displays');
    this.mode = mode;
    this.menuBar.resetGrowth();
    this.menuBar.resetContext();
    this.layout = notchLayout(this.display, this.screenInfo, mode); this.fitContent();
    const activation = ++this.activation;
    await this.prepare();
    if (activation !== this.activation || !this.available) return;
    this.enabled = true; this.phase = 'closed';
    // Refresh before showing, rather than flashing an unmeasured width first.
    await this.refreshMenuBar({ initial: true });
    if (!this.enabled || activation !== this.activation || !this.available) return;
    this.hoverBlocked = false; this.enteredAt = this.leftAt = null;
    this.place();
    this.window.showInactive();
    this.timer = setInterval(() => this.trackPointer(), 50);
    this.menuBarTimer = setInterval(() => { void this.refreshMenuBar(); }, 1000);
    this.menuBarTimer.unref?.();
    this.trackPointer(); this.onChange();
  }

  disable() {
    this.enabled = false; this.revision++; this.activation++;
    this.menuBar.resetGrowth();
    clearInterval(this.timer); this.timer = null;
    clearInterval(this.menuBarTimer); this.menuBarTimer = null;
    this.#notifications.clear();
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
    if (this.phase === 'expanded' || this.phase === 'notification') return;
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
  notify(message) {
    return this.enabled && this.mode === 'island' && this.#notifications.enqueue(message);
  }

  dismissNotification(id) {
    return this.#notifications.dismiss(id);
  }

  activateNotification(id) {
    return this.#notifications.activate(id);
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
    this.setPhase(this.#notifications.count ? 'notification' : 'closed'); this.setInteractive(false);
    if (this.window.isFocused()) this.window.blur();
  }
  snapshot() {
    if (!this.enabled || !this.layout) return null;
    return {
      mode: this.mode,
      phase: this.phase,
      notification: this.#notifications.current,
      notificationCount: this.#notifications.count,
      browserOpening: Boolean(this.browserOpening),
      ...this.layout
    };
  }

  update() {
    if (!this.window || this.window.isDestroyed()) return;
    const state = this.getState();
    if (this.layout) {
      const group = state.groups?.find(group => group.id === state.selectedId) || state.groups?.[0];
      const count = state.displaySchema?.groups?.find(schema => schema.id === group?.id)?.metrics.length || 2;
      fitMenuBar(this.layout, this.mode, count, state.preferences?.islandHoverStyle);
      this.fitContent();
    }
    this.window.webContents.send('limits:state', { ...state, appleNotch: this.snapshot() });
  }
  destroy() {
    this.disable();
    for (const event of displayEvents) this.screen.removeListener(event, this.onDisplays);
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
}
module.exports = { AppleNotch };
