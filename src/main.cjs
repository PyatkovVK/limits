'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen, nativeImage, powerMonitor, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { findCodex } = require('./codex-path.cjs');
const { CodexClient } = require('./codex-client.cjs');
const { Monitor } = require('./monitor.cjs');
const { selectedBucket, isStale } = require('./limits.cjs');
const { TaskbarProbe, widgetBounds } = require('./taskbar.cjs');
const { t: translate } = require('./renderer/i18n.js');

const demo = process.argv.includes('--demo');
const smoke = process.argv.includes('--smoke-test');
const artifactRoot = path.join(app.isPackaged ? process.cwd() : path.join(__dirname, '..'), 'artifacts');
if (smoke) app.disableHardwareAcceleration();
if (smoke) app.setPath('userData', path.join(artifactRoot, 'smoke-profile'));
else if (demo) app.setPath('userData', path.join(app.getPath('appData'), 'Codex Limits Demo'));
app.setName('Codex Limits');
app.setAppUserModelId('dev.codexlimits.desktop');
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let window, widget, probe, taskbarMetrics, taskbarUnavailable = false, monitor, trays = [], quitting = false, tick, saveTimer;
let widgetSettings = { visible: true, width: 320, xRatio: null, language: 'ru' };
const t = key => translate(widgetSettings.language, key);
let state = { account: null, buckets: [], status: 'connecting', error: null, updatedAt: null, selectedId: 'codex', refreshing: false, interval: 30, demo };
let notified = new Set();

function showPanel() {
  if (!window || window.isDestroyed()) return;
  const bounds = widget?.isVisible() ? widget.getBounds() : trays[0]?.getBounds();
  const display = bounds?.width ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const [width, height] = window.getSize();
  const x = Math.max(area.x, Math.min(area.x + area.width - width, bounds?.width ? bounds.x + bounds.width / 2 - width / 2 : area.x + area.width - width - 16));
  const y = Math.max(area.y, Math.min(area.y + area.height - height, bounds?.width && bounds.y < area.y + area.height / 2 ? area.y + 8 : area.y + area.height - height - 8));
  window.setPosition(Math.round(x), Math.round(y));
  window.show(); window.focus();
}

function publicState() { return { ...state, language: widgetSettings.language, stale: isStale(state), widgetError: taskbarUnavailable ? 'taskbarMissing' : null }; }
function persistWidgetSettings() {
  const target = path.join(app.getPath('userData'), 'widget-settings.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(widgetSettings));
}
function saveWidgetSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistWidgetSettings, 200);
}
function placeWidget() {
  if (!widget || widget.isDestroyed()) return;
  const bounds = widgetSettings.visible ? widgetBounds(taskbarMetrics, widgetSettings) : null;
  if (!bounds) { widget.hide(); return; }
  const current = widget.getBounds();
  if (Object.keys(bounds).some(key => current[key] !== bounds[key])) widget.setBounds(bounds);
  if (!widget.isVisible()) widget.showInactive();
  // Explorer can promote the taskbar in the topmost group. Restore our z-order without taking focus.
  widget.setAlwaysOnTop(true, 'screen-saver');
  widget.moveTop();
}
function resetWidget() { widgetSettings.xRatio = null; widgetSettings.visible = true; saveWidgetSettings(); placeWidget(); update(); }
function setLanguage(language) {
  if (!['ru', 'en'].includes(language)) return publicState();
  widgetSettings.language = language;
  saveWidgetSettings(); update();
  return publicState();
}
function languageMenu() {
  return { label: t('language'), submenu: ['ru', 'en'].map(language => ({ label: language === 'ru' ? 'Русский' : 'English', type: 'radio', checked: widgetSettings.language === language, click: () => setLanguage(language) })) };
}

