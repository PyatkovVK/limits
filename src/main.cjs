'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen, nativeImage, powerMonitor, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { findCodex } = require('./codex-path.cjs');
const { CodexClient } = require('./codex-client.cjs');
const { Monitor } = require('./monitor.cjs');
const { selectedBucket, isStale } = require('./limits.cjs');
const { TaskbarProbe, widgetBounds } = require('./taskbar.cjs');

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

let window, widget, probe, taskbarMetrics, monitor, trays = [], quitting = false, tick, saveTimer;
let widgetSettings = { visible: true, width: 520, xRatio: null };
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

function publicState() { return { ...state, stale: isStale(state), widgetError: taskbarMetrics?.available === false ? 'Не удалось найти панель задач Windows. Перезапустите приложение.' : null }; }
function saveWidgetSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const target = path.join(app.getPath('userData'), 'widget-settings.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(widgetSettings));
  }, 200);
}
function placeWidget() {
  if (!widget || widget.isDestroyed()) return;
  const bounds = widgetSettings.visible ? widgetBounds(taskbarMetrics, widgetSettings) : null;
  if (!bounds) { widget.hide(); return; }
  const current = widget.getBounds();
  if (Object.keys(bounds).some(key => current[key] !== bounds[key])) widget.setBounds(bounds);
  if (!widget.isVisible()) widget.showInactive();
}
function resetWidget() { widgetSettings.xRatio = null; widgetSettings.visible = true; saveWidgetSettings(); placeWidget(); }

function update() {
  if (!window || window.isDestroyed()) return;
  const bucket = selectedBucket(state);
  const stale = isStale(state);
  trays.forEach(tray => {
    tray.setToolTip('Codex Limits · панель задач');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть панель', click: showPanel },
      { label: 'Показывать блок на панели задач', type: 'checkbox', checked: widgetSettings.visible, click: item => { widgetSettings.visible = item.checked; saveWidgetSettings(); placeWidget(); } },
      { label: 'Вернуть блок к системному трею', click: resetWidget },
      { label: 'Обновить', enabled: !demo && !state.refreshing, click: () => void monitor?.refresh() },
      { type: 'separator' },
      { label: 'Запускать при входе в Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE && !smoke, click: item => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }) },
      { label: 'Выйти из приложения', click: () => app.quit() }
    ]));
  });
  for (const kind of ['short', 'weekly']) {
    const value = bucket?.[kind]?.remaining ?? null;
    const label = kind === 'short' ? '5 часов' : 'Неделя';
    if (!demo && !smoke && !stale && value !== null && value <= 10) {
      const key = `${bucket.id}:${kind}:${bucket[kind].resetsAt}`;
      if (!notified.has(key)) {
        notified.add(key);
        if (notified.size > 100) notified = new Set([key]);
        if (Notification.isSupported()) new Notification({ title: 'Codex: лимит заканчивается', body: `${label}: осталось ${value}%.` }).show();
      }
    }
  }
  for (const target of [window, widget]) if (target && !target.isDestroyed()) target.webContents.send('limits:state', publicState());
}

function trusted(event) { return [window, widget].some(target => target && event.sender === target.webContents && event.senderFrame === target.webContents.mainFrame); }
function handle(channel, fn) { ipcMain.handle(channel, (event, ...args) => { if (!trusted(event)) throw new Error('Unauthorized'); return fn(...args); }); }

async function setup() {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'widget-settings.json'), 'utf8'));
    widgetSettings = { visible: saved.visible !== false, width: [420, 520, 640].includes(saved.width) ? saved.width : 520, xRatio: Number.isFinite(saved.xRatio) ? saved.xRatio : null };
  } catch { /* Defaults on first launch. */ }
  const webPreferences = { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true };
  window = new BrowserWindow({ width: 560, height: Math.min(365, screen.getPrimaryDisplay().workArea.height - 16), resizable: false, frame: false, show: false, skipTaskbar: true, backgroundColor: '#000000', autoHideMenuBar: true, webPreferences });
  widget = new BrowserWindow({ width: 520, height: 46, resizable: false, frame: false, show: false, skipTaskbar: true, focusable: false, alwaysOnTop: true, transparent: true, hasShadow: false, webPreferences });
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
    { label: 'Открыть подробности', click: showPanel },
    { label: 'Обновить лимиты', enabled: !demo, click: () => void monitor?.refresh() },
    { label: 'Вернуть блок к системному трею', click: resetWidget },
    { label: 'Ширина блока', submenu: [420, 520, 640].map(width => ({ label: `${width} px`, type: 'radio', checked: width === widgetSettings.width, click: () => { widgetSettings.width = width; saveWidgetSettings(); placeWidget(); } })) },
    { type: 'separator' },
    { label: 'Выйти из приложения', click: () => app.quit() }
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
  handle('limits:hide', () => window.hide());
  handle('limits:quit', () => app.quit());
  handle('limits:login', async () => {
    if (!monitor) return { error: 'Codex CLI недоступен. Перезапустите приложение после установки.' };
    try {
      const authUrl = await monitor.login();
      const url = new URL(authUrl);
      if (url.protocol !== 'https:' || !['auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com'].includes(url.hostname)) throw new Error('Unexpected login URL');
      await shell.openExternal(url.href);
      return {};
    } catch { return { error: 'Не удалось открыть вход. Проверьте Codex и попробуйте ещё раз.' }; }
  });
  await Promise.all([window.loadFile(path.join(__dirname, 'renderer', 'index.html')), widget.loadFile(path.join(__dirname, 'renderer', 'widget.html'))]);
  const helperPath = app.isPackaged ? path.join(process.resourcesPath, 'taskbar-helper.exe') : path.join(__dirname, '..', 'build', 'taskbar-helper.exe');
  probe = new TaskbarProbe(helperPath);
  probe.on('metrics', metrics => {
    taskbarMetrics = metrics.available ? { ...metrics, bar: screen.screenToDipRect(null, metrics.bar), tray: metrics.tray ? screen.screenToDipRect(null, metrics.tray) : null } : metrics;
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
    } catch (error) { state = { ...state, status: 'error', error: error.message }; }
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
      await new Promise(resolve => setTimeout(resolve, 750));
      fs.writeFileSync(path.join(dir, `${name}.png`), (await window.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(dir, `${name}-taskbar.png`), (await widget.webContents.capturePage()).toPNG());
      console.log('SMOKE_OK', JSON.stringify({ ...report, widget: widgetReport, bounds: widget.getBounds(), taskbar: taskbarMetrics.bar }));
      app.quit();
    } catch (error) { console.error('SMOKE_FAILED', error.message); app.exit(1); }
  }
}

if (singleInstance) {
  app.on('second-instance', showPanel);
  app.whenReady().then(setup).catch(error => { console.error(error.message); app.exit(1); });
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; clearInterval(tick); clearTimeout(saveTimer); probe?.stop(); monitor?.stop(); widget?.destroy(); trays.forEach(tray => tray.destroy()); trays = []; });
