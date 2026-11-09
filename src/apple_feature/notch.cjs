'use strict';
const path = require('node:path');
const { chooseDisplay, notchLayout, fitMenuBar, hitBounds, contains } = require('./geometry.cjs');
const { readScreens } = require('./screens.cjs');

function keepMenuBoundaries(info, previous) {
  const measured = { ...info };
  for (const key of ['menuBarLeft', 'menuBarRight']) {
    if (!Number.isFinite(measured[key]) && Number.isFinite(previous?.[key])) measured[key] = previous[key];
  }
  return measured;
}

class AppleNotch {
  constructor({ BrowserWindow, screen, Menu, webPreferences, restrictWindow, resourcesPath, getState, getMenu, onChange, onUnavailable, readNativeScreens = options => readScreens(resourcesPath, options), now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, menuBarGrowDelay = 1000 }) {
    Object.assign(this, { BrowserWindow, screen, Menu, webPreferences, restrictWindow, getState, getMenu, onChange, onUnavailable, readNativeScreens, now, setTimer, clearTimer, menuBarGrowDelay });
    this.mode = 'notch'; this.notifications = []; this.notificationSequence = 0;
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
    const previous = this.layoutScreenInfo;
    const sameNotch = info && previous?.id === info.id && previous.notchX === info.notchX && previous.notchWidth === info.notchWidth;
    if (!sameNotch) this.menuBarContext = this.pendingMenuBarContext = null;
    this.display = display; this.screenInfo = sameNotch ? keepMenuBoundaries(info, previous) : info;
    this.layoutScreenInfo = this.screenInfo;
    this.layout = display ? notchLayout(display, this.screenInfo, this.mode) : null;
    this.fitContent();
  }

  fitContent() {
    if (!this.layout || !this.contentHeight) return;
    this.layout.fullHeight = Math.min(this.layout.maxFullHeight, Math.max(this.layout.peekHeight, this.contentHeight + this.layout.contentTop));
  }

  async refreshMenuBar({ initial = false } = {}) {
    if (!this.enabled || this.menuBarPending) return;
    this.menuBarPending = true;
    const activation = this.activation, revision = this.revision;
    try {
      const current = () => this.enabled && activation === this.activation && revision === this.revision;
      const read = async measureStatusItems => {
        try {
          const screens = await this.readNativeScreens({ measureStatusItems });
          return screens.find(info => info.id === this.display?.id && info.top > 0 && info.notchWidth > 0);
        } catch { return null; }
      };
      let info = await read(false);
      if (!current()) return;
      // A probe failure is not evidence of occupied space. Keep the last measurement.
      if (!info) { this.menuBarGrowth = this.pendingMenuBarContext = null; return; }
      const context = { apps: info.menuBarContext, foreground: info.menuBarForeground };
      const pending = this.pendingMenuBarContext;
      const previous = this.menuBarContext;
      const stable = context.apps && context.apps === pending?.apps && context.foreground === pending?.foreground;
      const appsChanged = context.apps !== previous?.apps;
      // A switch between running apps can make room without changing the process set.
      const foregroundChanged = this.layout.indicatorMode !== 'full' && context.foreground > 0 && context.foreground !== previous?.foreground;
      this.pendingMenuBarContext = context;
      // Periodic reads must not insert a status item and disturb the menu bar.
      if (this.mode === 'island' && !Number.isFinite(info.menuBarRight) && (initial || (stable && (appsChanged || foregroundChanged)))) {
        const measured = await read(true);
        if (!current()) return;
        if (!measured || (measured.menuBarContext === context.apps && measured.menuBarForeground === context.foreground)) {
          if (measured) info = measured;
          this.menuBarContext = context;
        }
      } else if (Number.isFinite(info.menuBarRight)) {
        this.menuBarContext = context;
      }
      this.screenInfo = keepMenuBoundaries(info, this.layoutScreenInfo);
      this.layoutScreenInfo = this.screenInfo;
      const next = notchLayout(this.display, this.screenInfo, this.mode);
      const change = next.menuBarWidth - this.layout.menuBarWidth;
      // The side insets absorb small variations without moving the panel.
      if (change === 0 || (!initial && Math.abs(change) < 8)) { this.menuBarGrowth = null; return; }
      if (!initial && change > 0) {
        // Use the space confirmed by every sample during the growth delay.
        const now = this.now();
        this.menuBarGrowth ??= { width: next.menuBarWidth, since: now };
        this.menuBarGrowth.width = Math.min(this.menuBarGrowth.width, next.menuBarWidth);
        if (now - this.menuBarGrowth.since < this.menuBarGrowDelay) return;
        next.menuBarWidth = this.menuBarGrowth.width;
      }
      this.menuBarGrowth = null;
      this.layout.menuBarWidth = next.menuBarWidth;
      this.update(); this.trackPointer();
    } finally { this.menuBarPending = false; }
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
    this.menuBarGrowth = null;
    this.menuBarContext = this.pendingMenuBarContext = null;
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
    this.menuBarGrowth = null;
    clearInterval(this.timer); this.timer = null;
    clearInterval(this.menuBarTimer); this.menuBarTimer = null;
    this.clearTimer(this.notificationTimer); this.notificationTimer = null; this.notifications = [];
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
  notify({ title, body, action = null }) {
    if (!this.enabled || this.mode !== 'island' || !title || !body) return false;
    this.notifications.push({ id: ++this.notificationSequence, title, body, action });
    if (this.notifications.length === 1) this.showNotification();
    else this.update();
    return true;
  }
  showNotification() {
    this.clearTimer(this.notificationTimer); this.notificationTimer = null;
    if (this.phase !== 'expanded') this.phase = 'notification';
    this.update();
    this.notificationTimer = this.setTimer(() => {
      // Keep the message readable while the pointer is over it or Settings is active.
      if (this.interactive || this.modalOperations) this.showNotification();
      else this.dismissNotification(this.notifications[0]?.id);
    }, 10000);
    this.notificationTimer?.unref?.();
  }
  dismissNotification(id) {
    if (!this.notifications.length || this.notifications[0].id !== id) return false;
    this.clearTimer(this.notificationTimer); this.notificationTimer = null;
    this.notifications.shift();
    if (this.notifications.length) this.showNotification();
    else if (this.phase === 'notification') this.collapse();
    else this.update();
    return true;
  }
  activateNotification(id) {
    const notification = this.notifications[0];
    if (!notification || notification.id !== id) return null;
    this.dismissNotification(id);
    return notification.action;
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
    this.setPhase(this.notifications.length ? 'notification' : 'closed'); this.setInteractive(false);
    if (this.window.isFocused()) this.window.blur();
  }
  snapshot() { return this.enabled && this.layout ? { mode: this.mode, phase: this.phase, notification: this.notifications[0] || null, notificationCount: this.notifications.length, browserOpening: Boolean(this.browserOpening), ...this.layout } : null; }
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
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) this.screen.removeListener(event, this.onDisplays);
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
}
module.exports = { AppleNotch };
