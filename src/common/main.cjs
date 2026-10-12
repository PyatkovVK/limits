'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, screen, nativeImage, nativeTheme, powerMonitor, Notification, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { findCodex } = require('./codex-path.cjs');
const { CodexClient } = require('./codex-client.cjs');
const { Monitor } = require('./monitor.cjs');
const { Accounts } = require('./accounts.cjs');
const { AppearanceStore } = require('./appearance.cjs');
let appearance;
const { selectedBucket, isStale } = require('./limits.cjs');
const { widgetBounds } = require('../windows_feature/taskbar.cjs');
const { TaskbarWidget, taskbarHelperPath } = require('../windows_feature/widget.cjs');
const { TrayPresentation } = require('./tray.cjs');
const { t: translate } = require('./renderer/i18n.js');
const { startupState, changePreference } = require('./preferences.cjs');

const demo = process.argv.includes('--demo');
const smoke = process.argv.includes('--smoke-test');
const taskbarSupported = process.platform === 'win32' && !process.argv.includes('--smoke-tray-only');
const artifactRoot = path.join(app.isPackaged ? (process.env.PORTABLE_EXECUTABLE_DIR || process.cwd()) : path.join(__dirname, '../..'), 'artifacts');
if (smoke && !process.argv.includes('--smoke-gpu')) app.disableHardwareAcceleration();
if (smoke) app.setPath('userData', path.join(artifactRoot, 'smoke-profile'));
else if (demo) app.setPath('userData', path.join(app.getPath('appData'), 'Codex Limits Demo'));
// Keep the existing settings and Windows upgrade identity across the rename.
else app.setPath('userData', path.join(app.getPath('appData'), 'Codex Limits'));
app.setName('Limits');
app.setAppUserModelId('dev.codexlimits.desktop');
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let window, windowsPanel, macPanel, linuxPanel, appleNotch, widget, widgetHost, placement, probe, taskbarMetrics, taskbarUnavailable = false, monitor, trayPresentation, quitting = false, tick, saveTimer;
let widgetSettings = { visible: true, width: 280, xRatio: null, language: 'ru', layoutVersion: 1, displayMode: taskbarSupported ? 'widget' : 'tray', linuxTrayStyle: 'classic' };
const t = key => (process.platform === 'darwin' ? require('../apple_feature/i18n.js').t(widgetSettings.language, key) : null) || translate(widgetSettings.language, key, process.platform);
let state = { account: null, buckets: [], status: 'connecting', error: null, updatedAt: null, selectedId: 'codex', refreshing: false, interval: 30, demo };
let notified = new Set();

function showPanel(anchor) {
  if (!window || window.isDestroyed()) return;
  if (widgetSettings.displayMode === 'notch') return appleNotch?.expand();
  if (macPanel) return macPanel.show(anchor);
  if (linuxPanel) return linuxPanel.show();
  if (windowsPanel) return windowsPanel.show(anchor);
  const bounds = process.platform === 'linux' ? null : anchor?.getBounds?.() || (widget?.isVisible() ? widget.getBounds() : trayPresentation?.bounds());
  const display = bounds?.width ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const [width, height] = window.getSize();
  const x = Math.max(area.x, Math.min(area.x + area.width - width, bounds?.width ? bounds.x + bounds.width / 2 - width / 2 : area.x + area.width - width - 16));
  const y = Math.max(area.y, Math.min(area.y + area.height - height, bounds?.width && bounds.y < area.y + area.height / 2 ? area.y + 8 : area.y + area.height - height - 8));
  window.setPosition(Math.round(x), Math.round(y));
  window.show(); window.focus();
}

