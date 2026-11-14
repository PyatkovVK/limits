'use strict';

const path = require('node:path');
const { widgetBounds } = require('./widget-bounds.cjs');
const { WidgetPositionStore } = require('./position-store.cjs');

class LinuxWidget {
  constructor({
    BrowserWindow, screen, Menu, root, webPreferences, restrictWindow, getMenu, getSettings,
    positionStore = new WidgetPositionStore({ root })
  }) {
    Object.assign(this, { screen, Menu, getMenu, getSettings });
    this.positionStore = positionStore;
    this.position = positionStore.load();
    this.window = new BrowserWindow({
      width: 280, height: 56, frame: false, resizable: false, show: false,
      skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#171717',
      autoHideMenuBar: true, webPreferences
    });
    restrictWindow(this.window);
    this.onMove = () => {
      clearTimeout(this.moveTimer);
      this.moveTimer = setTimeout(() => this.savePosition(), 200);
      this.moveTimer.unref?.();
    };
    this.window.on('move', this.onMove);
    this.window.webContents.on('context-menu', () => {
      this.Menu.buildFromTemplate(this.getMenu()).popup({ window: this.window });
    });
    this.onDisplayChange = () => this.apply(this.getSettings());
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) {
      screen.on(event, this.onDisplayChange);
    }
  }

  async start() {
    await this.window.loadFile(path.join(__dirname, 'renderer/widget.html'));
    this.apply(this.getSettings());
    return this.window;
  }

  savePosition() {
    if (this.window.isDestroyed()) return;
    const { x, y } = this.window.getBounds();
    if (this.expected?.x === x && this.expected?.y === y) return;
    this.position = { x, y };
    this.positionStore.save(this.position);
  }

  apply(settings) {
    if (this.window.isDestroyed()) return;
    const display = this.position
      ? this.screen.getDisplayMatching({ ...this.position, width: settings.width, height: 56 })
      : this.screen.getPrimaryDisplay();
    const bounds = widgetBounds(display.workArea, settings.width, this.position);
    this.expected = bounds;
    const current = this.window.getBounds();
    if (Object.keys(bounds).some(key => current[key] !== bounds[key])) this.window.setBounds(bounds, false);
    const visible = settings.displayMode === 'widget' && settings.visible !== false;
    if (visible && !this.window.isVisible()) this.window.showInactive();
    else if (!visible && this.window.isVisible()) this.window.hide();
  }

  reset() {
    this.position = null;
    this.positionStore.clear();
    this.apply(this.getSettings());
  }

  destroy() {
    clearTimeout(this.moveTimer);
    if (this.moveTimer) this.savePosition();
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) {
      this.screen.removeListener(event, this.onDisplayChange);
    }
    this.window.removeListener('move', this.onMove);
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}

module.exports = { LinuxWidget };
