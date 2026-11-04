'use strict';
// Use the real IPC and renderers with an isolated profile and deterministic API responses.
const { app, BrowserWindow, shell, Notification, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registry } = require('../src/common/ai-connects/registry.cjs');
const { CodexController } = require('../src/common/ai-connects/codex/controller.cjs');
const { Subscriptions } = require('../src/common/subscriptions.cjs');
const { BALANCE_URL, KEY_URL } = require('../src/common/ai-connects/deepseek/client.cjs');
const artifacts = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'deepseek-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? path.join(root, 'profile') : value);
app.disableHardwareAcceleration();
const key = 'sk-deepseek-smoke-fixture', opened = [];
let apiCalls = 0, offline = false, empty = false, release;
const sample = () => ({ is_available: !empty, balance_infos: [{ currency: 'USD', total_balance: empty ? '0' : '12.3456', granted_balance: '0', topped_up_balance: empty ? '0' : '12.3456' }] });
global.fetch = async (url, options) => {
  assert.equal(url, BALANCE_URL, 'only balance requests are allowed'); apiCalls++;
  if (release) await new Promise(resolve => { release.resolve = resolve; });
  if (offline) throw new Error('offline fixture');
  return options.headers.Authorization === `Bearer ${key}` ? Response.json(sample()) : new Response('{}', { status: 401 });
};
shell.openExternal = async url => { assert.equal(url, KEY_URL); opened.push(url); };
Notification.prototype.show = () => assert.fail('Smoke must not show notifications');
registry.providers.get('codex').create = options => {
  const client = new EventEmitter(); client.start = async () => {}; client.stop = () => {};
  client.request = async method => method === 'account/read' ? { account: { type: 'chatgpt', email: 'demo@example.com', planType: 'plus' } }
    : { rateLimits: { primary: { usedPercent: 28, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 } } };
  return new CodexController(client, options);
};
process.argv.push('--hidden', '--smoke-tray-only');
require('../src/common/main.cjs');
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function waitFor(condition, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { if (await condition()) return; await pause(); }
  throw new Error(`Timed out: ${label}`);
}
app.whenReady().then(async () => {
  let restored;
  try {
    let panel;
    await waitFor(async () => {
      panel = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/index.html'));
      return panel && !panel.webContents.isLoading() && panel.webContents.executeJavaScript('window.limits?.get().then(next => next.status === "ready")');
    }, 'ready');
    const run = source => panel.webContents.executeJavaScript(source);
    await run('window.renderReady');
    const get = () => run('window.limits.get()');
    const screenshot = async name => { panel.showInactive(); await pause(); fs.writeFileSync(path.join(root, name), (await panel.webContents.capturePage()).toPNG()); };
    await run('window.limitsSettings.open()');
    assert.deepEqual(await run('[...document.getElementById("account-provider").options].map(option => option.textContent)'), ['ChatGPT (Codex)', 'DeepSeek']);
    assert.equal(await run('document.getElementById("account-provider").hidden'), false);
    assert.equal(await run('document.getElementById("account-provider").parentElement.className'), 'subscription-controls');
    await run('document.getElementById("account-provider").value = "deepseek"');
    await screenshot('subscriptions.png');
    const begin = async () => {
      await run('document.getElementById("add-account").click()');
      await waitFor(() => run('document.getElementById("key-connection-dialog").open'), 'key dialog');
    };
    const submit = async value => {
      await run(`document.getElementById('key-connection-input').value = ${JSON.stringify(value)}; document.getElementById('key-connection-input').dispatchEvent(new Event('input')); document.getElementById('key-connection-submit').click()`);
    };
    await begin(); assert.equal(opened.length, 1); assert.equal((await get()).profiles.length, 1);
    assert.equal(await run('document.getElementById("key-connection-input").type'), 'password');
    await screenshot('connect-ru.png');
    await run('document.getElementById("key-connection-cancel").click()');
    await waitFor(() => run('!document.getElementById("key-connection-dialog").open'), 'cancel');
    assert.equal((await get()).profiles.length, 1);
    await begin(); await submit('bad');
    await waitFor(() => run('!document.querySelector("#key-connection-dialog .notice").hidden'), 'invalid key');
    assert.equal((await get()).profiles.length, 1);
    await screenshot('invalid-key-ru.png');
    for (const language of ['en', 'ru']) {
      await run(`window.limits.language('${language}')`);
      await waitFor(() => run(`document.getElementById('key-connection-title').textContent.startsWith('${language === 'en' ? 'Connect' : 'Подключить'}')`), 'dialog localization');
    }
    const before = apiCalls; await submit(key);
    await waitFor(async () => (await get()).profiles.length === 2, 'connect');
    assert.equal(apiCalls - before, 1, 'key validation must not trigger a duplicate balance read');
    const id = (await get()).profiles.find(profile => profile.providerId === 'deepseek').id;
    const keyFile = path.join(root, 'profile', 'accounts', id, 'deepseek-key.bin');
    assert.equal(safeStorage.decryptString(fs.readFileSync(keyFile)), key);
    assert.equal(fs.readFileSync(keyFile).includes(Buffer.from(key)), false);
    assert.ok(!JSON.stringify(await get()).includes(key));
    assert.equal(await run('document.getElementById("key-connection-input").value'), '');
    await run(`window.limits.accountAction('select', '${id}')`);
    await run('window.limitsSettings.dialog.close()');
    await waitFor(() => run('document.querySelector("#provider-metrics .metric-value")?.textContent.includes("USD")'), 'balance');
    assert.equal(await run('document.querySelectorAll("#provider-metrics .metric-card").length'), 3);
    assert.equal(await run('[...document.querySelectorAll("#provider-metrics progress, #provider-metrics time")].every(node => node.hidden)'), true);
    await screenshot('balance-ru.png');
    await run("window.limits.language('en')"); await screenshot('balance-en.png');
    offline = true; await run('window.limits.refresh()');
    assert.equal((await get()).groups[0].metrics[0].value, 12.3456); assert.equal((await get()).error, 'balanceRefreshFailed');
    offline = false; empty = true; await run('window.limits.refresh()');
    assert.equal((await get()).groups[0].metrics[0].value, 0); assert.equal((await get()).accountAvailable, false);
    assert.equal((await get()).stale, false); empty = false;
    restored = new Subscriptions({ root: path.join(root, 'profile'), controllerContext: () => ({ safeStorage }) });
    await restored.refresh(); assert.equal(restored.snapshot().providerId, 'deepseek'); assert.equal(restored.snapshot().groups[0].metrics[0].value, 12.3456);
    restored.stop(); restored = null;
    await run('window.limits.login()');
    await waitFor(() => run('document.getElementById("key-connection-dialog").open'), 'replacement');
    await submit('bad');
    await waitFor(() => run('!document.querySelector("#key-connection-dialog .notice").hidden'), 'replacement error');
    assert.equal(safeStorage.decryptString(fs.readFileSync(keyFile)), key);
    await run('document.getElementById("key-connection-cancel").click()');
    await waitFor(() => run('!document.getElementById("key-connection-dialog").open'), 'replacement cancel');
    await run('window.limitsSettings.open()'); await begin(); release = {};
    await submit(key); await waitFor(() => Boolean(release.resolve), 'delayed check');
    await run('document.getElementById("key-connection-cancel").click()');
    await waitFor(() => run('!document.getElementById("key-connection-dialog").open'), 'cancel delayed check');
    const finish = release.resolve; release = null; finish(); await pause();
    assert.equal((await get()).profiles.length, 2);
    await run(`window.limits.accountAction('remove', '${id}')`);
    assert.equal(fs.existsSync(keyFile), false); assert.equal((await get()).profiles.length, 1);
    assert.equal((await get()).providerId, 'codex');
    const report = { platform: process.platform, realIpc: true, browserLink: true, invalidKeyAndRetry: true, cancellation: true,
      encryptedOsStorage: true, restartPersistence: true, replacement: true, localRemoval: true, monetaryDisplay: true, staleAndZero: true,
      codexPreserved: true, artifacts: root };
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log('DEEPSEEK_SMOKE_OK', JSON.stringify(report)); app.quit();
  } catch (error) { restored?.stop(); console.error('DEEPSEEK_SMOKE_FAILED', error.stack); app.exit(1); }
});