const displayModes = () => taskbarSupported ? ['widget', 'tray'] : process.platform === 'darwin' && appleNotch?.available ? ['tray', 'notch'] : ['tray'];
function publicState() { return { ...state, platform: process.platform, dark: nativeTheme.shouldUseDarkColors, reducedTransparency: nativeTheme.prefersReducedTransparency, reducedMotion: nativeTheme.prefersReducedMotion, language: widgetSettings.language, displayMode: widgetSettings.displayMode, displayModes: displayModes(), appleNotch: appleNotch?.snapshot() || null, stale: isStale(state), widgetError: taskbarUnavailable && widgetSettings.displayMode === 'widget' ? 'taskbarMissing' : null,
  preferences: { width: widgetSettings.width, visible: widgetSettings.visible, widgetSupported: taskbarSupported, linuxTrayStyle: widgetSettings.linuxTrayStyle,
    startup: startupState({ app, platform: process.platform, demo, smoke }) } }; }
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
  const before = widget && !widget.isDestroyed() ? widget.getBounds() : null;
  placement?.apply(taskbarMetrics, { ...widgetSettings, visible: widgetSettings.visible && widgetSettings.displayMode === 'widget' });
  if (!before || !windowsPanel || widgetSettings.displayMode !== 'widget' || !widget || widget.isDestroyed()) return;
  const after = widget.getBounds();
  if (['x', 'y', 'width', 'height'].some(key => before[key] !== after[key])) windowsPanel.follow(widget);
}
function resetWidget() { widgetSettings.xRatio = null; widgetSettings.visible = true; saveWidgetSettings(); placeWidget(); update(); }
function setLanguage(language) {
  if (!['ru', 'en'].includes(language)) return publicState();
  widgetSettings.language = language;
  saveWidgetSettings(); update();
  return publicState();
}
function setDisplayMode(mode) {
  if (!['widget', 'tray', 'notch'].includes(mode)) return publicState();
  if (mode === 'widget' && !taskbarSupported) mode = 'tray';
  if (!displayModes().includes(mode)) return publicState();
  const previous = widgetSettings.displayMode;
  widgetSettings.displayMode = mode;
  if (mode === 'widget') widgetSettings.visible = true;
  if (mode === 'notch') {
    window.hide();
    void appleNotch.enable().then(() => {
      if (!quitting && widgetSettings.displayMode === 'notch') appleNotch.expand();
    }).catch(error => { console.error('Apple notch:', error.message); if (!quitting) setDisplayMode('tray'); });
  } else appleNotch?.disable();
  saveWidgetSettings(); placeWidget(); update();
  if (previous === 'notch' && mode === 'tray') void showPanel();
  return publicState();
}
async function showSettings() {
  await showPanel();
  const target = widgetSettings.displayMode === 'notch' ? appleNotch?.window : window;
  if (target && !target.isDestroyed()) target.webContents.send('limits:open-settings');
}

function presentationMenu() {
  return [
      { label: t('details'), click: showPanel },
      { label: t('settings'), click: showSettings },
      { label: t('refresh'), enabled: !demo && !state.refreshing, click: () => void monitor?.refresh() },
      { type: 'separator' },
      { label: t('quit'), click: () => app.quit() }
    ];
}
function update() {
  if (quitting || !window || window.isDestroyed()) return;
  const bucket = selectedBucket(state);
  const stale = isStale(state);
  if (widgetSettings.displayMode === 'notch') trayPresentation?.destroy();
  else trayPresentation?.update({ mode: widgetSettings.displayMode, linuxTrayStyle: widgetSettings.linuxTrayStyle, bucket, stale, dark: nativeTheme.shouldUseDarkColors, account: state.account, displayName: state.displayName, language: widgetSettings.language, demo, menu: presentationMenu() });
  for (const kind of ['short', 'weekly']) {
    const value = bucket?.[kind]?.remaining ?? null;
    const label = t(kind === 'short' ? 'shortCompact' : 'weeklyCompact');
    if (!demo && !smoke && !stale && value !== null && value <= 10) {
      const key = `${state.selectedProfileId}:${bucket.id}:${kind}:${bucket[kind].resetsAt}`;
      if (!notified.has(key)) {
        notified.add(key);
        if (notified.size > 100) notified = new Set([key]);
        if (Notification.isSupported()) new Notification({ title: t('lowTitle'), body: `${label}: ${value}%.` }).show();
      }
    }
  }
  for (const target of [window, widget]) if (target && !target.isDestroyed()) target.webContents.send('limits:state', publicState());
  appleNotch?.update();
}

function trusted(event) { return [window, widget, appleNotch?.window].some(target => target && event.sender === target.webContents && event.senderFrame === target.webContents.mainFrame); }
function handle(channel, fn) { ipcMain.handle(channel, (event, ...args) => { if (!trusted(event)) throw new Error('Unauthorized'); return fn(...args); }); }