function update() {
  if (quitting || !window || window.isDestroyed()) return;
  const bucket = selectedBucket(state);
  const stale = isStale(state);
  trays.forEach(tray => {
    tray.setToolTip(t('tooltip'));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: t('details'), click: showPanel },
      { label: t('showWidget'), type: 'checkbox', checked: widgetSettings.visible, click: item => { widgetSettings.visible = item.checked; saveWidgetSettings(); placeWidget(); } },
      { label: t('resetPosition'), click: resetWidget },
      { label: t('refresh'), enabled: !demo && !state.refreshing, click: () => void monitor?.refresh() },
      languageMenu(),
      { type: 'separator' },
      { label: t('startup'), type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE && !smoke, click: item => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }) },
      { label: t('quit'), click: () => app.quit() }
    ]));
  });
  for (const kind of ['short', 'weekly']) {
    const value = bucket?.[kind]?.remaining ?? null;
    const label = t(kind === 'short' ? 'shortCompact' : 'weeklyCompact');
    if (!demo && !smoke && !stale && value !== null && value <= 10) {
      const key = `${bucket.id}:${kind}:${bucket[kind].resetsAt}`;
      if (!notified.has(key)) {
        notified.add(key);
        if (notified.size > 100) notified = new Set([key]);
        if (Notification.isSupported()) new Notification({ title: t('lowTitle'), body: `${label}: ${value}%.` }).show();
      }
    }
  }
  for (const target of [window, widget]) if (target && !target.isDestroyed()) target.webContents.send('limits:state', publicState());
}

function trusted(event) { return [window, widget].some(target => target && event.sender === target.webContents && event.senderFrame === target.webContents.mainFrame); }
function handle(channel, fn) { ipcMain.handle(channel, (event, ...args) => { if (!trusted(event)) throw new Error('Unauthorized'); return fn(...args); }); }

