'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hitBounds } = require('../../notch/geometry.cjs');
const { verifyContentSizing, verifyCompactMacPanel } = require('./panel.cjs');
const { verifyNotchHover, verifyNotchSurface, verifyCompactAppearance } = require('./notch-appearance.cjs');
const { verifyMenuBarProtection } = require('./menu-bar.cjs');

async function verifyAppleNotch({ appleNotch, window, trayPresentation, setDisplayMode, artifactRoot, demo, monitor, showResetNotification }) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  if (!appleNotch.available) {
    const state = await window.webContents.executeJavaScript('window.limits.get()');
    if (state.displayModes.includes('notch') || state.displayModes.includes('island') || setDisplayMode('notch').displayMode !== 'tray' || setDisplayMode('island').displayMode !== 'tray' || appleNotch.window) throw new Error('Notch mode exposed on a Mac without a notch');
    return { available: false, hidden: true };
  }
  await window.webContents.executeJavaScript(`window.limits.displayMode('notch')`);
  for (let i = 0; i < 100 && (!appleNotch.enabled || appleNotch.phase !== 'expanded'); i++) await delay(20);
  if (!appleNotch.enabled || appleNotch.phase !== 'expanded' || trayPresentation.entries.length || window.isVisible()) throw new Error('Notch mode switch failed');
  clearInterval(appleNotch.timer); appleNotch.timer = null;
  const target = appleNotch.window;
  const layout = appleNotch.snapshot();
  if (layout.bounds.y !== 0 && layout.bounds.y !== require('electron').screen.getAllDisplays().find(display => display.id === layout.displayId).bounds.y) throw new Error('Notch is not at the screen top');
  await target.webContents.executeJavaScript('window.renderReady');
  async function renderState() { await target.webContents.executeJavaScript('window.limits.get().then(render)'); }
  await renderState();
  const surface = await verifyNotchSurface({ appleNotch, target, artifactRoot });
  const contentSizing = await verifyContentSizing(target, appleNotch);
  const compactAppearance = await verifyCompactAppearance({ appleNotch, target, artifactRoot });
  const report = await target.webContents.executeJavaScript(`({ isolated: typeof require === 'undefined', mode: document.getElementById('display-mode').value, values: ['short','weekly'].map(kind => document.getElementById('apple-' + kind + '-value').textContent), timer: document.getElementById('apple-short-reset').textContent, scroll: getComputedStyle(document.querySelector('main')).overflowY, horizontalOverflow: document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth, animation: getComputedStyle(document.querySelector('.apple-shell')).transitionDuration })`);
  if (!report.isolated || report.mode !== 'notch' || report.timer === '—' || report.scroll !== 'auto' || report.horizontalOverflow || !report.animation.includes('0.44s') || (demo && report.values.join(',') !== '72%,46%')) throw new Error('Notch rendering failed: ' + JSON.stringify(report));
  if (demo) {
    monitor.selectProfile('00000000-0000-4000-8000-000000000001'); await renderState();
    const values = await target.webContents.executeJavaScript(`['short','weekly'].map(kind => document.getElementById('apple-' + kind + '-value').textContent)`);
    if (values.join(',') !== '38%,81%') throw new Error('Notch account switching failed');
    monitor.selectProfile('default'); await renderState();
    await delay(550);
    fs.writeFileSync(path.join(artifactRoot, 'apple-notch-expanded.png'), (await target.webContents.capturePage()).toPNG());
    await target.webContents.executeJavaScript('window.limitsSettings.open()');
    await delay(600);
    fs.writeFileSync(path.join(artifactRoot, 'apple-notch-settings.png'), (await target.webContents.capturePage()).toPNG());
    await target.webContents.executeJavaScript('window.limitsSettings.dialog.close()');
    await delay(600);
  }
  appleNotch.collapse(); await renderState(); await delay(500);
  if (demo) fs.writeFileSync(path.join(artifactRoot, 'apple-notch-closed.png'), (await target.webContents.capturePage()).toPNG());
  appleNotch.hoverBlocked = false; appleNotch.enteredAt = Date.now() - 120;
  const bounds = hitBounds(layout, 'closed');
  appleNotch.trackPointer({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height - 3 });
  await renderState(); await delay(500);
  if (appleNotch.phase !== 'peek') throw new Error('Notch hover did not reveal preview');
  if (demo) fs.writeFileSync(path.join(artifactRoot, 'apple-notch-peek.png'), (await target.webContents.capturePage()).toPNG());
  await target.webContents.executeJavaScript(`document.getElementById('apple-trigger').click()`); await renderState();
  if (appleNotch.phase !== 'expanded') throw new Error('Notch click did not expand');
  await target.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  if (appleNotch.phase !== 'closed') throw new Error('Escape did not collapse notch');
  const reduced = await target.webContents.executeJavaScript(`window.limits.get().then(next => { render({ ...next, reducedMotion: true }); return getComputedStyle(document.querySelector('.apple-shell')).transitionDuration; })`);
  if (reduced !== '0.001s') throw new Error('Notch ignores reduced motion');
  const island = await verifyAppleIsland({ appleNotch, target, trayPresentation, artifactRoot, demo, monitor, showResetNotification });
  await target.webContents.executeJavaScript(`window.limits.displayMode('tray')`);
  if (appleNotch.enabled || target.isVisible() || trayPresentation.entries.length !== 2) throw new Error('Tray mode was not restored');
  await delay(100);
  return { ...report, surface, contentSizing, compactAppearance, island, physical: layout.physical, displayId: layout.displayId, bounds: layout.bounds, hover: true, click: true, escape: true, accountSwitch: demo, reducedMotion: true, modeRestored: true };
}

