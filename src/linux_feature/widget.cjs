'use strict';
const fs = require('node:fs'), path = require('node:path');
const WIDTHS = [240, 280, 320, 400];
function widgetBounds(area, width, position) {
  width = Math.min(WIDTHS.includes(width) ? width : 280, Math.max(1, area.width - 16));
  const height = Math.min(56, Math.max(1, area.height - 16));
  return { x: Math.round(Math.max(area.x + 8, Math.min(area.x + area.width - width - 8, position?.x ?? area.x + area.width - width - 16))),
    y: Math.round(Math.max(area.y + 8, Math.min(area.y + area.height - height - 8, position?.y ?? area.y + area.height - height - 8))), width, height };
}
class LinuxWidget {
  constructor({ BrowserWindow, screen, Menu, root, webPreferences, restrictWindow, getMenu, getSettings }) {
    Object.assign(this, { screen, Menu, getMenu, getSettings });
    this.file = path.join(root, 'linux-widget-position.json');
    try { const saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); if (Number.isSafeInteger(saved.x) && Number.isSafeInteger(saved.y)) this.position = saved; } catch { /* First launch. */ }
    this.window = new BrowserWindow({ width: 280, height: 56, frame: false, resizable: false, show: false, skipTaskbar: true, alwaysOnTop: true,
      backgroundColor: '#171717', autoHideMenuBar: true, webPreferences });
    restrictWindow(this.window);
    this.onMove = () => { clearTimeout(this.moveTimer); this.moveTimer = setTimeout(() => this.savePosition(), 200); this.moveTimer.unref?.(); };
    this.window.on('move', this.onMove);
    this.window.webContents.on('context-menu', () => this.Menu.buildFromTemplate(this.getMenu()).popup({ window: this.window }));
    this.onDisplayChange = () => this.apply(this.getSettings());
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(event, this.onDisplayChange);
  }
  async start() { await this.window.loadFile(path.join(__dirname, 'renderer/widget.html')); this.apply(this.getSettings()); return this.window; }
  savePosition() {
    if (this.window.isDestroyed()) return;
    const { x, y } = this.window.getBounds();
    if (this.expected?.x === x && this.expected?.y === y) return;
    this.position = { x, y };
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.position)); fs.renameSync(`${this.file}.tmp`, this.file); } catch { /* Keep position in memory. */ }
  }
  apply(settings) {
    if (this.window.isDestroyed()) return;
    const display = this.position ? this.screen.getDisplayMatching({ ...this.position, width: settings.width, height: 56 }) : this.screen.getPrimaryDisplay();
    const bounds = widgetBounds(display.workArea, settings.width, this.position);
    this.expected = bounds;
    const current = this.window.getBounds();
    if (Object.keys(bounds).some(key => current[key] !== bounds[key])) this.window.setBounds(bounds, false);
    if (settings.displayMode === 'widget' && settings.visible !== false) this.window.showInactive(); else this.window.hide();
  }
  reset() { this.position = null; try { fs.rmSync(this.file, { force: true }); } catch {} this.apply(this.getSettings()); }
  destroy() {
    clearTimeout(this.moveTimer); if (this.moveTimer) this.savePosition();
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) this.screen.removeListener(event, this.onDisplayChange);
    this.window.removeListener('move', this.onMove);
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}
module.exports = { LinuxWidget, widgetBounds };