const webPreferences = { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true };
const helperPath = taskbarHelperPath(app.isPackaged ? process.resourcesPath : null);
function restrictWindow(target) {
  target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  target.webContents.on('will-navigate', event => event.preventDefault());
  target.webContents.on('will-attach-webview', event => event.preventDefault());
}
function nativeHandleId(target) {
  const handle = target.getNativeWindowHandle();
  return handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
}
async function createWidget() {
  widgetHost = new TaskbarWidget({ BrowserWindow, Menu, webPreferences, restrictWindow, getSettings: () => widgetSettings, resourcesPath: app.isPackaged ? process.resourcesPath : null, onMove: bounds => {
    if (!taskbarMetrics?.bar) return;
    widgetSettings.xRatio = (bounds.x - taskbarMetrics.bar.x) / taskbarMetrics.bar.width;
    saveWidgetSettings(); placeWidget();
  }, getMenu: () => [
    { label: t('details'), click: showPanel },
    { label: t('settings'), click: showSettings },
    { label: t('refresh'), enabled: !demo, click: () => void monitor?.refresh() },
    { type: 'separator' },
    { label: t('quit'), click: () => app.quit() }
  ] });
  widgetHost.on('window', (created, createdPlacement) => { widget = created; placement = createdPlacement; });
  widgetHost.on('probe', createdProbe => { probe = createdProbe; });
  widgetHost.on('failure', error => console.error(error.message));
  widgetHost.on('ready', update);
  widgetHost.on('metrics', metrics => {
    // Smoke windows must remain inspectable even if another foreground app is fullscreen.
    // The native detector is checked separately against our own test windows below.
    if (smoke) metrics = { ...metrics, fullscreen: false };
    const availabilityChanged = taskbarUnavailable !== !metrics.available;
    taskbarUnavailable = !metrics.available;
    if (metrics.available) taskbarMetrics = {
      ...metrics,
      bar: screen.screenToDipRect(null, metrics.bar),
      tray: metrics.tray ? screen.screenToDipRect(null, metrics.tray) : null,
      occupied: Array.isArray(metrics.occupied) ? metrics.occupied.map(rect => screen.screenToDipRect(null, rect)) : null,
    };
    placeWidget();
    if (availabilityChanged) update();
  });
  await widgetHost.start();
}

