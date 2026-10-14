'use strict';
// Run with Electron; all account, GitHub and browser activity is simulated.
const { app, BrowserWindow, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const parent = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(parent, { recursive: true });
const root = fs.mkdtempSync(path.join(parent, 'updates-smoke-'));
const profile = path.join(root, 'profile');
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.getVersion = () => pkg.version;
app.disableHardwareAcceleration();
shell.openExternal = async () => assert.fail('Smoke must not open an external browser');
global.fetch = async () => assert.fail('Smoke must not contact GitHub');
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
      return panel.webContents.executeJavaScript('window.limits && window.limits.get().then(next => next.updates?.status === "current")');
    }, 'startup update check');
    const run = source => panel.webContents.executeJavaScript(source);
    await run('Promise.all([window.renderReady, window.limitsUpdatesReady])');
    await run('window.limits.open()');
    const languages = [];
    for (const language of ['ru', 'en']) {
      await run(`window.limits.language('${language}')`);
      await run('window.limitsSettings.open()');
      await waitFor(() => run('document.getElementById("settings-dialog").open'), 'settings dialog');
      const labels = await run('({ check: document.getElementById("updates-check").textContent, version: document.getElementById("updates-version").textContent, status: document.getElementById("updates-result").textContent })');
      assert.equal(labels.check, language === 'ru' ? 'Проверить обновления' : 'Check for updates');
      assert.ok(labels.version.includes(pkg.version));
      await run('document.querySelector(".updates-section").scrollIntoView({block:"center"})');
      fs.writeFileSync(path.join(root, `settings-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      // A found update waits for Settings to close rather than stacking dialogs.
      const pending = run('window.limits.demoUpdate("available")');
      await waitFor(() => run('document.getElementById("updates-check").disabled'), 'checking state');
      await pending;
      assert.equal(await run('document.getElementById("updates-dialog").open'), false);
      assert.equal(await run('document.getElementById("updates-open").hidden'), false);
      await run('window.limitsSettings.dialog.close()');
      await waitFor(() => run('document.getElementById("updates-dialog").open'), 'deferred offer');
      fs.writeFileSync(path.join(root, `offer-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      // Background checks must retain the same open modal in a hidden host.
      await run('(() => { const dialog = document.getElementById("updates-dialog"); const show = dialog.showModal.bind(dialog); window.updateModalChecks = {shows:0,closes:0}; dialog.showModal = () => { window.updateModalChecks.shows++; show(); }; dialog.addEventListener("close", () => window.updateModalChecks.closes++); })()');
      panel.hide();
      await waitFor(() => run('document.hidden'), 'hidden details window');
      for (let cycle = 0; cycle < 4; cycle++) {
        await run('window.limits.checkUpdates()');
        assert.equal(panel.isVisible(), false, 'Polling must not reopen the hidden host');
        assert.deepEqual(await run('({open:document.getElementById("updates-dialog").open,count:document.querySelectorAll("#updates-dialog").length,...window.updateModalChecks})'), { open: true, count: 1, shows: 0, closes: 0 });
      }
      await run('window.limits.open()');
      await waitFor(() => run('!document.hidden'), 'explicit reopening');
      assert.deepEqual(await run('window.updateModalChecks'), { shows: 0, closes: 0 }, 'Explicit host reopening retains the original modal');
      await run('window.limitsSettings.open()');
      assert.equal(await run('window.limitsSettings.dialog.open'), false, 'Settings waits for the offer to close');
      if (language === 'ru') {
        panel.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
        panel.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      } else await run('document.getElementById("updates-later").click()');
      await waitFor(() => run('!document.getElementById("updates-dialog").open'), 'dismissal');
      assert.equal(panel.isVisible(), true, 'Escape must not hide the details host');
      await waitFor(() => run('window.limitsSettings.dialog.open'), 'queued settings');
      await run('document.getElementById("updates-check").click()');
      await waitFor(() => run('document.getElementById("updates-check").disabled'), 'manual checking state');
      await waitFor(() => run('!document.getElementById("updates-check").disabled'), 'manual check completion');
      assert.equal(await run('document.getElementById("updates-dialog").open'), false);
      await run('window.limitsSettings.open(); document.getElementById("updates-open").click()');
      await waitFor(() => run('document.querySelector(".updates-section").textContent.includes(' + JSON.stringify(language === 'ru' ? 'без запуска браузера' : 'without opening a browser') + ')'), 'simulated release opening');
      await run('window.limits.demoUpdate("error")');
      assert.equal(await run('document.getElementById("updates-result").classList.contains("warning")'), true);
      fs.writeFileSync(path.join(root, `error-${language}.png`), (await panel.webContents.capturePage()).toPNG());
      await run('window.limits.demoUpdate("current")');
      assert.equal(await run('document.getElementById("updates-open").hidden'), true);
      await run('window.limitsSettings.dialog.close()');
      languages.push({ language, ...labels, offerDeferred: true, backgroundChecks: 4, modalRetained: true, dismissed: true, browserSimulated: true, failureShown: true });
    }
    // Even a window using the common preload cannot invoke commands unless trusted.
    const outsider = new BrowserWindow({ show: false, webPreferences: { preload: path.resolve(__dirname, '../src/common/preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await outsider.loadURL('data:text/html,<title>Untrusted IPC test</title>');
    for (const action of ['checkUpdates()', 'openRelease()', 'dismissUpdate("1.4.0")', 'demoUpdate("available")']) {
      assert.equal(await outsider.webContents.executeJavaScript(`window.limits.${action}.then(() => false, () => true)`), true);
    }
    outsider.destroy();
    // Check scrolling on a smaller window and contrast over a light background.
    await run('window.limits.setAppearance({mode:"color",color:"#ffffff"})');
    await run('window.limitsSettings.open(); document.querySelector(".updates-section").scrollIntoView({block:"center"})');
    await pause();
    // The panel owns native sizing, so model a small work area rather than
    // resizing against the real monitor's much larger available height.
    const primaryDisplay = screen.getPrimaryDisplay.bind(screen);
    const matchingDisplay = screen.getDisplayMatching.bind(screen);
    const smallDisplay = display => ({ ...display, workArea: { ...display.workArea, width: 360, height: 340 } });
    screen.getPrimaryDisplay = () => smallDisplay(primaryDisplay());
    screen.getDisplayMatching = bounds => smallDisplay(matchingDisplay(bounds));
    panel.setMinimumSize(1, 1); panel.setMaximumSize(0, 0); panel.setSize(360, 324);
    await run('document.getElementById("updates-check").scrollIntoView({block:"center",behavior:"instant"}); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const layout = await run('(() => { const dialog = document.getElementById("settings-dialog"); const bounds = dialog.getBoundingClientRect(); const content = dialog.querySelector(".settings-content"); return {width:innerWidth,height:innerHeight,bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},scrolls:content.scrollHeight > content.clientHeight}; })()');
    assert.ok(layout.bounds.x >= 0 && layout.bounds.x + layout.bounds.width <= layout.width + 1);
    assert.ok(layout.bounds.y >= 0 && layout.bounds.y + layout.bounds.height <= layout.height + 1);
    assert.ok(layout.width <= 360 && layout.height <= 340);
    assert.equal(await run('(() => { const button = document.getElementById("updates-check").getBoundingClientRect(); const viewport = document.querySelector(".settings-content").getBoundingClientRect(); return button.top >= viewport.top && button.bottom <= viewport.bottom; })()'), true, 'The check button remains reachable by scrolling');
    fs.writeFileSync(path.join(root, 'small-window.png'), (await panel.webContents.capturePage()).toPNG());
    await run('window.limits.demoUpdate("available")');
    await run('window.limitsSettings.dialog.close()');
    await waitFor(() => run('document.getElementById("updates-dialog").open'), 'offer over a light background');
    assert.equal(await run('getComputedStyle(document.querySelector(".updates-dialog .warning")).color'), 'rgb(238, 238, 238)', 'Custom background must not make dialog errors unreadable');
    fs.writeFileSync(path.join(root, 'offer-light-background.png'), (await panel.webContents.capturePage()).toPNG());
    await run('document.getElementById("updates-later").click()');
    await waitFor(() => run('!document.getElementById("updates-dialog").open'), 'final offer dismissal');
    const report = { platform: process.platform, version: pkg.version, languages, trustedIpc: true, layout };
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log('UPDATES_SMOKE_OK', JSON.stringify({ ...report, artifacts: root }));
    await run('window.limitsSettings.dialog.close()');
    app.quit();
  } catch (error) { console.error('UPDATES_SMOKE_FAILED', error.stack); app.exit(1); }
});
app.on('will-quit', () => {
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) !== root || !root.startsWith(parent + path.sep) || !path.basename(root).startsWith('updates-smoke-')) throw new Error('Unsafe smoke cleanup path');
  // Chromium can keep cache files locked until after will-quit on Windows.
  // Preserve the isolated demo profile rather than turn a passing check into
  // an uncaught shutdown exception; screenshots and the report stay available.
  try { fs.rmSync(resolved, { recursive: true, force: true }); }
  catch { console.log('UPDATES_SMOKE_PROFILE_RETAINED', resolved); }
});
