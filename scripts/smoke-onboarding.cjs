'use strict';
// Run with Electron. Use an empty home and intercept the browser launch.
const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { findCodex } = require('../src/common/codex-path.cjs');
if (process.platform !== 'win32') throw new Error('Run the Windows onboarding check on Windows.');

const parent = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(parent, { recursive: true });
const root = fs.mkdtempSync(path.join(parent, 'onboarding-smoke-'));
process.env.CODEX_HOME = path.join(root, 'codex-home');
fs.mkdirSync(process.env.CODEX_HOME);
for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_LIMITS_CODEX_PATH']) delete process.env[key];
process.env.PATH = '';
const resourcesPath = process.argv.find(arg => arg.startsWith('--resources='))?.slice('--resources='.length);
if (resourcesPath) process.env.CODEX_LIMITS_CODEX_PATH = findCodex({ resourcesPath, env: { PATH: '' }, resolvePackage() { throw new Error('No npm packages'); } });

const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? root : value);
app.disableHardwareAcceleration();
let opened = false;
shell.openExternal = async url => {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:');
  assert.ok(['auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com'].includes(parsed.hostname));
  opened = true;
};
process.argv.push('--hidden', '--smoke-tray-only');
require('../src/common/main.cjs');

const pause = () => new Promise(resolve => setTimeout(resolve, 100));
app.whenReady().then(async () => {
  try {
    const deadline = Date.now() + 25000;
    let panel, state;
    while (Date.now() < deadline) {
      panel = BrowserWindow.getAllWindows()[0];
      if (panel && !panel.webContents.isLoading()) {
        state = await panel.webContents.executeJavaScript('window.limits?.get()');
        if (state?.status === 'signed-out' && !state.refreshing) break;
      }
      await pause();
    }
    assert.equal(state?.status, 'signed-out');
    assert.equal(state.error, null);
    assert.equal(state.account, null);
    assert.equal(panel.isVisible(), true, 'Hidden launch must show sign-in');
    await panel.webContents.executeJavaScript('window.limits.get().then(render)');
    assert.equal(await panel.webContents.executeJavaScript('document.getElementById("login").disabled'), false);
    assert.deepEqual(await panel.webContents.executeJavaScript('window.limits.login()'), {});
    assert.equal(opened, true, 'Browser sign-in must be available without installed Codex');
    assert.equal((await panel.webContents.executeJavaScript('window.limits.get()')).status, 'signing-in');
    assert.deepEqual(await panel.webContents.executeJavaScript('window.limits.accountAction("cancel", "default")'), {});
    panel.hide();
    await panel.webContents.executeJavaScript('window.limits.refresh()');
    assert.equal(panel.isVisible(), false, 'Polling must preserve dismissal of the sign-in panel');
    console.log('ONBOARDING_SMOKE_OK: signed-out, hidden launch, browser sign-in, cancellation, dismissed panel');
    app.quit();
  } catch (error) {
    console.error('ONBOARDING_SMOKE_FAILED:', error.message);
    app.exit(1);
  }
});
app.on('will-quit', () => {
  const resolved = path.resolve(root);
  if (!resolved.startsWith(parent + path.sep) || !path.basename(resolved).startsWith('onboarding-smoke-')) throw new Error('Unsafe smoke cleanup path');
  fs.rmSync(resolved, { recursive: true, force: true });
});
