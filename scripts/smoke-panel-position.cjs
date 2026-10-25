'use strict';
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const artifacts = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'placement-smoke-'));
const originalSet = app.setPath.bind(app);
app.setPath = (name, value) => originalSet(name, name === 'userData' ? root : value);
app.getVersion = () => require('../package.json').version;
app.disableHardwareAcceleration(); process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../src/common/main.cjs');
app.whenReady().then(async () => {
  try {
    let panel;
    for (let count = 0; count < 100; count++) {
      panel = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/index.html'));
      if (panel && !panel.webContents.isLoading()) break;
      await delay(100);
    }
    assert.ok(panel); await panel.webContents.executeJavaScript('window.renderReady');
    await panel.webContents.executeJavaScript('window.limits.open()'); await delay(250);
    // A native setPosition emits the same move events as a titlebar drag.
    const original = panel.getBounds(); panel.setPosition(original.x - 90, screen.getDisplayMatching(original).workArea.y + 48);
    await delay(400);
    const moved = panel.getBounds();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, process.platform === 'darwin' ? 'mac-panel-position.json' : 'linux-panel-position.json'))), { x: moved.x, y: moved.y });
    panel.hide(); await panel.webContents.executeJavaScript('window.limits.open()'); await delay(250);
    assert.equal(panel.getBounds().x, moved.x); assert.equal(panel.getBounds().y, moved.y);
    await panel.webContents.executeJavaScript('window.limits.panelSize(520)'); await delay(300);
    assert.equal(panel.getBounds().x, moved.x); assert.equal(panel.getBounds().y, moved.y);
    fs.writeFileSync(path.join(artifacts, 'panel-position.png'), (await panel.webContents.capturePage()).toPNG());
    console.log('PANEL_POSITION_SMOKE_OK: native movement, disk persistence, reopen, resizing'); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