async function setup() {
  widgetSettings.language = app.getLocale().startsWith('ru') ? 'ru' : 'en';
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'widget-settings.json'), 'utf8'));
    widgetSettings = { visible: saved.visible !== false, width: [280, 320, 400].includes(saved.width) ? saved.width : 320, xRatio: Number.isFinite(saved.xRatio) ? saved.xRatio : null, language: ['ru', 'en'].includes(saved.language) ? saved.language : widgetSettings.language };
  } catch { /* Defaults on first launch. */ }
  const webPreferences = { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true };
  window = new BrowserWindow({ width: 440, height: Math.min(300, screen.getPrimaryDisplay().workArea.height - 16), resizable: false, frame: false, show: false, skipTaskbar: true, backgroundColor: '#000000', autoHideMenuBar: true, webPreferences });
  widget = new BrowserWindow({ width: 320, height: 34, minHeight: 28, resizable: false, frame: false, thickFrame: false, show: false, skipTaskbar: true, focusable: false, alwaysOnTop: true, transparent: true, hasShadow: false, webPreferences });
  widget.setAlwaysOnTop(true, 'screen-saver');
  for (const target of [widget, window]) {
    target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    target.webContents.on('will-navigate', event => event.preventDefault());
    target.webContents.on('will-attach-webview', event => event.preventDefault());
  }
  widget.on('will-move', (event, bounds) => {
    if (!taskbarMetrics?.bar) return;
    event.preventDefault();
    widgetSettings.xRatio = (bounds.x - taskbarMetrics.bar.x) / taskbarMetrics.bar.width;
    saveWidgetSettings(); placeWidget();
  });
  widget.webContents.on('context-menu', () => Menu.buildFromTemplate([
    { label: t('details'), click: showPanel },
    { label: t('refresh'), enabled: !demo, click: () => void monitor?.refresh() },
    { label: t('resetPosition'), click: resetWidget },
    { label: t('width'), submenu: [280, 320, 400].map(width => ({ label: `${width} px`, type: 'radio', checked: width === widgetSettings.width, click: () => { widgetSettings.width = width; saveWidgetSettings(); placeWidget(); } })) },
    languageMenu(),
    { type: 'separator' },
    { label: t('quit'), click: () => app.quit() }
  ]).popup({ window: widget }));
  window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); } });
  {
    const tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'app.ico')).resize({ width: 16, height: 16 }));
    tray.on('click', () => window.isVisible() ? window.hide() : showPanel());
    trays.push(tray);
  }
  handle('limits:get', publicState);
  handle('limits:refresh', async () => { await monitor?.refresh(); return publicState(); });
  handle('limits:open', showPanel);
  handle('limits:select', id => { if (typeof id === 'string') monitor?.select(id); });
  handle('limits:language', setLanguage);
  handle('limits:hide', () => window.hide());
  handle('limits:quit', () => app.quit());
  handle('limits:login', async () => {
    if (!monitor) return { error: 'loginUnavailable' };
    try {
      const authUrl = await monitor.login();
      const url = new URL(authUrl);
      if (url.protocol !== 'https:' || !['auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com'].includes(url.hostname)) throw new Error('Unexpected login URL');
      await shell.openExternal(url.href);
      return {};
    } catch { return { error: 'loginFailed' }; }
  });
  await Promise.all([window.loadFile(path.join(__dirname, 'renderer', 'index.html')), widget.loadFile(path.join(__dirname, 'renderer', 'widget.html'))]);
  const helperPath = app.isPackaged ? path.join(process.resourcesPath, 'taskbar-helper.exe') : path.join(__dirname, '..', 'build', 'taskbar-helper.exe');
  probe = new TaskbarProbe(helperPath);
  probe.on('metrics', metrics => {
    taskbarUnavailable = !metrics.available;
    // Keep the last known placement through a transient helper/Explorer failure.
    if (metrics.available) taskbarMetrics = { ...metrics, bar: screen.screenToDipRect(null, metrics.bar), tray: metrics.tray ? screen.screenToDipRect(null, metrics.tray) : null };
    placeWidget();
    update();
  });
  await probe.start();
  if (demo) {
    const now = Math.floor(Date.now() / 1000);
    state = { ...state, demo: true, status: 'ready', account: { type: 'chatgpt', email: 'demo@example.com', planType: 'plus' }, updatedAt: Date.now(), buckets: [{ id: 'codex', name: 'Codex', short: { remaining: 72, used: 28, resetsAt: now + 8340 }, weekly: { remaining: 46, used: 54, resetsAt: now + 345600 }, other: [] }] };
  } else {
    try {
      monitor = new Monitor(new CodexClient(findCodex({ resourcesPath: app.isPackaged ? process.resourcesPath : null })));
      if (smoke) monitor.on('diagnostic', info => console.log('SMOKE_RPC', JSON.stringify(info)));
      monitor.on('state', next => { state = { ...next, demo: false }; update(); });
      void monitor.refresh();
    } catch { state = { ...state, status: 'error', error: 'codexMissing' }; }
  }
  update();
  tick = setInterval(update, 15000);
  powerMonitor.on('resume', () => void monitor?.refresh());
  if (smoke || !taskbarMetrics?.available) showPanel();
  if (smoke) {
    try {
      if (monitor) {
        await monitor.refresh();
        while (monitor.inflight) await monitor.inflight;
      }
      await window.webContents.executeJavaScript('window.renderReady');
      await window.webContents.executeJavaScript('window.limits.get().then(render)');
      await widget.webContents.executeJavaScript('window.renderReady');
      await widget.webContents.executeJavaScript('window.limits.get().then(render)');
      const report = await window.webContents.executeJavaScript(`({ title: document.title, values: [...document.querySelectorAll('.remaining-value')].map(el => el.textContent), errorHidden: document.querySelector('#error').hidden, cards: document.querySelectorAll('.quota-card').length, isolated: typeof require === 'undefined' })`);
      if ((demo ? report.values.join(',') !== '72,46' : state.status !== 'ready') || !report.errorHidden || report.cards !== 2 || !report.isolated) throw new Error(JSON.stringify({ ...report, status: state.status, auth: state.account?.type || null }));
      const widgetReport = await widget.webContents.executeJavaScript(`({ values: ['short-value', 'weekly-value'].map(id => document.getElementById(id).textContent), accountVisible: !!document.getElementById('widget-account').textContent, bars: document.querySelectorAll('progress').length, isolated: typeof require === 'undefined', overflow: document.body.scrollWidth > innerWidth })`);
      if (!taskbarMetrics?.available || widgetReport.bars !== 2 || !widgetReport.accountVisible || !widgetReport.isolated || widgetReport.overflow || widgetReport.values.join(',') !== report.values.join(',')) throw new Error(JSON.stringify({ widgetReport, geometryAvailable: taskbarMetrics?.available }));
      const dir = artifactRoot;
      const name = demo ? 'panel' : 'panel-live';
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${name}-smoke.json`), JSON.stringify(report, null, 2));
      const originalLanguage = widgetSettings.language;
      const languages = [];
      for (const language of ['ru', 'en']) {
        await window.webContents.executeJavaScript(`window.limits.language('${language}').then(render)`);
        await widget.webContents.executeJavaScript('window.limits.get().then(render)');
        const labels = await window.webContents.executeJavaScript(`({ language: document.documentElement.lang, short: document.querySelector('.short .period').textContent, refresh: document.getElementById('refresh').textContent, clean: !/До сброса|Осталось|каждые 30|Resets in|Remaining|every 30/.test(document.body.textContent) })`);
        if (labels.language !== language || labels.short !== translate(language, 'short') || labels.refresh !== translate(language, 'refresh') || !labels.clean) throw new Error(JSON.stringify(labels));
        for (const width of [280, 320, 400]) {
          widgetSettings.width = width; placeWidget();
          await new Promise(resolve => setTimeout(resolve, 100));
          const layout = await widget.webContents.executeJavaScript(`({ language: document.documentElement.lang, overflow: document.body.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight, barWidths: [...document.querySelectorAll('progress')].map(el => el.getBoundingClientRect().width) })`);
          if (layout.language !== language || layout.overflow || layout.barWidths.some(width => width < 20)) throw new Error(JSON.stringify(layout));
        }
        widgetSettings.width = 320; placeWidget();
        await new Promise(resolve => setTimeout(resolve, 200));
        fs.writeFileSync(path.join(dir, `${name}-${language}.png`), (await window.webContents.capturePage()).toPNG());
        fs.writeFileSync(path.join(dir, `${name}-taskbar-${language}.png`), (await widget.webContents.capturePage()).toPNG());
        languages.push(labels);
      }
      setLanguage(originalLanguage);
      // Check the actual native fullscreen detector against a normal maximized window.
      const { spawnSync } = require('node:child_process');
      const testWindow = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { sandbox: true } });
      testWindow.show(); testWindow.maximize();
      await new Promise(resolve => setTimeout(resolve, 400));
      const result = spawnSync(helperPath, ['0'], { input: 'query\n', encoding: 'utf8', windowsHide: true });
      testWindow.destroy();
      const maximized = JSON.parse(result.stdout.trim());
      if (!maximized.available || maximized.fullscreen) throw new Error('Native probe classified a maximized window as fullscreen.');
      showPanel();
      if (process.argv.includes('--smoke-stability')) {
        const until = Date.now() + 65000;
        while (Date.now() < until) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (widgetBounds(taskbarMetrics, widgetSettings) && !widget.isVisible()) throw new Error('Taskbar widget disappeared.');
        }
      }
      console.log('SMOKE_OK', JSON.stringify({ ...report, widget: widgetReport, languages, maximizedFullscreen: maximized.fullscreen, bounds: widget.getBounds(), taskbar: taskbarMetrics.bar }));
      app.quit();
    } catch (error) { console.error('SMOKE_FAILED', error.message); app.exit(1); }
  }
}

if (singleInstance) {
  app.on('second-instance', showPanel);
  app.whenReady().then(setup).catch(error => { console.error(error.message); app.exit(1); });
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; clearInterval(tick); clearTimeout(saveTimer); if (window) persistWidgetSettings(); probe?.stop(); monitor?.stop(); widget?.destroy(); trays.forEach(tray => tray.destroy()); trays = []; });
