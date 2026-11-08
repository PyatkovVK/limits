'use strict';
const fs = require('node:fs');
const path = require('node:path');

async function verifyContentSizing(window, notch = null) {
  const delay = () => new Promise(resolve => setTimeout(resolve, 600));
  async function height() {
    await window.webContents.executeJavaScript('window.limitsMacPanelReady.then(() => window.limitsMacPanel.report())');
    await delay();
    return notch ? notch.snapshot().fullHeight : window.getBounds().height;
  }
  const compact = await height();
  const expected = await window.webContents.executeJavaScript('window.limitsMacPanel.measure()');
  if (Math.abs(compact - expected - (notch?.snapshot().contentTop || 0)) > 2) throw new Error('Mac panel has empty space below content');
  await window.webContents.executeJavaScript(`(() => {
    const notice = document.createElement('div'); notice.id = 'sizing-smoke'; notice.className = 'notice';
    notice.textContent = 'A longer connection message that wraps onto several lines. '.repeat(8);
    document.querySelector('.mac-panel-content').append(notice);
  })()`);
  const expanded = await height();
  if (expanded <= compact) throw new Error('Mac panel did not grow for a notice');
  await window.webContents.executeJavaScript("document.getElementById('sizing-smoke').remove()");
  if (await height() !== compact) throw new Error('Mac panel did not shrink after removing content');
  await window.webContents.executeJavaScript('window.limitsSettings.open()');
  const settings = await height();
  if (settings <= compact) throw new Error('Mac panel did not grow for Settings: ' + JSON.stringify({ compact, settings, notch: Boolean(notch) }));
  const modal = await window.webContents.executeJavaScript(`(() => {
    const dialog = document.getElementById('settings-dialog');
    const bounds = dialog.getBoundingClientRect();
    const close = dialog.querySelector('.settings-close').getBoundingClientRect();
    const cap = document.body.classList.contains('apple-notch') ? parseFloat(getComputedStyle(document.body).getPropertyValue('--content-top')) : 0;
    const bottom = document.body.classList.contains('apple-notch') ? parseFloat(getComputedStyle(document.body).getPropertyValue('--full-height')) : innerHeight;
    const shoulderBottom = document.body.classList.contains('apple-notch') ? parseFloat(getComputedStyle(document.body).getPropertyValue('--cap-height')) + 12 : 0;
    const inset = parseFloat(getComputedStyle(dialog).getPropertyValue('--settings-inset')) || 14;
    return { top: bounds.top, bottom: bounds.bottom, safeTop: cap, safeBottom: bottom, shoulderBottom, inset,
      closeWidth: close.width, closeHeight: close.height, contained: close.top >= bounds.top && close.right <= bounds.right && close.bottom <= bounds.bottom };
  })()`);
  if (modal.top < modal.safeTop || modal.bottom > modal.safeBottom + 1) throw new Error('Mac Settings overlaps the notch or leaves its panel: ' + JSON.stringify(modal));
  if (notch && modal.top - modal.shoulderBottom < modal.inset) throw new Error('Settings has no top inset after the notch shoulders: ' + JSON.stringify(modal));
  if (modal.closeWidth !== 32 || modal.closeHeight !== 32 || !modal.contained) throw new Error('Mac Settings close button is stretched: ' + JSON.stringify(modal));
  await window.webContents.executeJavaScript('window.limitsSettings.dialog.close()');
  if (await height() !== compact) throw new Error('Mac panel did not shrink after closing Settings');
  await window.webContents.executeJavaScript(`(() => {
    const overflow = document.createElement('div'); overflow.id = 'sizing-smoke'; overflow.style.height = '2000px';
    document.querySelector('.mac-panel-content').append(overflow);
  })()`);
  const capped = await height();
  const scrolls = await window.webContents.executeJavaScript("document.querySelector('main').scrollHeight > document.querySelector('main').clientHeight");
  if (!scrolls || (notch && capped !== notch.snapshot().maxFullHeight)) throw new Error('Mac panel does not scroll when content exceeds available height');
  await window.webContents.executeJavaScript("document.getElementById('sizing-smoke').remove()");
  if (await height() !== compact) throw new Error('Mac panel remained large after overflowing content was removed');
  return { compact, expanded, settings, capped, modal, shrinks: true, scrolls };
}

