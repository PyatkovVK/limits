'use strict';
// Native notch checks do not require room for temporary menu-bar status items.
const { app, BrowserWindow, shell, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const layoutFixture = process.argv.includes('--layout-fixture');
const artifacts = path.resolve(__dirname, '../../../artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'mac-notch-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? path.join(root, 'profile') : value);
app.getVersion = () => require('../../../package.json').version;
app.disableHardwareAcceleration();
global.fetch = async () => assert.fail('Notch smoke must not access the network');
shell.openExternal = async () => assert.fail('Notch smoke must not open a browser');
Notification.prototype.show = () => assert.fail('Notch smoke must not show system notifications');

// Observe the real controllers; their production methods and IPC remain unchanged.
const instances = {};
function observe(modulePath, name, key) {
  const module = require(modulePath), Original = module[name];
  module[name] = class extends Original {
    constructor(options) {
      if (layoutFixture && key === 'notch') {
        const { screen } = options;
        options = { ...options, readNativeScreens: async () => {
          const { id, bounds } = screen.getPrimaryDisplay();
          return [{ id, top: 38, notchWidth: 220, notchX: (bounds.width - 220) / 2, menuBarLeft: 0, menuBarRight: bounds.width }];
        } };
      }
      super(options); instances[key] = this;
    }
  };
}
observe('../notch.cjs', 'AppleNotch', 'notch');
observe('../accounts.cjs', 'AppleAccounts', 'accounts');
observe('../../common/tray/tray.cjs', 'TrayPresentation', 'tray');
observe('../../common/ai-connects/codex/reset-notifications.cjs', 'ResetNotifications', 'resets');
process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../../common/main.cjs');

app.whenReady().then(async () => {
  try {
    assert.equal(process.platform, 'darwin', 'Run this check on macOS');
    const deadline = Date.now() + 20000;
    let panel;
    while (Date.now() < deadline) {
      panel = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
      if (panel && !panel.webContents.isLoading() && instances.notch?.available && instances.accounts &&
          instances.resets?.listenerCount('notification') && await panel.webContents.executeJavaScript('window.limits.get().then(next => next.status === "ready" && next.profiles?.length === 2)')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(instances.notch?.available, layoutFixture ? 'The layout fixture did not create a notch' : 'A connected display must have a physical notch');
    assert.ok(panel && instances.accounts && instances.resets?.listenerCount('notification'), 'Demo controllers did not become ready');
    await instances.notch.prepare();
    const initialMenuSpace = instances.notch.screenInfo;
    const report = await require('../smoke.cjs').verifyAppleIsland({
      appleNotch: instances.notch, target: instances.notch.window, trayWindow: panel, trayPresentation: instances.tray,
      artifactRoot: root, demo: true, monitor: instances.accounts, layoutFixture,
      showResetNotification(event) {
        const count = instances.notch.notifications.length;
        instances.resets.emit('notification', event);
        return instances.notch.notifications.length === count + 1;
      }
    });
    if (layoutFixture) {
      console.log('MAC_NOTCH_LAYOUT_OK', JSON.stringify(report));
      app.exit(0);
      return;
    }
    const live = await instances.notch.withModal(() => require('../smoke.cjs').verifyLiveAppleIsland({ appleNotch: instances.notch, target: instances.notch.window, artifactRoot: root }));
    const result = { ...report, live, initialMenuSpace, startupTrayChecked: false, artifacts: root };
    fs.writeFileSync(path.join(root, 'notch-smoke.json'), JSON.stringify(result, null, 2));
    console.log('MAC_NOTCH_SMOKE_OK', JSON.stringify(result));
    app.exit(0);
  } catch (error) { console.error('MAC_NOTCH_SMOKE_FAILED', error.stack || error.message); app.exit(1); }
});
