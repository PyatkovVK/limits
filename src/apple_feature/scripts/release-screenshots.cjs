'use strict';
// Launch the actual app with demo data and a plain backdrop for native screenshots.
// Capture through macOS; never draw or replace the system UI.
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (process.platform !== 'darwin') throw new Error('Release screenshots require macOS');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-native-release-'));
app.setPath('appData', scratch);
if (!process.argv.includes('--demo')) process.argv.push('--demo');
require('../../main.cjs');

app.whenReady().then(async () => {
  const backdrop = new BrowserWindow({ ...screen.getPrimaryDisplay().workArea, frame: false,
    show: false, skipTaskbar: true, focusable: false, backgroundColor: '#bfc6d0',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await backdrop.loadURL('data:text/html,<html><body style="margin:0;background:%23bfc6d0"></body></html>');
  backdrop.setTitle('Neutral backdrop');
  backdrop.setAlwaysOnTop(true, 'floating');
  backdrop.showInactive();
  const ready = setInterval(async () => {
    const panel = BrowserWindow.getAllWindows().find(window => window !== backdrop &&
      window.webContents.getURL().endsWith('/renderer/index.html'));
    if (!panel) return;
    try {
      const state = await panel.webContents.executeJavaScript('window.limits.get()');
      if (state.status !== 'ready') return;
      clearInterval(ready);
      panel.setAlwaysOnTop(true, 'pop-up-menu');
      await panel.webContents.executeJavaScript('window.limits.open()');
      console.log('NATIVE_RELEASE_READY', JSON.stringify({ panel: panel.getBounds(), display: screen.getPrimaryDisplay().bounds, mode: state.displayMode }));
    } catch { /* The preload API may still be initializing. */ }
  }, 100);
  app.once('before-quit', () => { clearInterval(ready); backdrop.destroy(); });
}).catch(error => { console.error(error); app.exit(1); });
app.once('quit', () => fs.rmSync(scratch, { recursive: true, force: true }));
