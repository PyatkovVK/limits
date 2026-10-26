'use strict';
const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const artifacts = path.resolve(__dirname, '../../../artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'subscriptions-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? root : value);
app.getVersion = () => require('../../../package.json').version;
app.disableHardwareAcceleration();
global.fetch = async () => assert.fail('No network in demo smoke');
shell.openExternal = async () => assert.fail('No browser in demo smoke');
process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../../common/main.cjs');
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
app.whenReady().then(async () => {
  try {
    let panel;
    for (let attempt = 0; attempt < 100; attempt++) {
      panel = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/index.html'));
      if (panel && !panel.webContents.isLoading() && await panel.webContents.executeJavaScript('Boolean(document.getElementById("subscription-mode"))')) break;
      await pause();
    }
    assert.ok(panel);
    const run = source => panel.webContents.executeJavaScript(source);
    await run('window.limits.open(); window.limitsSettings.open()');
    for (const language of ['ru', 'en']) {
      await run(`window.limits.language('${language}')`); await pause();
      for (const mode of ['all', 'connected', 'active']) {
        await run(`(async () => { const select = document.getElementById('subscription-mode'); select.value = '${mode}'; await select.onchange(); })()`);
        const view = await run(`({ count: [...document.querySelectorAll('.profile-card')].filter(c => !c.hidden).length, readonly: document.querySelector('[data-profile-id="default"] .profile-edit').hidden, mode: document.getElementById('subscription-mode').value, sourceDisabled: document.getElementById('subscription-add-source').disabled })`);
        assert.equal(view.count, mode === 'all' ? 2 : 1); assert.equal(view.mode, mode);
        assert.equal(view.readonly, true); assert.equal(view.sourceDisabled, true);
      }
      await run(`window.limits.subscriptionMode('all')`); await pause();
      await run('document.querySelector(".accounts-section").scrollIntoView({block:"center"})');
      await pause(); await pause();
      fs.writeFileSync(path.join(artifacts, `windows-subscriptions-${language}.png`), (await panel.webContents.capturePage()).toPNG());
    }
    console.log('SUBSCRIPTIONS_SMOKE_OK: RU/EN, all/connected/active, read-only external accounts'); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