async function setup() {
  widgetSettings.language = app.getLocale().startsWith('ru') ? 'ru' : 'en';
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'widget-settings.json'), 'utf8'));
    const width = saved.layoutVersion !== 1 && saved.width === 320 ? 280 : saved.width;
    widgetSettings = { visible: saved.visible !== false, width: [240, 280, 320, 400].includes(width) ? width : 280, xRatio: Number.isFinite(saved.xRatio) ? saved.xRatio : null, language: ['ru', 'en'].includes(saved.language) ? saved.language : widgetSettings.language, layoutVersion: 1, displayMode: (process.platform === 'darwin' && saved.displayMode === 'notch') || displayModes().includes(saved.displayMode) ? saved.displayMode : displayModes()[0] };
    if (process.platform === 'linux') widgetSettings.linuxTrayStyle = require('../linux_feature/preferences.cjs').trayStyle(saved.linuxTrayStyle);
  } catch { /* Defaults on first launch. */ }
  if ((process.platform !== 'darwin' && !displayModes().includes(widgetSettings.displayMode)) || smoke) widgetSettings.displayMode = displayModes()[0];
  if (process.platform === 'darwin') app.dock.hide();
  appearance = new AppearanceStore(app.getPath('userData'));
  window = new BrowserWindow({ width: 440, height: Math.min(590, screen.getPrimaryDisplay().workArea.height - 16), resizable: false, frame: false, show: false, skipTaskbar: true, backgroundColor: '#000000', ...(process.platform === 'darwin' ? require('../apple_feature/panel.cjs').panelOptions() : {}), autoHideMenuBar: true, webPreferences });
  restrictWindow(window);
  if (process.platform === 'win32') windowsPanel = require('../windows_feature/panel.cjs').createPanelController({
    window, screen, getAnchorBounds: () => widget?.isVisible() ? widget.getBounds() : trayPresentation?.bounds(),
  });
  window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); } });
  trayPresentation = new TrayPresentation({ Tray, Menu, nativeImage, appIcon: nativeImage.createFromPath(path.join(__dirname, '../..', 'assets', process.platform === 'win32' ? 'app.ico' : 'app.png')).resize({ width: 16, height: 16 }), onClick: tray => showPanel(tray) });
  if (process.platform === 'darwin') macPanel = require('../apple_feature/panel.cjs').createPanelController({ window, screen, reducedMotion: () => nativeTheme.prefersReducedMotion, getTrayBounds: () => trayPresentation.entries.map(entry => {
    try { return entry.tray.getBounds(); } catch { return null; }
  }) });
  if (process.platform === 'linux') linuxPanel = require('../linux_feature/panel.cjs').createPanelController({ window, screen });
  nativeTheme.on('updated', update);
  handle('limits:get', publicState);
  const appearanceResult = action => {
    try {
      action();
      const next = appearance.state();
      for (const target of [window, widget, appleNotch?.window]) if (target && !target.isDestroyed()) target.webContents.send('limits:appearance-state', next);
      return next;
    } catch (error) { return { ...appearance.state(), error: ['imageTooLarge', 'invalidImage'].includes(error.message) ? error.message : 'appearanceFailed' }; }
  };
  handle('limits:appearance-get', () => appearance.state());
  handle('limits:appearance-image', () => appearance.imageData());
  handle('limits:appearance-set', value => appearanceResult(() => appearance.set(value)));
  handle('limits:appearance-choose', async () => {
    const parent = widgetSettings.displayMode === 'notch' ? appleNotch?.window : window;
    const choose = () => dialog.showOpenDialog(parent, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }] });
    const result = widgetSettings.displayMode === 'notch' ? await appleNotch.withModal(choose) : await choose();
    if (result.canceled || !result.filePaths.length) return appearance.state();
    return appearanceResult(() => appearance.importImage(result.filePaths[0], nativeImage));
  });
  handle('limits:refresh', async () => { await monitor?.refresh(); return publicState(); });
  handle('limits:open', showPanel);
  handle('limits:select', id => { if (typeof id === 'string') monitor?.select(id); });
  handle('limits:language', setLanguage);
  handle('limits:display-mode', setDisplayMode);
  handle('limits:preference', (key, value) => {
    const changed = changePreference(key, value, { app, settings: widgetSettings, platform: process.platform,
      taskbarSupported, demo, smoke, resetPosition: resetWidget, save: saveWidgetSettings, update, place: placeWidget });
    return { ...publicState(), preferenceError: changed ? null : 'unavailable' };
  });
  ipcMain.handle('limits:panel-size', (event, height) => {
    if (!trusted(event)) throw new Error('Unauthorized');
    if (event.sender === appleNotch?.window?.webContents) return appleNotch.resize(height);
    if (event.sender !== window.webContents) return false;
    return (macPanel || linuxPanel)?.resize(height) || false;
  });
  handle('limits:hide', () => widgetSettings.displayMode === 'notch' ? appleNotch?.collapse() : window.hide());
  handle('limits:quit', () => app.quit());
  async function openLogin(id) {
    if (!monitor || demo) return { error: 'loginUnavailable' };
    const profileId = id === undefined ? monitor.selectedProfileId : id;
    let attempt;
    try {
      const authUrl = await monitor.login(profileId);
      if (!authUrl) return {}; // Cancelled or completed while the start request was pending.
      attempt = monitor.loginAttempt;
      const url = new URL(authUrl);
      if (url.protocol !== 'https:' || !['auth.openai.com', 'auth.chatgpt.com', 'chatgpt.com'].includes(url.hostname)) throw new Error('Unexpected login URL');
      await shell.openExternal(url.href);
      return {};
    } catch (error) {
      if (attempt) await monitor.cancelLogin(profileId, attempt).catch(() => {});
      return { error: error.code === 'loginBusy' ? 'loginBusy' : 'loginFailed' };
    }
  }
  handle('limits:login', openLogin);
  handle('limits:profile-add', async () => {
    if (!monitor || demo) return { error: 'loginUnavailable' };
    if (monitor.loginActive) return { error: 'loginBusy' };
    try { return await openLogin(monitor.add()); } catch { return { error: 'accountActionFailed' }; }
  });
  handle('limits:profile-action', async (action, id, value) => {
    if (!monitor || typeof id !== 'string') return { error: 'accountActionFailed' };
    try {
      if (action === 'select') monitor.selectProfile(id);
      else if (action === 'rename' && typeof value === 'string') monitor.rename(id, value);
      else if (action === 'remove' && !demo) await monitor.remove(id);
      else if (action === 'cancel' && !demo) await monitor.cancelLogin(id);
      else return { error: 'accountActionFailed' };
      return {};
    } catch { return { error: 'accountActionFailed' }; }
  });
  await window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (linuxPanel) await window.webContents.executeJavaScript('window.limitsLinuxPanelReady');
  if (macPanel) await window.webContents.executeJavaScript('window.limitsMacPanelReady');
  if (process.platform === 'darwin') {
    const { AppleNotch } = require('../apple_feature/notch.cjs');
    appleNotch = new AppleNotch({ BrowserWindow, screen, Menu, webPreferences, restrictWindow, resourcesPath: app.isPackaged ? process.resourcesPath : null, getState: publicState, getMenu: presentationMenu, onChange: update, onUnavailable: () => setDisplayMode('tray') });
    await appleNotch.discover();
    if (appleNotch.available) await appleNotch.prepare();
    if (!displayModes().includes(widgetSettings.displayMode)) widgetSettings.displayMode = 'tray';
    if (widgetSettings.displayMode === 'notch') {
      try { await appleNotch.enable(); }
      catch (error) { console.error('Apple notch:', error.message); widgetSettings.displayMode = 'tray'; }
    }
  }
  if (taskbarSupported) await createWidget();
  try {
      const root = app.getPath('userData');
      if (demo) {
        const { DemoMonitor } = require('./demo-monitor.cjs');
        monitor = new Accounts({ root, initialProfiles: [{ id: 'default', nickname: 'Personal' }, { id: '00000000-0000-4000-8000-000000000001', nickname: 'Work' }], createMonitor: profile => new DemoMonitor(profile) });
      } else {
        const binary = findCodex({ resourcesPath: app.isPackaged ? process.resourcesPath : null });
        monitor = new Accounts({ root, createMonitor: (_profile, options) => new Monitor(new CodexClient(binary, options)) });
      }
      if (smoke) monitor.on('diagnostic', info => console.log('SMOKE_RPC', JSON.stringify(info)));
      monitor.on('state', next => { state = { ...next, demo }; update(); });
      if (process.platform === 'win32' && !demo && !smoke) require('../windows_feature/onboarding.cjs').offerSignIn(monitor, showPanel);
      state = { ...monitor.snapshot(), demo };
      void monitor.refresh();
  } catch { state = { ...state, status: 'error', error: 'codexMissing' }; }
  update();
  tick = setInterval(update, 15000);
  powerMonitor.on('resume', () => void monitor?.refresh());
  if (smoke || (taskbarSupported ? !taskbarMetrics?.available : !process.argv.includes('--hidden'))) await showPanel();
  if (smoke && !taskbarSupported) {
    try {
      await monitor?.refresh();
      await window.webContents.executeJavaScript('window.renderReady');
      await window.webContents.executeJavaScript('window.limits.get().then(render)');
      const report = await window.webContents.executeJavaScript(`({ values: [...document.querySelectorAll('.remaining-value')].map(el => el.textContent), isolated: typeof require === 'undefined', mode: document.getElementById('display-mode').value })`);
      if (!report.isolated || report.mode !== 'tray' || trayPresentation.entries.length !== 2 || (demo ? report.values.join(',') !== '72,46' : state.status !== 'ready')) throw new Error('Tray-only startup failed');
      const firstPlacement = macPanel?.snapshot();
      if (firstPlacement && (firstPlacement.fallback || !require('../apple_feature/panel.cjs').isMenuBarAnchor(firstPlacement.anchor, firstPlacement.display) || !window.isVisible() || window.getBounds().y !== firstPlacement.bounds.y)) throw new Error('Mac first launch did not open below a menu-bar indicator');
      for (const entry of trayPresentation.entries) {
        window.hide(); entry.tray.emit('click');
        if (!window.isVisible()) throw new Error('Tray click did not open the panel');
      }
      if (setDisplayMode('widget').displayMode !== 'tray' || widget) throw new Error('Windows widget was enabled in tray-only mode');
      if (demo) {
        monitor.selectProfile(state.profiles[1].id);
        await window.webContents.executeJavaScript('window.limits.get().then(render)');
        const values = await window.webContents.executeJavaScript(`['short-value', 'weekly-value'].map(id => document.getElementById(id).textContent)`);
        if (values.join(',') !== '38,81') throw new Error('Tray-only account switching failed');
        monitor.selectProfile('default');
      }
      fs.mkdirSync(artifactRoot, { recursive: true });
      const mac = process.platform === 'darwin' ? { ...await require('../apple_feature/smoke.cjs').verifyMacPanel({ window, trayPresentation, artifactRoot, demo }), firstPlacement, apple: await require('../apple_feature/smoke.cjs').verifyAppleNotch({ appleNotch, window, trayPresentation, setDisplayMode, artifactRoot, demo, monitor }) } : null;
      const linux = process.platform === 'linux' ? await require('../linux_feature/smoke.cjs').verifyTrayStyles({ window, trayPresentation, artifactRoot, settingsPath: path.join(app.getPath('userData'), 'widget-settings.json') }) : null;
      fs.writeFileSync(path.join(artifactRoot, 'tray-only-smoke.json'), JSON.stringify({ ...report, icons: 2, accountSwitch: demo, taskbarStarted: false, ...(mac ? { mac } : {}), ...(linux ? { linux } : {}) }, null, 2));
      console.log('SMOKE_TRAY_OK', JSON.stringify(report)); app.quit();
    } catch (error) { console.error('SMOKE_FAILED', error.message); app.exit(1); }
    return;
  }
  if (smoke) {
    try {
      const originalMode = widgetSettings.displayMode;
      const originalVisibility = widgetSettings.visible;
      setDisplayMode('widget');
      if (monitor) {
        await monitor.refresh();
        while (monitor.inflight) await monitor.inflight;
      }
      await window.webContents.executeJavaScript('window.renderReady');
      await window.webContents.executeJavaScript('window.limits.get().then(render)');
      await widget.webContents.executeJavaScript('window.renderReady');
      await widget.webContents.executeJavaScript('window.limits.get().then(render)');
      const report = await window.webContents.executeJavaScript(`({ title: document.title, values: [...document.querySelectorAll('.remaining-value')].map(el => el.textContent), errorHidden: document.querySelector('#error').hidden, cards: document.querySelectorAll('.quota-card').length, isolated: typeof require === 'undefined' })`);
      if (report.title !== app.getName() || (demo ? report.values.join(',') !== '72,46' : state.status !== 'ready') || !report.errorHidden || report.cards !== 2 || !report.isolated) throw new Error(JSON.stringify({ ...report, status: state.status, auth: state.account?.type || null }));
      const widgetReport = await widget.webContents.executeJavaScript(`({ values: ['short-value', 'weekly-value'].map(id => document.getElementById(id).textContent), accountVisible: !!document.getElementById('widget-account').textContent, bars: document.querySelectorAll('progress').length, isolated: typeof require === 'undefined', overflow: document.body.scrollWidth > innerWidth })`);
      if (!taskbarMetrics?.available || widgetReport.bars !== 2 || !widgetReport.accountVisible || !widgetReport.isolated || widgetReport.overflow || widgetReport.values.join(',') !== report.values.join(',')) throw new Error(JSON.stringify({ widgetReport, geometryAvailable: taskbarMetrics?.available }));
      const dir = artifactRoot;
      const name = demo ? 'panel' : 'panel-live';
      fs.mkdirSync(dir, { recursive: true });
      const originalLanguage = widgetSettings.language;
      const languages = [];
      for (const language of ['ru', 'en']) {
        await window.webContents.executeJavaScript(`window.limits.language('${language}').then(render)`);
        await widget.webContents.executeJavaScript('window.limits.get().then(render)');
        const labels = await window.webContents.executeJavaScript(`({ language: document.documentElement.lang, short: document.querySelector('.short [data-i18n="short"]').textContent, reset: document.getElementById('short-reset').textContent, refresh: document.getElementById('refresh').textContent, clean: !/До сброса|Осталось|каждые 30|Resets in|Remaining|every 30/.test(document.body.textContent) })`);
        if (labels.language !== language || labels.short !== translate(language, 'short') || labels.refresh !== translate(language, 'refresh') || !labels.clean) throw new Error(JSON.stringify(labels));
        const reset = await widget.webContents.executeJavaScript(`document.getElementById('short-reset').textContent`);
        if (reset !== labels.reset || (demo && reset !== '2:19')) throw new Error('Short reset countdown is missing or inconsistent.');
        // Exercise the automatic compact sizes independently of live taskbar space.
        for (const width of [200, 210, 220, 240, 280, 320, 400]) {
          widgetSettings.width = width; placeWidget();
          widget.setSize(width, widget.getBounds().height);
          await new Promise(resolve => setTimeout(resolve, 100));
          const layout = await widget.webContents.executeJavaScript(`({ language: document.documentElement.lang, overflow: document.body.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight, barWidths: [...document.querySelectorAll('progress')].map(el => el.getBoundingClientRect().width) })`);
          if (layout.language !== language || layout.overflow || layout.barWidths.some(width => width < 20)) throw new Error(JSON.stringify(layout));
          if (width === 200) fs.writeFileSync(path.join(dir, `${name}-taskbar-compact-${language}.png`), (await widget.webContents.capturePage()).toPNG());
        }
        widgetSettings.width = 280; placeWidget();
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
      if (!testWindow.isMaximized()) throw new Error('Simulated window did not maximize.');
      const result = spawnSync(helperPath, ['--test-window-mode', String(process.pid), nativeHandleId(testWindow)], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      testWindow.destroy();
      const maximized = JSON.parse(result.stdout.trim());
      if (!maximized.available || maximized.fullscreen) throw new Error('Native probe classified a maximized window as fullscreen.');
      const fullscreenTest = new BrowserWindow({ ...screen.getDisplayMatching(taskbarMetrics.bar).bounds, frame: false, show: false, focusable: false });
      fullscreenTest.showInactive();
      fullscreenTest.setFullScreen(true);
      await new Promise(resolve => setTimeout(resolve, 200));
      const fullscreenResult = spawnSync(helperPath, ['--test-window-mode', String(process.pid), nativeHandleId(fullscreenTest)], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      fullscreenTest.destroy();
      if (!JSON.parse(fullscreenResult.stdout.trim()).fullscreen) throw new Error('Native probe missed a borderless fullscreen window.');
      showPanel();
      // Exercise Windows' owner ordering with our own simulated taskbar, without late repairs.
      const simulatedTaskbar = new BrowserWindow({ width: 300, height: 40, show: false, focusable: false, frame: false, alwaysOnTop: true });
      simulatedTaskbar.showInactive();
      probe.stop();
      const zorder = await new Promise((resolve, reject) => {
        require('node:child_process').execFile(helperPath, ['--test-ownership', String(process.pid), nativeHandleId(widget), nativeHandleId(simulatedTaskbar)], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
          if (error) { reject(new Error('Native ownership ordering changed visibility, bounds or focus: ' + stdout.trim())); return; }
          try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); }
        });
      });
      simulatedTaskbar.destroy();
      await probe.start();
      // Simulate repeated native taskbar observations, including Windows' clamped height.
      const beforePlacement = { ...placement.changes };
      for (let i = 0; i < 50; i++) placeWidget();
      if (JSON.stringify(beforePlacement) !== JSON.stringify(placement.changes)) throw new Error('Repeated metrics changed the widget window.');
      const retiredWidget = widget;
      const simulatedOwner = new BrowserWindow({ width: 300, height: 40, show: false, focusable: false, frame: false, alwaysOnTop: true });
      simulatedOwner.showInactive();
      probe.stop();
      await new Promise((resolve, reject) => {
        require('node:child_process').execFile(helperPath, ['--test-owner-destroy', String(process.pid), nativeHandleId(widget), nativeHandleId(simulatedOwner)], { windowsHide: true, timeout: 5000 }, error => error ? reject(error) : resolve());
      });
      simulatedOwner.destroy();
      const recoveryDeadline = Date.now() + 5000;
      while (Date.now() < recoveryDeadline && (widget === retiredWidget || !widget?.isVisible() || !taskbarMetrics?.attached)) await new Promise(resolve => setTimeout(resolve, 50));
      const recovered = retiredWidget.isDestroyed() && widget && widget !== retiredWidget && widget.isVisible() && taskbarMetrics?.attached;
      if (!recovered) throw new Error('Widget did not recover after its native owner was destroyed.');
      await widget.webContents.executeJavaScript('window.renderReady');
      const recoveredValues = await widget.webContents.executeJavaScript(`['short-value', 'weekly-value'].map(id => document.getElementById(id).textContent)`);
      if (recoveredValues.join(',') !== report.values.join(',')) throw new Error('Recreated widget lost its account quotas.');
      const displayModes = [];
      for (const language of ['ru', 'en']) {
        setLanguage(language);
        await window.webContents.executeJavaScript(`window.limits.displayMode('tray').then(render)`);
        if (widget.isVisible() || trayPresentation.entries.length !== 2) throw new Error('Tray mode did not replace the widget with two icons.');
        const currentTrays = trayPresentation.entries.map(entry => entry.tray);
        update();
        if (currentTrays.some((tray, index) => trayPresentation.entries[index].tray !== tray)) throw new Error('Polling recreated tray icons.');
        for (const entry of trayPresentation.entries) {
          if (!entry.tooltip.includes(state.account.email) || !entry.tooltip.includes(translate(language, entry.kind))) throw new Error('Quota tray tooltip is incomplete.');
          if (entry.image.isEmpty() || entry.image.getSize().width !== 16) throw new Error('Quota tray icon is missing.');
          fs.writeFileSync(path.join(dir, `${name}-tray-${entry.kind}-${language}.png`), entry.image.toPNG());
          window.hide();
          entry.tray.emit('click');
          if (!window.isVisible()) throw new Error('Clicking a quota tray icon did not open the panel.');
        }
        await window.webContents.executeJavaScript('window.limits.get().then(render)');
        const displayLabel = await window.webContents.executeJavaScript(`document.getElementById('display-mode').selectedOptions[0].textContent`);
        if (displayLabel !== translate(language, 'trayMode')) throw new Error('Display mode selection was not translated.');
        fs.writeFileSync(path.join(dir, `${name}-tray-${language}.png`), (await window.webContents.capturePage()).toPNG());
        persistWidgetSettings();
        if (JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'widget-settings.json'), 'utf8')).displayMode !== 'tray') throw new Error('Tray mode was not saved.');
        await window.webContents.executeJavaScript(`window.limits.displayMode('widget').then(render)`);
        if (!widget.isVisible() || trayPresentation.entries.length !== 1) throw new Error('Switching back did not restore the taskbar widget.');
        displayModes.push({ language, trayIcons: currentTrays.length, clickOpensPanel: true, saved: true, widgetRestored: true });
      }
      setLanguage(originalLanguage);
      const accountChecks = { profiles: state.profiles.length };
      if (demo) {
        const work = state.profiles[1].id;
        await window.webContents.executeJavaScript(`window.limits.accountAction('select', '${work}').then(() => window.limits.get()).then(render)`);
        await widget.webContents.executeJavaScript('window.limits.get().then(render)');
        const workValues = await widget.webContents.executeJavaScript(`['short-value', 'weekly-value'].map(id => document.getElementById(id).textContent)`);
        if (workValues.join(',') !== '38,81') throw new Error('Switching account did not update the widget.');
        setDisplayMode('tray');
        if (!trayPresentation.entries.every(entry => entry.tooltip.includes('work@example.com'))) throw new Error('Tray did not switch accounts.');
        await window.webContents.executeJavaScript(`window.limits.accountAction('rename', 'default', 'Sam').then(() => window.limits.accountAction('rename', '${work}', 'Sam')).then(() => window.limits.get()).then(render)`);
        await widget.webContents.executeJavaScript('window.limits.get().then(render)');
        const names = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.profile-name')].map(el => el.textContent)`);
        if (names.join('|') !== 'Sam (demo@example.com)|Sam (work@example.com)') throw new Error('Duplicate nicknames were not disambiguated.');
        accountChecks.switched = true; accountChecks.names = names;
        fs.writeFileSync(path.join(dir, 'panel-multiple-accounts.png'), (await window.webContents.capturePage()).toPNG());
        await window.webContents.executeJavaScript(`window.limits.accountAction('rename', 'default', 'Personal').then(() => window.limits.accountAction('rename', '${work}', 'Work')).then(() => window.limits.accountAction('select', 'default')).then(() => window.limits.get()).then(render)`);
        setDisplayMode('widget');
      }
      if (process.argv.includes('--smoke-stability')) {
        const until = Date.now() + 65000;
        while (Date.now() < until) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (widgetSettings.displayMode === 'widget' && widgetBounds(taskbarMetrics, widgetSettings) && !widget.isVisible()) throw new Error('Taskbar widget disappeared.');
        }
      }
      setDisplayMode(originalMode);
      widgetSettings.visible = originalVisibility; placeWidget();
      const completedReport = { ...report, widget: widgetReport, languages, displayModes, accountChecks, maximizedFullscreen: maximized.fullscreen, zorder, recovered, placementChanges: placement.changes, bounds: widget.getBounds(), taskbar: taskbarMetrics.bar };
      fs.writeFileSync(path.join(dir, `${name}-smoke.json`), JSON.stringify(completedReport, null, 2));
      console.log('SMOKE_OK', JSON.stringify(completedReport));
      app.quit();
    } catch (error) { console.error('SMOKE_FAILED', error.message); app.exit(1); }
  }
}

if (singleInstance) {
  app.on('second-instance', showPanel);
  app.on('activate', () => showPanel());
  app.whenReady().then(setup).catch(error => { console.error(error.message); app.exit(1); });
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; macPanel?.cancel(); linuxPanel?.dispose(); appleNotch?.destroy(); clearInterval(tick); clearTimeout(saveTimer); if (window) persistWidgetSettings(); widgetHost?.stop(); monitor?.stop(); trayPresentation?.destroy(); });