async function verifyAppleIsland(options) {
  const { appleNotch } = options;
  const read = appleNotch.readNativeScreens, growDelay = appleNotch.menuBar.growDelay, measured = appleNotch.menuBar.info;
  const context = appleNotch.menuBar.context, pendingContext = appleNotch.menuBar.pendingContext;
  const native = appleNotch.screenInfo;
  // Exercise deterministic menu layouts without relying on the user's current status items.
  appleNotch.readNativeScreens = async () => [{ ...native, menuBarLeft: 0, menuBarRight: appleNotch.display.bounds.width }];
  appleNotch.menuBar.growDelay = 0;
  try { return await appleNotch.withModal(() => verifyAppleIslandContent(options)); }
  finally {
    appleNotch.readNativeScreens = read;
    appleNotch.menuBar.growDelay = growDelay;
    appleNotch.menuBar.info = measured;
    appleNotch.menuBar.context = context;
    appleNotch.menuBar.pendingContext = pendingContext;
    await appleNotch.refreshMenuBar();
  }
}

async function verifyAppleIslandContent({ appleNotch, target, trayWindow, trayPresentation, artifactRoot, demo, monitor, showResetNotification, layoutFixture }) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const run = source => target.webContents.executeJavaScript(source);
  const renderState = () => run('window.limits.get().then(render)');
  async function preview(name, height) {
    // A neutral demo wallpaper makes the transparent curved edges visible in the artifact.
    await run("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    await delay(80);
    try { fs.writeFileSync(path.join(artifactRoot, name), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height })).toPNG()); }
    finally { await run("document.documentElement.style.removeProperty('background')"); }
  }
  await run("window.limits.displayMode('island')");
  for (let i = 0; i < 100 && (appleNotch.mode !== 'island' || !appleNotch.enabled); i++) await delay(20);
  clearInterval(appleNotch.timer); appleNotch.timer = null;
  clearInterval(appleNotch.menuBarTimer); appleNotch.menuBarTimer = null;
  await renderState(); await delay(550);
  if (appleNotch.mode !== 'island' || trayPresentation.entries.length) throw new Error('Side panel mode did not activate');
  if (layoutFixture) {
    const island = await verifyNotchHover({ appleNotch, target, preview });
    const menu = await verifyMenuBarProtection({ appleNotch, target, artifactRoot });
    await run("window.limits.displayMode('notch')");
    for (let i = 0; i < 100 && (appleNotch.mode !== 'notch' || appleNotch.phase !== 'expanded'); i++) await delay(20);
    if (appleNotch.mode !== 'notch' || appleNotch.phase !== 'expanded') throw new Error('Notch mode did not activate');
    clearInterval(appleNotch.timer); appleNotch.timer = null;
    const notch = await verifyNotchHover({ appleNotch, target, preview });
    await run("window.limits.displayMode('tray')");
    await verifyCompactMacPanel(trayWindow);
    return { ...menu, hover: { island, notch }, trayPreview: true };
  }
  const surface = await verifyNotchSurface({ appleNotch, target, artifactRoot });
  const contentSizing = await verifyContentSizing(target, appleNotch);
  const menuBarProtection = await verifyMenuBarProtection({ appleNotch, target, artifactRoot });
  const compactAppearance = await verifyCompactAppearance({ appleNotch, target, artifactRoot });
  appleNotch.collapse(); await renderState(); await delay(500);
  const header = await run(`(() => {
    const shell = document.querySelector('.apple-shell').getBoundingClientRect();
    const meters = [...document.querySelectorAll('.apple-island-meter')].map(el => ({ text: el.textContent, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
    return { mode: document.getElementById('display-mode').value, color: getComputedStyle(document.querySelector('.apple-shell')).backgroundColor, shell: { left: shell.left, right: shell.right, width: shell.width }, meters, settings: document.getElementById('display-mode-description').textContent };
  })()`);
  const center = appleNotch.snapshot().bounds.width / 2;
  const notchWidth = appleNotch.snapshot().notchWidth;
  if (header.mode !== 'island' || header.color !== 'rgb(0, 0, 0)' || header.meters[0].right > center - notchWidth / 2 || header.meters[1].left < center + notchWidth / 2) throw new Error('Side indicators overlap physical notch: ' + JSON.stringify(header));
  if (demo && header.meters.map(item => item.text).join(',') !== '72%5h,7d46%') throw new Error('Side panel quotas do not match the selected account');
  if (demo) {
    monitor.selectProfile('00000000-0000-4000-8000-000000000001'); await renderState();
    if (await run("[...document.querySelectorAll('.apple-island-value')].map(el => el.textContent).join(',')") !== '38%,81%') throw new Error('Side panel account switch failed');
    monitor.selectProfile('default'); await renderState();
    fs.writeFileSync(path.join(artifactRoot, 'apple-island-closed.png'), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height: appleNotch.layout.closedHeight + 16 })).toPNG());
    await preview('apple-island-closed-preview.png', appleNotch.layout.closedHeight + 40);
  }
  const transparent = (await target.webContents.capturePage()).toBitmap()[3] === 0;
  if (!transparent) throw new Error('Side panel host blocks the transparent screen area');
  appleNotch.notify({ title: 'Заканчивается лимит', body: '5h: 8%.' });
  if (!showResetNotification({ kind: 'scheduled', resetType: 'regular', scheduledFor: Date.now() + 3600000 })) throw new Error('Reset notification did not route to the side panel');
  await renderState(); await delay(550);
  const notification = await run(`(() => {
    const notice = document.querySelector('.apple-notification');
    const body = notice.querySelector('p');
    return { phase: document.body.dataset.notchPhase, title: document.getElementById('apple-notification-title').textContent, body: body.textContent, visible: !notice.hidden, overflow: notice.scrollWidth > notice.clientWidth, meters: [...document.querySelectorAll('.apple-island-meter')].map(el => el.textContent), focused: document.hasFocus() };
  })()`);
  if (notification.phase !== 'notification' || notification.title !== 'Заканчивается лимит' || notification.overflow || !notification.visible || appleNotch.snapshot().notificationCount !== 2) throw new Error('Side panel notification rendering failed: ' + JSON.stringify(notification));
  if (demo) fs.writeFileSync(path.join(artifactRoot, 'apple-island-notification.png'), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height: appleNotch.layout.notificationHeight + 16 })).toPNG());
  if (demo) await preview('apple-island-notification-preview.png', appleNotch.layout.notificationHeight + 30);
  await run("document.querySelector('.apple-notification-dismiss').click()"); await renderState();
  if (await run("document.getElementById('apple-notification-title').textContent") !== 'Limits · Codex Resets') throw new Error('Queued notification was lost');
  appleNotch.expand(); await renderState(); await delay(550);
  await run('window.limitsSettings.open()'); await renderState(); await delay(550);
  const noticeInSettings = await run(`(() => {
    const notice = document.querySelector('.apple-notification');
    return { inside: Boolean(notice.closest('#settings-dialog')), parent: notice.parentElement.className,
      open: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id), phase: document.body.dataset.notchPhase };
  })()`);
  if (!noticeInSettings.inside || !noticeInSettings.open.includes('settings-dialog')) throw new Error('Notification hid behind Settings: ' + JSON.stringify(noticeInSettings));
  if (demo) fs.writeFileSync(path.join(artifactRoot, 'apple-island-settings.png'), (await target.webContents.capturePage()).toPNG());
  await run('window.limitsSettings.dialog.close()');
  appleNotch.collapse(); await renderState();
  await run("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"); await renderState();
  if (appleNotch.phase !== 'closed' || appleNotch.snapshot().notification) throw new Error('Escape did not dismiss the side panel message');
  const originalGetState = appleNotch.getState;
  const base = originalGetState();
  const descriptors = Array.from({ length: 40 }, (_, index) => ({ id: `metric-${index}`, label: { ru: `Показатель ${index + 1}`, en: `Metric ${index + 1}` }, compactLabel: { ru: `M${index + 1}`, en: `M${index + 1}` } }));
  const sample = { ...base, selectedId: 'many', buckets: [], groups: [{ id: 'many', name: 'Many metrics', metrics: descriptors.map((item, index) => ({ id: item.id, type: index === 0 ? 'money' : 'percentage', currency: 'USD', value: index === 0 ? 123456.78 : index + 1, semantics: 'remaining', resetsAt: null })) }], displaySchema: { layout: 'metrics', primaryMetricId: descriptors[0].id, groups: [{ id: 'many', metrics: descriptors }] } };
  let many;
  try {
    appleNotch.getState = () => sample; appleNotch.update(); await delay(550);
    many = await run(`(() => {
      const more = document.querySelector('.apple-island-more');
      const visible = [...document.querySelectorAll('.apple-island-meter')].filter(el => !el.hidden).map(el => ({ left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
      return { more: more.textContent, hidden: document.querySelectorAll('.apple-island-meter[hidden]').length, visible, total: document.querySelectorAll('.apple-island-meter').length };
    })()`);
    if (many.total !== 40 || many.hidden < 1 || many.more !== `+${many.hidden}` || many.visible.some(rect => rect.left < center + notchWidth / 2 && rect.right > center - notchWidth / 2)) throw new Error('Many indicators overlap or vanish: ' + JSON.stringify(many));
    if (demo) await preview('apple-island-many-preview.png', appleNotch.layout.closedHeight + 40);
    await run("document.querySelector('.apple-island-more').click()"); await delay(550);
    if (appleNotch.phase !== 'expanded' || await run("document.querySelectorAll('#provider-metrics .metric-card').length") !== 40 || !await run("document.querySelector('main').scrollHeight > document.querySelector('main').clientHeight")) throw new Error('Overflow does not open all metrics in a scrollable panel');
  } finally { appleNotch.getState = originalGetState; appleNotch.update(); }
  appleNotch.collapse(); await renderState();
  await run("window.limits.demoUpdate('available')"); await renderState(); await delay(550);
  if (appleNotch.phase !== 'notification' || appleNotch.snapshot().notification?.action !== 'updates' || await run("document.getElementById('updates-dialog').open")) throw new Error('Update offer bypassed the notification panel');
  await run("document.querySelector('.apple-notification-action').click()"); await renderState(); await delay(550);
  if (!await run("document.getElementById('updates-dialog').open") || (await run('window.limits.get()')).updates.installation.status !== 'idle') throw new Error('Update notification did not preserve download consent');
  await run("document.getElementById('updates-later').click()");
  await run("window.limits.demoUpdate('current')");
  appleNotch.collapse(); await renderState();
  return { header, notification, many, surface, contentSizing, compactAppearance, menuBarProtection, transparent, queue: true, resetRouting: true, updateRouting: true, settings: true, accountSwitch: demo };
}

module.exports = { verifyAppleNotch, verifyAppleIsland };
