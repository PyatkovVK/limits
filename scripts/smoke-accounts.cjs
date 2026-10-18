'use strict';
// Real renderers and account registry; isolated demo monitors never sign out real accounts.
const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Accounts } = require('../src/common/accounts.cjs');
const { DemoMonitor } = require('../src/common/demo-monitor.cjs');
app.getVersion = () => require('../package.json').version;
const artifacts = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'accounts-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? path.join(root, 'profile') : value);
app.disableHardwareAcceleration();
global.fetch = async () => assert.fail('Smoke must not access the network');
shell.openExternal = async () => assert.fail('Smoke must not open a browser');
Notification.prototype.show = () => assert.fail('Smoke must not show a notification');
process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../src/common/main.cjs');
const pause = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
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
      return panel && !panel.webContents.isLoading() && panel.webContents.executeJavaScript('window.limits?.get().then(next => next.profiles?.length === 2 && next.updates?.status === "current")');
    }, 'demo ready');
    const run = source => panel.webContents.executeJavaScript(source);
    await run('window.renderReady');
    const base = await run('window.limits.get()');
    const appearance = await run('window.limits.appearance()');
    const work = base.profiles[1].id;
    accounts = new Accounts({ root: path.join(root, 'accounts'), initialProfiles: base.profiles, createMonitor: profile => new DemoMonitor(profile) });
    const state = () => ({ ...base, ...accounts.snapshot(), demo: false });
    const publish = () => {
      for (const target of [panel, widget]) if (target && !target.isDestroyed()) target.webContents.send('limits:state', state());
    };
    let failRemoval = true, removeCalls = 0;
    ipcMain.removeHandler('limits:get');
    ipcMain.handle('limits:get', state);
    ipcMain.removeHandler('limits:appearance-get');
    ipcMain.handle('limits:appearance-get', () => appearance);
    ipcMain.removeHandler('limits:profile-action');
    ipcMain.handle('limits:profile-action', async (_event, action, id) => {
      if (action === 'select') accounts.selectProfile(id);
      else if (action === 'remove') {
        removeCalls++;
        await pause(150);
        if (failRemoval) return { error: 'accountActionFailed' };
        await accounts.remove(id);
      } else assert.fail(`Unexpected fixture action: ${action}`);
      publish(); return {};
    });
    await run('window.limits.get().then(render); window.limits.open(); window.limitsSettings.open()');
    const workCard = `[data-profile-id="${work}"]`;
    for (const language of ['ru', 'en']) {
      base.language = language; publish();
      await waitFor(() => run(`document.documentElement.lang === '${language}'`), 'language');
      const button = await run(`(() => { const card = document.querySelector('${workCard}'); const button = card.querySelector('.profile-remove'); return { collapsed: !card.querySelector('details').open, inHeading: button.parentElement.classList.contains('profile-heading'), label: button.getAttribute('aria-label'), icon: Boolean(button.querySelector('svg')), enabled: !button.disabled, sharedHidden: document.querySelector('[data-profile-id="default"] .profile-remove').hidden }; })()`);
      assert.equal(button.collapsed && button.inHeading && button.icon && button.enabled && button.sharedHidden, true);
      assert.equal(button.label, `${language === 'ru' ? 'Отключить' : 'Disconnect'}: Work`);
      await run('document.querySelector(".accounts-section").scrollIntoView({block:"center",behavior:"instant"})');
      await pause(120);
      fs.writeFileSync(path.join(root, `trash-${language}.png`), (await panel.webContents.capturePage()).toPNG());
    }
    await run(`document.querySelector('${workCard} .profile-remove').click(); document.querySelector('${workCard} .profile-remove').click()`);
    publish(); await pause(50);
    assert.equal(await run(`document.querySelector('${workCard} .profile-remove').disabled`), true);
    await waitFor(() => run('!document.getElementById("error").hidden'), 'disconnect error');
    assert.equal(removeCalls, 1);
    assert.equal(await run(`!document.querySelector('${workCard} .profile-remove').disabled && !document.querySelector('${workCard} details').open`), true);
    failRemoval = false;
    await run(`document.querySelector('${workCard} .profile-select').click()`);
    await waitFor(() => run(`document.querySelector('${workCard}').classList.contains('selected')`), 'selected work account');
    panel.show(); panel.focus(); panel.webContents.focus(); await pause(100);
    await run(`document.querySelector('${workCard} .profile-remove').focus()`);
    assert.equal(await run(`document.activeElement === document.querySelector('${workCard} .profile-remove')`), true);
    panel.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    panel.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
    panel.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    await pause(250);
    assert.equal(removeCalls, 2, JSON.stringify(await run('({ focused: document.hasFocus(), active: document.activeElement.className, error: document.getElementById("error").textContent })')));
    await waitFor(() => run(`!document.querySelector('${workCard}')`), 'keyboard disconnect');
    assert.equal(accounts.snapshot().selectedProfileId, 'default');
    assert.equal(removeCalls, 2);
    const saved = JSON.parse(fs.readFileSync(accounts.file, 'utf8'));
    assert.equal(saved.profiles.length, 1); assert.equal(saved.selectedProfileId, 'default');
    await run('window.limitsSettings.dialog.close()');
    const quota = accounts.monitors.get('default').state.buckets[0];
    if (process.platform === 'win32') {
      widget = new BrowserWindow({ width: 280, height: 39, show: false, frame: false, webPreferences: { preload: path.resolve(__dirname, '../src/common/preload.cjs'), contextIsolation: true, sandbox: true } });
      await widget.loadFile(path.resolve(__dirname, '../src/windows_feature/renderer/widget.html'));
      await widget.webContents.executeJavaScript('window.renderReady');
    }
    for (const kind of ['short', 'weekly']) {
      quota.short.remaining = kind === 'short' ? 67 : 68;
      quota.weekly.remaining = kind === 'weekly' ? 67 : 66;
      publish();
      await waitFor(() => run(`document.querySelector('.${kind}.limit-67') !== null`), `67 ${kind}`);
      assert.equal(await run('document.querySelectorAll(".quota-card.limit-67").length'), 1);
      await waitFor(() => run(`typeof document.getElementById('${kind}-value').getAnimations()[0]?.startTime === 'number'`), 'animation started');
      const animation = await run(`document.getElementById('${kind}-value').getAnimations()[0]?.startTime`);
      await pause(300); publish(); await pause();
      assert.equal(await run(`document.getElementById('${kind}-value').getAnimations()[0]?.startTime`), animation, 'Polling must not restart the celebration');
      fs.writeFileSync(path.join(root, `67-${kind}.png`), (await panel.webContents.capturePage()).toPNG());
      if (widget) {
        assert.equal(await widget.webContents.executeJavaScript(`document.getElementById('${kind}-bar').closest('.quota').classList.contains('limit-67')`), true);
        fs.writeFileSync(path.join(root, `67-widget-${kind}.png`), (await widget.webContents.capturePage()).toPNG());
      }
    }
    base.reducedMotion = true; publish(); await pause();
    assert.equal(await run('getComputedStyle(document.getElementById("weekly-value")).animationName'), 'none');
    if (widget) assert.equal(await widget.webContents.executeJavaScript('getComputedStyle(document.querySelector(".quota.limit-67 .percentage")).animationName'), 'none');
    base.reducedMotion = false;
    quota.short.remaining = null; quota.weekly.remaining = 68; publish(); await pause();
    assert.equal(await run('document.querySelectorAll(".limit-67").length'), 0);
    if (widget) assert.equal(await widget.webContents.executeJavaScript('document.querySelectorAll(".limit-67").length'), 0);
    // Also cover a 67 in an unselected account and a narrow Settings viewport.
    const extra = accounts.add();
    accounts.monitors.get(extra).state.buckets[0].weekly.remaining = 67; publish();
    await run('window.limitsSettings.open()');
    await waitFor(() => run('document.querySelectorAll(".profile-quota.limit-67").length === 1'), 'unselected quota');
    panel.setMinimumSize(1, 1); panel.setMaximumSize(0, 0); panel.setSize(360, 650);
    await run('document.querySelector(".accounts-section").scrollIntoView({block:"end",behavior:"instant"})'); await pause(150);
    assert.equal(await run('(() => { const el = document.querySelector(".settings-content"); return el.scrollWidth <= el.clientWidth + 1; })()'), true);
    fs.writeFileSync(path.join(root, 'accounts-narrow.png'), (await panel.webContents.capturePage()).toPNG());
    const report = { platform: process.platform, trashInHeading: true, localized: true, keyboardDisconnect: true, pendingAndErrors: true, selectedRemovalPersisted: true, sixtySeven: ['short', 'weekly', 'unselected account', ...(widget ? ['Windows widget'] : [])], pollingStable: true, reducedMotion: true, narrowLayout: true, artifacts: root };
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log('ACCOUNTS_SMOKE_OK', JSON.stringify(report));
    accounts.stop(); widget?.destroy(); app.quit();
  } catch (error) { accounts?.stop(); console.error('ACCOUNTS_SMOKE_FAILED', error.stack); app.exit(1); }
});
