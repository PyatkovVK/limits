'use strict';
// The Node runner provides an empty profile and cleans it up after Electron exits.
const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { findCodex } = require('../../common/ai-connects/codex/path.cjs');
const { AUTH_ENV_VARIABLES } = require('../../common/ai-connects/codex/options.cjs');
if (process.platform !== 'win32') throw new Error('Run the Windows onboarding check on Windows.');

const profileArg = process.argv.find(arg => arg.startsWith('--onboarding-profile='));
const root = profileArg?.slice('--onboarding-profile='.length);
if (!root || !path.isAbsolute(root)) {
  console.error('Run the onboarding check with npm run smoke:onboarding.');
  app.exit(1);
  return;
}
const opened = [];
function fail(error) {
  console.error('ONBOARDING_SMOKE_FAILED:', error);
  app.exit(1);
}

try {
  process.env.CODEX_HOME = path.join(root, 'codex-home');
  fs.mkdirSync(process.env.CODEX_HOME);
  for (const key of Object.keys(process.env)) {
    if ([...AUTH_ENV_VARIABLES, 'CODEX_LIMITS_CODEX_PATH'].includes(key.toUpperCase())) delete process.env[key];
  }
  process.env.PATH = '';
  const resourcesPath = process.argv.find(arg => arg.startsWith('--resources='))?.slice('--resources='.length);
  if (resourcesPath) process.env.CODEX_LIMITS_CODEX_PATH = findCodex({ resourcesPath, env: { PATH: '' }, resolvePackage() { throw new Error('No npm packages'); } });

  const setPath = app.setPath.bind(app);
  app.setPath = (name, value) => setPath(name, name === 'userData' ? root : value);
  app.disableHardwareAcceleration();
  shell.openExternal = async url => {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:');
    opened.push(parsed.hostname);
  };
  process.argv.push('--hidden', '--smoke-tray-only');
  require('../../main.cjs');
} catch (error) {
  fail(error);
  return;
}

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
    assert.equal(panel.isVisible(), true, 'Hidden launch must show the connection prompt');
    await panel.webContents.executeJavaScript('window.limitsViewPanelReady');
    const run = code => panel.webContents.executeJavaScript(code);
    await run('window.limits.get().then(render)');
    assert.equal(await run('document.querySelector("#provider-picker").hidden'), false);
    assert.doesNotMatch(await run('document.querySelector("#account").textContent'), /ChatGPT/);
    assert.equal(opened.length, 0, 'The connection prompt must wait for the user to choose a provider');
    assert.deepEqual(await run('Array.from(document.querySelectorAll("#provider-picker-select option:not([disabled])"), option => option.textContent)'),
      state.providers.map(provider => provider.name));
    await panel.webContents.executeJavaScript('document.querySelector("#provider-picker-select").showPicker()', true);
    await pause();
    assert.equal(await run('document.querySelector("#provider-picker-select").matches(":open")'), true, 'The provider dropdown opens');
    panel.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    panel.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await pause();
    assert.equal(await run('document.querySelector("#provider-picker-select").matches(":open")'), false);
    assert.equal(opened.length, 0);
    const choose = id => run(`{
      const select = document.querySelector('#provider-picker-select');
      select.value = ${JSON.stringify(id)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }`);
    await choose('codex');
    for (let i = 0; !opened.length && i < 100; i++) await pause();
    assert.ok(['auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com'].includes(opened[0]), 'Browser sign-in must be available without installed Codex');
    const pending = await run('window.limits.get()');
    assert.equal(pending.profiles.find(profile => profile.id === pending.loginProfileId)?.status, 'signing-in');
    assert.deepEqual(await run(`window.limits.accountAction('cancel', ${JSON.stringify(pending.loginProfileId)})`), {});
    for (const [id, hostname] of [['deepseek', 'platform.deepseek.com'], ['zai', 'z.ai']]) {
      await choose(id);
      let connection;
      for (let i = 0; i < 100; i++) {
        connection = (await run('window.limits.get()')).keyConnection;
        if (connection?.providerId === id && opened.at(-1) === hostname) break;
        await pause();
      }
      assert.equal(connection?.providerId, id);
      assert.equal(opened.at(-1), hostname);
      assert.deepEqual(await run(`window.limits.cancelApiKey(${JSON.stringify(connection.id)})`), {});
    }
    panel.hide();
    await panel.webContents.executeJavaScript('window.limits.refresh()');
    assert.equal(panel.isVisible(), false, 'Polling must preserve dismissal of the sign-in panel');
    console.log('ONBOARDING_SMOKE_OK: hidden launch, provider selection, browser sign-in, cancellation, dismissed panel');
    app.quit();
  } catch (error) {
    fail(error);
  }
});
