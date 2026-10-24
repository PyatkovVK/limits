'use strict';
// Isolated demo only: never reads credentials or opens a browser.
const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const pkg = require('../../../package.json');
const artifacts = path.resolve(__dirname, '../../../artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'mac-subscriptions-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? path.join(root, 'profile') : value);
app.getVersion = () => pkg.version;
app.disableHardwareAcceleration();
shell.openExternal = async () => assert.fail('No browser in smoke checks');
global.fetch = async () => assert.fail('No network in smoke checks');
process.argv.push('--demo', '--hidden', '--smoke-tray-only');
require('../../common/main.cjs');
const delay = () => new Promise(resolve => setTimeout(resolve, 100));
app.whenReady().then(async () => {
  try {
    let panel;
    for (let attempt = 0; attempt < 100; attempt++) {
      panel = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
      if (panel && !panel.webContents.isLoading() && await panel.webContents.executeJavaScript('Boolean(document.getElementById("apple-subscription-mode"))')) break;
      await delay();
    }
    assert.ok(panel);
    const run = code => panel.webContents.executeJavaScript(code);
    await run('window.limits.open()'); await run('window.limitsSettings.open()');
    const checks = [];
    for (const language of ['ru', 'en']) {
      await run(`window.limits.language('${language}')`);
      for (const [mode, count] of [['all', 2], ['connected', 1], ['active', 1]]) {
        await run(`window.limits.subscriptionMode('${mode}')`); await delay();
        const result = await run(`({ visible: document.querySelectorAll('.profile-card:not([hidden])').length,
          selected: document.getElementById('apple-subscription-mode').value,
          externalEditable: [...document.querySelectorAll('.profile-card')].some(card => card.dataset.profileId === 'default' && !card.querySelector('.profile-edit').hidden),
          quotasVisible: [...document.querySelectorAll('.profile-card:not([hidden]) .profile-quotas')].every(node => !node.hidden),
          overflow: document.body.scrollWidth > innerWidth })`);
        assert.equal(result.visible, count); assert.equal(result.selected, mode);
        assert.equal(result.externalEditable, false); assert.equal(result.overflow, false); assert.equal(result.quotasVisible, true);
        checks.push({ language, mode, ...result });
      }
      await run('window.limits.subscriptionMode("all")');
      await run('document.querySelector(".accounts-section").scrollIntoView({block:"center"})'); await delay();
      fs.writeFileSync(path.join(root, `subscriptions-${language}.png`), (await panel.webContents.capturePage()).toPNG());
    }
    console.log('MAC_SUBSCRIPTIONS_SMOKE_OK', JSON.stringify({ checks, artifacts: root })); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
