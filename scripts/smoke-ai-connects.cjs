'use strict';
// Exercise the real renderers with an in-memory controller and isolated storage.
const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Accounts } = require('../src/common/core/accounts.cjs');
const { ControllerRegistry } = require('../src/common/ai-connects/registry.cjs');
const { MoneyController } = require('../test/fixtures/money-controller.cjs');
const artifacts = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'ai-connects-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? path.join(root, 'profile') : value);
app.disableHardwareAcceleration();
global.fetch = async () => assert.fail('Smoke must not access the network');
shell.openExternal = async () => assert.fail('Smoke must not open a browser');
Notification.prototype.show = () => assert.fail('Smoke must not show notifications');
process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../src/main.cjs');
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function waitFor(condition, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await condition()) return; await pause(); }
  throw new Error(`Timed out: ${label}`);
}
app.whenReady().then(async () => {
  let accounts, widget;
  try {
    let panel;
    await waitFor(async () => {
      panel = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/index.html'));
      return panel && !panel.webContents.isLoading() && panel.webContents.executeJavaScript('window.limits?.get().then(next => next.profiles?.length === 2)');
    }, 'demo ready');
    const run = source => panel.webContents.executeJavaScript(source);
    await run('window.renderReady');
    const base = await run('window.limits.get()');
    const appearance = await run('window.limits.appearance()');
    const registry = new ControllerRegistry().register('test-money', { create: options => new MoneyController(options) });
    accounts = new Accounts({ root: path.join(root, 'accounts'), registry, initialProfiles: [{ id: 'default', providerId: 'test-money', nickname: 'Test wallet' }] });
    const extra = accounts.add('test-money'); accounts.rename(extra, 'Second wallet'); await accounts.refresh();
    const state = () => ({ ...base, ...accounts.snapshot(), demo: true, readOnly: false, subscriptions: null });
    const publish = () => {
      for (const target of [panel, widget]) if (target && !target.isDestroyed()) target.webContents.send('limits:state', state());
    };
    ipcMain.removeHandler('limits:get'); ipcMain.handle('limits:get', state);
    ipcMain.removeHandler('limits:appearance-get'); ipcMain.handle('limits:appearance-get', () => appearance);
    ipcMain.removeHandler('limits:profile-action'); ipcMain.handle('limits:profile-action', (_event, action, id) => {
      assert.equal(action, 'select'); accounts.selectProfile(id); publish(); return {};
    });
    if (process.platform === 'win32') {
      widget = new BrowserWindow({ width: 280, height: 39, show: false, frame: false, webPreferences: { preload: path.resolve(__dirname, '../src/common/preload.cjs'), contextIsolation: true, sandbox: true } });
      await widget.loadFile(path.resolve(__dirname, '../src/windows_feature/panel/widget.html'));
      await widget.webContents.executeJavaScript('window.renderReady');
    }
    for (const language of ['en', 'ru']) {
      base.language = language; publish();
      await waitFor(() => run(`document.querySelector('#provider-metrics .metric-label').textContent.includes('${language === 'ru' ? 'Баланс' : 'Balance'}')`), 'localized balance');
      assert.equal(await run('document.getElementById("provider-metrics").hidden'), false);
      assert.match(await run('document.querySelector("#provider-metrics .metric-value").textContent'), /USD/);
      assert.equal(await run('[...document.querySelectorAll("#provider-metrics progress")].every(node => node.hidden)'), true);
      assert.equal(await run('document.querySelector(".quota-card.short").hidden'), true);
      assert.equal(await run('document.querySelector("#provider-metrics time").hidden'), true);
      panel.showInactive(); await pause();
      fs.writeFileSync(path.join(root, `money-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      if (widget) {
        await waitFor(() => widget.webContents.executeJavaScript('document.querySelector(".metric-compact .metric-value")?.textContent.includes("USD")'), 'compact money');
        assert.equal(await widget.webContents.executeJavaScript('document.querySelector(".metric-compact").textContent.includes("%")'), false);
        assert.equal(await widget.webContents.executeJavaScript('[...document.querySelectorAll(".quota")].every(node => getComputedStyle(node).display === "none")'), true);
        assert.equal(await widget.webContents.executeJavaScript('[...document.querySelectorAll(".metric-compact-row")].every(node => { const rect = node.getBoundingClientRect(); return rect.right <= innerWidth && rect.bottom <= innerHeight; })'), true);
        fs.writeFileSync(path.join(root, `money-widget-${language}.png`), (await widget.webContents.capturePage()).toPNG());
      }
    }
    await run('window.limitsSettings.open()'); publish();
    await waitFor(() => run('document.querySelectorAll(".profile-metrics .metric-value").length === 4'), 'account summaries');
    await run(`document.querySelector('[data-profile-id="${extra}"] .profile-select').click()`);
    await waitFor(() => run(`document.querySelector('[data-profile-id="${extra}"]').classList.contains('selected')`), 'profile selection');
    await run('window.limitsSettings.dialog.close()');
    const controller = accounts.monitors.get(extra).controller;
    controller.balance = 0; await accounts.refresh(); publish();
    await waitFor(() => run('window.limitsMetrics.view(state).primary.value === 0 && document.querySelector("#provider-metrics .metric-value").textContent.includes("0")'), 'zero balance');
    controller.balance = null; await accounts.refresh(); publish();
    await waitFor(() => run('document.querySelector("#provider-metrics .metric-value").textContent === "—"'), 'missing balance');
    controller.offline = true; await accounts.refresh(); publish();
    await waitFor(() => run('document.body.classList.contains("stale")'), 'stale state');
    await run(`render(${JSON.stringify(base)})`);
    assert.equal(await run('document.querySelector(".quota-card.short").hidden'), false);
    assert.equal(await run('document.getElementById("short-value").textContent'), '72');
    const report = { platform: process.platform, monetaryDetails: true, localized: true, accountSummaries: true, selection: true, zeroAndMissing: true, staleState: true, restoredCodexLayout: true, windowsWidget: Boolean(widget), artifacts: root };
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log('AI_CONNECTS_SMOKE_OK', JSON.stringify(report));
    accounts.stop(); widget?.destroy(); app.quit();
  } catch (error) { accounts?.stop(); console.error('AI_CONNECTS_SMOKE_FAILED', error.stack); app.exit(1); }
});