async function verifyMacPanel({ window, trayPresentation, artifactRoot, demo }) {
  for (const { image, kind } of trayPresentation.entries) {
    const { width, height } = image.getSize();
    if (width !== (kind === 'short' ? 104 : 64) || height !== 18 || !image.getScaleFactors().includes(2)) throw new Error('Mac menu-bar indicators lack the wide Retina images');
  }
  const originalTheme = await window.webContents.executeJavaScript('document.body.dataset.theme');
  if (demo) await window.webContents.executeJavaScript(`window.limits.get().then(next => render({ ...next, demo: false, profiles: next.profiles.filter(profile => profile.id === next.selectedProfileId) }))`);
  const themes = [];
  let contentSizing;
  try {
    contentSizing = await verifyContentSizing(window);
    for (const theme of ['light', 'dark']) {
      const report = await window.webContents.executeJavaScript(`(() => {
        document.body.dataset.theme = ${JSON.stringify(theme)};
        const style = getComputedStyle(document.body);
        const bounds = document.body.getBoundingClientRect();
        return { platform: document.body.dataset.platform, radius: style.borderRadius, theme: style.colorScheme, overflow: document.body.scrollWidth > innerWidth, nativeFont: style.fontFamily.includes('-apple-system'), fillsWindow: bounds.top === 0 && bounds.bottom === innerHeight, scrollContained: getComputedStyle(document.querySelector('main')).overflowY === 'auto' };
      })()`);
      if (report.platform !== 'darwin' || report.radius !== '22px' || report.theme !== theme || report.overflow || !report.nativeFont || !report.fillsWindow || !report.scrollContained) throw new Error('Mac glass panel styling failed: ' + JSON.stringify(report));
      if (demo) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const image = await window.webContents.capturePage();
        fs.writeFileSync(path.join(artifactRoot, `mac-panel-${theme}.png`), image.toPNG());
        await window.webContents.executeJavaScript('window.limitsSettings.open()');
        await new Promise(resolve => setTimeout(resolve, 600));
        fs.writeFileSync(path.join(artifactRoot, `mac-settings-${theme}.png`), (await window.webContents.capturePage()).toPNG());
        await window.webContents.executeJavaScript('window.limitsSettings.dialog.close()');
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      themes.push(report);
    }
  } finally {
    if (demo) await window.webContents.executeJavaScript('window.limits.get().then(render)');
    await window.webContents.executeJavaScript(`document.body.dataset.theme = ${JSON.stringify(originalTheme)}`);
  }
  return { themes, contentSizing, menuBar: { indicators: 2, widths: [104, 64], height: 18, retina: true, countdown: true } };
}
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
  const bounds = require('./geometry.cjs').hitBounds(layout, 'closed');
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
  const read = appleNotch.readNativeScreens, growDelay = appleNotch.menuBarGrowDelay, measured = appleNotch.layoutScreenInfo;
  const context = appleNotch.menuBarContext, pendingContext = appleNotch.pendingMenuBarContext;
  const native = appleNotch.screenInfo;
  // Exercise deterministic menu layouts without relying on the user's current status items.
  appleNotch.readNativeScreens = async () => [{ ...native, menuBarLeft: 0, menuBarRight: appleNotch.display.bounds.width }];
  appleNotch.menuBarGrowDelay = 0;
  try { return await appleNotch.withModal(() => verifyAppleIslandContent(options)); }
  finally {
    appleNotch.readNativeScreens = read;
    appleNotch.menuBarGrowDelay = growDelay;
    appleNotch.layoutScreenInfo = measured;
    appleNotch.menuBarContext = context;
    appleNotch.pendingMenuBarContext = pendingContext;
    await appleNotch.refreshMenuBar();
  }
}

