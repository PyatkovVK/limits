'use strict';
// Run with Electron. All network, notification and browser activity is simulated.
const { app, BrowserWindow, shell, screen, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const parent = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(parent, { recursive: true });
const root = fs.mkdtempSync(path.join(parent, 'resets-smoke-'));
const profile = path.join(root, 'profile');
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.getVersion = () => pkg.version;
app.disableHardwareAcceleration();
global.fetch = async () => assert.fail('Smoke must not make network requests');
shell.openExternal = async () => assert.fail('Smoke must not open a browser');
Notification.prototype.show = () => assert.fail('Smoke must not show an OS notification');
process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../src/common/main.cjs');
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function waitFor(condition, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await condition()) return; await pause(); }
  throw new Error(`Timed out: ${label}`);
}
app.whenReady().then(async () => {
  try {
    let panel;
    await waitFor(async () => {
      panel = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
      if (!panel || panel.webContents.isLoading()) return false;
      return panel.webContents.executeJavaScript('window.limits?.get().then(next => next.updates?.status === "current" && next.resetNotifications?.status === "disabled")');
    }, 'ready with reset notifications disabled');
    const run = source => panel.webContents.executeJavaScript(source);
    await run('Promise.all([window.renderReady, window.limitsResetNotificationsReady])');
    await run('window.limits.open()');
    const languages = [];
    for (const language of ['ru', 'en']) {
      await run(`window.limits.language('${language}')`);
      await run('window.limitsSettings.open()');
      await waitFor(() => run('window.limitsSettings.dialog.open'), 'settings');
      assert.equal(await run('document.getElementById("reset-notifications-enabled").checked'), false);
      await run('document.querySelector(".reset-section").scrollIntoView({block:"start",behavior:"instant"})');
      await pause();
      fs.writeFileSync(path.join(root, `disabled-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      await run('document.getElementById("reset-notifications-info").click()');
      assert.equal(await run('document.getElementById("reset-notifications-info").getAttribute("aria-expanded")'), 'true');
      const help = await run('document.getElementById("reset-notifications-help").textContent');
      assert.ok(help.includes('codex-resets.com')); assert.ok(help.includes('@wong2__'));
      assert.ok(help.includes(language === 'ru' ? 'Спасибо' : 'Thanks'));
      assert.equal(await run('(() => { const info = document.getElementById("reset-notifications-info").getBoundingClientRect(); const label = document.querySelector(".reset-toggle").getBoundingClientRect(); return info.left > label.right; })()'), true);
      fs.writeFileSync(path.join(root, `help-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      // Escape closes the explanation first, keeping the Settings dialog open.
      await run('document.getElementById("reset-notifications-info").focus()');
      panel.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      panel.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await waitFor(() => run('document.getElementById("reset-notifications-help").hidden'), 'help dismissal');
      assert.equal(await run('window.limitsSettings.dialog.open'), true);
      await run('document.getElementById("reset-notifications-enabled").click()');
      await waitFor(() => run('window.limits.get().then(next => next.resetNotifications.enabled && next.resetNotifications.status === "ready")'), 'enabling');
      await waitFor(() => run('document.getElementById("reset-notifications-enabled").checked && !document.getElementById("reset-notifications-enabled").disabled'), 'checkbox state');
      assert.equal(await run('document.getElementById("reset-notifications-summary").hidden'), true);
      await run('window.limits.demoReset("scheduled")');
      await waitFor(() => run('!document.getElementById("reset-notifications-summary").hidden'), 'upcoming announcement');
      const future = await run('document.getElementById("reset-notifications-summary").textContent');
      assert.ok(future.includes(language === 'ru' ? 'Объявлен будущий сброс' : 'upcoming Codex reset'));
      await run('document.querySelector(".reset-section").scrollIntoView({block:"center",behavior:"instant"})'); await pause();
      fs.writeFileSync(path.join(root, `scheduled-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      // Exercise the actual demo control rather than just the preload command.
      await run('(() => { const select = document.getElementById("reset-notifications-demo"); select.value = "forecast"; select.dispatchEvent(new Event("change")); })()');
      await waitFor(() => run('document.getElementById("reset-notifications-summary").textContent.includes("80%")'), 'forecast');
      const forecast = await run('document.getElementById("reset-notifications-summary").textContent');
      assert.ok(forecast.includes(language === 'ru' ? 'не подтверждённое обещание' : 'not a confirmed commitment'));
      fs.writeFileSync(path.join(root, `forecast-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      await run('document.querySelector(".reset-source a").click(); document.querySelector(".reset-help a").click()');
      await run('window.limits.demoReset("error")');
      await waitFor(() => run('document.getElementById("reset-notifications-result").classList.contains("warning")'), 'API error');
      assert.equal(await run('document.getElementById("reset-notifications-summary").hidden'), true);
      await run('window.limits.demoReset("quiet")');
      await run('document.getElementById("reset-notifications-enabled").click()');
      await waitFor(() => run('window.limits.get().then(next => !next.resetNotifications.enabled && next.resetNotifications.status === "disabled")'), 'disabling');
      assert.equal(await run('document.getElementById("reset-notifications-demo").disabled'), true);
      languages.push({ language, defaultOff: true, future, forecast, helpOnRight: true, credits: true, errors: true });
      await run('window.limitsSettings.dialog.close()');
    }
    const outsider = new BrowserWindow({ show: false, webPreferences: { preload: path.resolve(__dirname, '../src/common/preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await outsider.loadURL('data:text/html,<title>Untrusted reset IPC</title>');
    for (const action of ['setResetNotifications(true)', 'openResetLink("site")', 'demoReset("forecast")']) {
      assert.equal(await outsider.webContents.executeJavaScript(`window.limits.${action}.then(() => false, () => true)`), true);
    }
    outsider.destroy();
    await run('window.limitsSettings.open(); document.getElementById("reset-notifications-info").click()');
    const primaryDisplay = screen.getPrimaryDisplay.bind(screen), matchingDisplay = screen.getDisplayMatching.bind(screen);
    const small = display => ({ ...display, workArea: { ...display.workArea, width: 360, height: 340 } });
    screen.getPrimaryDisplay = () => small(primaryDisplay()); screen.getDisplayMatching = bounds => small(matchingDisplay(bounds));
    panel.setMinimumSize(1, 1); panel.setMaximumSize(0, 0); panel.setSize(360, 324);
    await run('document.querySelector(".reset-toggle-row").scrollIntoView({block:"center",behavior:"instant"}); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    assert.equal(await run('(() => { const info = document.getElementById("reset-notifications-info").getBoundingClientRect(); const viewport = document.querySelector(".settings-content").getBoundingClientRect(); return info.left >= viewport.left && info.right <= viewport.right && info.top >= viewport.top && info.bottom <= viewport.bottom; })()'), true);
    assert.equal(await run('(() => { const el = document.querySelector(".settings-content"); return el.scrollWidth <= el.clientWidth + 1; })()'), true);
    fs.writeFileSync(path.join(root, 'small-window.png'), (await panel.webContents.capturePage()).toPNG());
    // Shared Settings colors must remain readable over a custom light background.
    await run('window.limits.setAppearance({mode:"color",color:"#ffffff"})');
    assert.equal(await run('getComputedStyle(document.querySelector(".reset-toggle")).color'), 'rgb(238, 238, 238)');
    assert.equal(fs.existsSync(path.join(profile, 'reset-notifications.json')), false, 'Demo does not persist real notification preferences');
    const report = { platform: process.platform, languages, trustedIpc: true, narrowLayout: true, noNetworkOrNotifications: true, artifacts: root };
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log('RESETS_SMOKE_OK', JSON.stringify(report));
    app.quit();
  } catch (error) { console.error('RESETS_SMOKE_FAILED', error.stack); app.exit(1); }
});