async function verifyAppleIslandContent({ appleNotch, target, trayPresentation, artifactRoot, demo, monitor, showResetNotification, layoutFixture }) {
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
  if (layoutFixture) return verifyMenuBarProtection({ appleNotch, target, artifactRoot });
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

async function verifyNotchSurface({ appleNotch, target, artifactRoot }) {
  const original = appleNotch.phase;
  const checks = [];
  let compactRect;
  try {
    for (const phase of ['closed', 'peek', 'expanded']) {
      appleNotch.setPhase(phase);
      await new Promise(resolve => setTimeout(resolve, 550));
      const rect = await target.webContents.executeJavaScript(`(() => {
        const rect = document.querySelector('.apple-shell').getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()`);
      if (phase === 'closed') compactRect = rect;
      if (phase === 'peek' && appleNotch.mode === 'island' &&
          (Math.abs(rect.x - compactRect.x) > 0.5 || Math.abs(rect.width - compactRect.width) > 0.5)) {
        throw new Error('Hover preview changed the compact side margins: ' + JSON.stringify({ compact: compactRect, hover: rect }));
      }
      const image = await target.webContents.capturePage();
      const size = image.getSize(), bitmap = image.toBitmap();
      // capturePage reports physical pixels; DOM geometry is in CSS points.
      const scale = size.width / appleNotch.layout.bounds.width;
      const alpha = (x, y) => bitmap[(Math.floor(y * scale) * size.width + Math.floor(x * scale)) * 4 + 3];
      const cap = appleNotch.layout.capHeight;
      const neckLeft = rect.x + (rect.width - appleNotch.layout.capWidth) / 2;
      const straightSides = Math.abs(rect.width - appleNotch.layout.capWidth) < 0.5;
      // A preview matching the compact width has straight sides and rounded bottom corners.
      const cornerAlpha = alpha(rect.x + (straightSides ? 1 : 0), straightSides ? rect.height - 1 : cap);
      const joinAlpha = alpha(straightSides ? rect.x + 2 : neckLeft, straightSides ? cap / 2 : cap - 2);
      if (straightSides) {
        for (const x of [rect.x + 2, rect.x + rect.width - 3]) {
          const pixel = (Math.floor(cap / 2 * scale) * size.width + Math.floor(x * scale)) * 4;
          if (bitmap[pixel + 3] < 250 || bitmap[pixel] + bitmap[pixel + 1] + bitmap[pixel + 2] > 8) throw new Error('Compact notch has transparent or light side margins');
        }
      }
      fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${phase}-alpha.png`), image.toPNG());
      await target.webContents.executeJavaScript("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${phase}-surface.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height: Math.ceil(rect.height + 16) })).toPNG());
      } finally { await target.webContents.executeJavaScript("document.documentElement.style.removeProperty('background')"); }
      if (cornerAlpha > 8 || joinAlpha < 240) throw new Error('Notch has square shoulders or a disconnected neck: ' + JSON.stringify({ mode: appleNotch.mode, phase, cornerAlpha, joinAlpha, rect, cap, neckLeft, size, bitmapLength: bitmap.length, scale }));
      checks.push({ phase, left: rect.x, right: rect.x + rect.width, width: rect.width,
        ...(straightSides ? { blackSideMargins: true, roundedBottom: true } : { roundedShoulders: true }), connectedNeck: true });
    }
    return checks;
  } finally { appleNotch.setPhase(original); }
}

async function verifyCompactAppearance({ appleNotch, target, artifactRoot }) {
  const { dialog, nativeImage } = require('electron');
  const run = source => target.webContents.executeJavaScript(source);
  const original = await run('window.limits.appearance()');
  const phase = appleNotch.phase;
  const chooser = dialog.showOpenDialog;
  const fixture = path.join(artifactRoot, 'notch-background-smoke.png');
  fs.writeFileSync(fixture, nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 }).toPNG());
  const checks = [];
  try {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fixture] });
    for (const mode of ['color', 'image']) {
      await run(mode === 'image' ? 'window.limits.chooseBackground()' : "window.limits.setAppearance({ mode: 'color', color: '#ffffff' })");
      for (const nextPhase of ['closed', 'peek', 'expanded']) {
        appleNotch.setPhase(nextPhase);
        await new Promise(resolve => setTimeout(resolve, 550));
        const report = await run(`(() => {
          const shell = getComputedStyle(document.querySelector('.apple-shell'));
          const content = getComputedStyle(document.querySelector('.apple-content'));
          return { shellColor: shell.backgroundColor, shellImage: shell.backgroundImage,
            contentColor: content.backgroundColor, contentImage: content.backgroundImage,
            contentVisible: content.opacity === '1' };
        })()`);
        if (report.shellImage !== 'none' || (nextPhase !== 'expanded' && report.shellColor !== 'rgb(0, 0, 0)')) throw new Error('Custom background painted compact notch chrome: ' + JSON.stringify(report));
        if (report.contentVisible !== (nextPhase === 'expanded') || (mode === 'image' ? !report.contentImage.includes('data:image/png') : report.contentColor !== 'rgb(255, 255, 255)')) throw new Error('Expanded notch lost its custom background: ' + JSON.stringify(report));
        checks.push({ mode, phase: nextPhase, blackChrome: nextPhase !== 'expanded', backgroundInDetails: true });
        if (nextPhase === 'closed') fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${mode}-closed.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height: appleNotch.layout.closedHeight + 16 })).toPNG());
        if (nextPhase === 'expanded') {
          await run('window.limitsSettings.open()');
          await new Promise(resolve => setTimeout(resolve, 600));
          const gap = await run("document.getElementById('settings-dialog').getBoundingClientRect().top - parseFloat(getComputedStyle(document.body).getPropertyValue('--cap-height')) - 12");
          if (gap < 12) throw new Error('Custom-background Settings lost its top inset: ' + gap);
          const preview = await run(`(() => {
            const sample = document.getElementById('background-preview-window');
            const style = getComputedStyle(sample);
            const preview = sample.closest('.background-preview');
            const wings = [...preview.querySelectorAll('.background-preview-wing')].map(wing => wing.textContent);
            return { color: style.backgroundColor, image: style.backgroundImage, wings,
              mode: preview.dataset.presentation,
              values: [...sample.querySelectorAll('.background-preview-value')].map(node => node.textContent) };
          })()`);
          if (preview.mode !== appleNotch.mode || preview.values.join(',') !== '67%,23%' ||
              (preview.mode === 'island' && preview.wings.join(',') !== '67%5h,7d28%') ||
              (mode === 'image' ? !preview.image.includes('data:image/png') : preview.color !== 'rgb(255, 255, 255)')) {
            throw new Error('Settings background preview does not match the expanded notch: ' + JSON.stringify(preview));
          }
          fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${mode}-settings.png`), (await target.webContents.capturePage()).toPNG());
          await run('window.limitsSettings.dialog.close()');
        }
      }
    }
    return checks;
  } finally {
    dialog.showOpenDialog = chooser;
    await run(`window.limits.setAppearance(${JSON.stringify({ mode: original.mode, color: original.color })})`);
    appleNotch.setPhase(phase);
  }
}

async function verifyMenuBarProtection({ appleNotch, target, artifactRoot }) {
  const read = appleNotch.readNativeScreens, getState = appleNotch.getState;
  const native = appleNotch.screenInfo, originalPhase = appleNotch.phase;
  const { hitBounds, contains } = require('./geometry.cjs');
  const phases = ['closed', 'peek', 'expanded', 'notification'];
  const wide = { ...native, menuBarLeft: 0, menuBarRight: appleNotch.display.bounds.width };
  const cases = [
    { name: 'wide', metadata: wide, expected: 'full' },
    { name: 'values', metadata: { ...wide, menuBarLeft: native.notchX - 71 }, expected: 'values', side: 'left' },
    { name: 'tight', metadata: { ...wide, menuBarLeft: native.notchX - 36 }, expected: 'values', side: 'left', shrinksFont: true },
    { name: 'crowded-left', metadata: { ...wide, menuBarLeft: native.notchX - 8 }, expected: 'hidden', side: 'left' },
    { name: 'crowded-right', metadata: { ...wide, menuBarRight: native.notchX + native.notchWidth + 8 }, expected: 'hidden', side: 'right' },
    { name: 'unknown-left', metadata: { ...native, menuBarLeft: null, menuBarRight: native.notchX + native.notchWidth + 64 }, expected: 'values', side: 'right' },
    { name: 'unknown', metadata: { ...native, menuBarLeft: null, menuBarRight: null }, expected: 'full' }
  ];
  const checks = [];
  try {
    for (const scenario of cases) {
      appleNotch.getState = scenario.shrinksFont ? () => {
        const state = getState();
        const groups = state.groups.map(group => ({ ...group, metrics: group.metrics.map(metric =>
          metric.type === 'percentage' ? { ...metric, value: 100 } : metric) }));
        return { ...state, groups };
      } : getState;
      appleNotch.layoutScreenInfo = null;
      appleNotch.readNativeScreens = async () => [scenario.metadata];
      await appleNotch.refreshMenuBar();
      let compact;
      for (const phase of phases) {
        appleNotch.setPhase(phase);
        await new Promise(resolve => setTimeout(resolve, 500));
        const layout = appleNotch.snapshot();
        if (layout.indicatorMode !== scenario.expected || layout.peekWidth !== layout.closedWidth || layout.capWidth > layout.menuBarWidth) throw new Error('Menu adaptation lost safe shared width: ' + JSON.stringify({ scenario: scenario.name, layout }));
        const x = scenario.side
          ? appleNotch.display.bounds.x + (scenario.side === 'left' ? scenario.metadata.menuBarLeft + 1 : scenario.metadata.menuBarRight - 1) - layout.bounds.x
          : layout.bounds.width / 2 + layout.capWidth / 2 + 4;
        const image = await target.webContents.capturePage();
        const size = image.getSize(), bitmap = image.toBitmap();
        const scale = size.width / layout.bounds.width;
        for (const y of [1, layout.capHeight / 2, layout.capHeight - 1, layout.capHeight - 0.25]) {
          if (contains(hitBounds(layout, phase), { x: layout.bounds.x + x, y: layout.bounds.y + y }, 6)) throw new Error('Neighbouring menu-bar controls intercept clicks: ' + scenario.name + '/' + phase);
          const pixel = (Math.floor(y * scale) * size.width + Math.floor(x * scale)) * 4;
          if (bitmap[pixel + 3] !== 0) throw new Error('Notch surface covers a neighbouring menu-bar control: ' + JSON.stringify({ scenario: scenario.name, phase, x, y, alpha: bitmap[pixel + 3] }));
        }
        const report = await target.webContents.executeJavaScript(`(() => {
          const shell = document.querySelector('.apple-shell').getBoundingClientRect();
          const header = document.querySelector('.apple-island-meters');
          const preview = document.querySelector('.apple-preview');
          const meters = [...header.querySelectorAll('.apple-island-meter:not([hidden])')].map((el, index) => {
            const label = el.querySelector('.apple-island-label');
            const value = el.querySelector('.apple-island-value');
            const dotRect = el.querySelector('.apple-island-dot').getBoundingClientRect();
            const rect = el.getBoundingClientRect(), labelRect = label.getBoundingClientRect(), valueRect = value.getBoundingClientRect();
            const [first, second] = el.firstElementChild === label ? [labelRect, valueRect] : [valueRect, labelRect];
            return { text: el.textContent, left: rect.left, right: rect.right, labelWidth: labelRect.width,
              labelFont: parseFloat(getComputedStyle(label).fontSize), font: parseFloat(getComputedStyle(value).fontSize),
              outerDot: dotRect.width > 0 && (index === 0 ? dotRect.right <= first.left : dotRect.left >= second.right),
              orderedInline: first.right <= second.left,
              orderedStacked: labelRect.bottom <= valueRect.top && Math.abs(index === 0
                ? labelRect.left - valueRect.left : labelRect.right - valueRect.right) < 0.1 };
          });
          return { left: shell.left, right: shell.right, width: shell.width, bottom: shell.bottom,
            headerHidden: header.hidden, meters,
            previewOverflow: preview.scrollWidth > preview.clientWidth + 1,
            values: ['short','weekly'].map(kind => document.getElementById('apple-' + kind + '-value').textContent) };
        })()`);
        if (report.headerHidden !== (scenario.expected === 'hidden')) throw new Error('Indicators did not adapt to menu space: ' + JSON.stringify(report));
        if (!report.headerHidden) {
          const center = layout.bounds.width / 2;
          const leftEdge = center - layout.capWidth / 2, rightEdge = center + layout.capWidth / 2;
          const notchLeft = center - layout.notchWidth / 2, notchRight = center + layout.notchWidth / 2;
          const [left, right] = report.meters;
          const expectedValues = scenario.shrinksFont ? '100%5h,7d100%' : '72%5h,7d46%';
          const fontLimit = scenario.expected === 'full' ? 12 : 11;
          const inset = scenario.expected === 'full' ? 18 : scenario.shrinksFont ? 4 : 10;
          if (report.meters.map(meter => meter.text).join(',') !== expectedValues ||
            Math.abs(left.left - leftEdge - inset) > 0.5 || left.right > notchLeft ||
            right.left < notchRight || Math.abs(rightEdge - right.right - inset) > 0.5 ||
            report.meters.some(meter => meter.labelWidth === 0 || (scenario.shrinksFont ? !meter.orderedStacked : !meter.orderedInline) ||
              meter.outerDot !== (scenario.expected === 'full') ||
              (scenario.shrinksFont ? meter.font >= fontLimit || meter.labelFont >= 9 : meter.font !== fontLimit))) {
            throw new Error('Quota values did not fit beside the notch: ' + JSON.stringify({ scenario: scenario.name, report }));
          }
        }
        if (phase === 'closed') {
          compact = report;
          const notchHeight = Math.ceil(native.top);
          const below = (Math.ceil(notchHeight * scale) * size.width + Math.floor(size.width / 2)) * 4;
          if (Math.abs(report.bottom - notchHeight) > 0.5 || bitmap[below + 3] !== 0) throw new Error('Collapsed panel extends below the notch: ' + JSON.stringify({ scenario: scenario.name, report }));
        }
        if (phase === 'peek') {
          if (Math.abs(compact.left - report.left) > 0.5 || Math.abs(compact.right - report.right) > 0.5 || report.previewOverflow || report.values.join(',') !== '72%,46%') throw new Error('Hover preview widened, overflowed or lost values: ' + JSON.stringify({ scenario: scenario.name, compact, hover: report }));
          checks.push({ scenario: scenario.name, indicatorMode: layout.indicatorMode, compactWidth: compact.width, hoverWidth: report.width, alignedEdges: true });
        }
        if (phase === 'closed' || phase === 'peek') {
          await target.webContents.executeJavaScript("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
          try { fs.writeFileSync(path.join(artifactRoot, `apple-island-menu-${scenario.name}-${phase}.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: layout.bounds.width, height: (phase === 'closed' ? layout.closedHeight : layout.peekHeight) + 16 })).toPNG()); }
          finally { await target.webContents.executeJavaScript("document.documentElement.style.removeProperty('background')"); }
        }
      }
    }
    return { phases, cases: checks, transparent: true, clickThrough: true, alignedHover: true };
  } finally {
    appleNotch.getState = getState;
    appleNotch.readNativeScreens = read;
    await appleNotch.refreshMenuBar();
    appleNotch.setPhase(originalPhase);
  }
}
async function verifyLiveAppleIsland({ appleNotch, target, artifactRoot }) {
  const run = source => target.webContents.executeJavaScript(source);
  await appleNotch.refreshMenuBar();
  await new Promise(resolve => setTimeout(resolve, 1100));
  await appleNotch.refreshMenuBar();
  const layout = appleNotch.snapshot(), states = [];
  if (layout.menuBarWidth >= layout.notchWidth + 80 && layout.indicatorMode === 'hidden') throw new Error('Real free space incorrectly hid side indicators');
  for (const phase of ['closed', 'peek']) {
    appleNotch.setPhase(phase);
    await new Promise(resolve => setTimeout(resolve, 550));
    const report = await run(`(() => {
      const r = document.querySelector('.apple-shell').getBoundingClientRect();
      const header = document.querySelector('.apple-island-meters');
      return { phase: document.body.dataset.notchPhase, left: r.left, right: r.right, width: r.width,
        visibleValues: header.hidden ? [] : [...header.querySelectorAll('.apple-island-meter:not([hidden]) .apple-island-value')].filter(el => el.getBoundingClientRect().width > 0).map(el => el.textContent) };
    })()`);
    if (layout.indicatorMode !== 'hidden' && report.visibleValues.join(',') !== '72%,46%') throw new Error('Real menu space lost the side quotas: ' + JSON.stringify(report));
    states.push(report);
    await run("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    try { fs.writeFileSync(path.join(artifactRoot, `apple-island-live-${phase}.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: layout.bounds.width, height: (phase === 'closed' ? layout.closedHeight : layout.peekHeight) + 16 })).toPNG()); }
    finally { await run("document.documentElement.style.removeProperty('background')"); }
  }
  if (states[0].left !== states[1].left || states[0].right !== states[1].right) throw new Error('Real hover preview changed side edges');
  const appearance = await verifyCompactAppearance({ appleNotch, target, artifactRoot });
  return { nativeMenuSpace: appleNotch.screenInfo, indicatorMode: layout.indicatorMode, states, appearance, realGeometry: true };
}
module.exports = { verifyMacPanel, verifyAppleNotch, verifyAppleIsland, verifyLiveAppleIsland };
