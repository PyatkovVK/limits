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
  if (Math.abs(compact - expected - (notch?.snapshot().capHeight || 0)) > 2) throw new Error('Mac panel has empty space below content');
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
    const cap = document.body.classList.contains('apple-notch') ? parseFloat(getComputedStyle(document.body).getPropertyValue('--cap-height')) : 0;
    const bottom = document.body.classList.contains('apple-notch') ? parseFloat(getComputedStyle(document.body).getPropertyValue('--full-height')) : innerHeight;
    return { top: bounds.top, bottom: bounds.bottom, safeTop: cap, safeBottom: bottom,
      closeWidth: close.width, closeHeight: close.height, contained: close.top >= bounds.top && close.right <= bounds.right && close.bottom <= bounds.bottom };
  })()`);
  if (modal.top < modal.safeTop || modal.bottom > modal.safeBottom + 1) throw new Error('Mac Settings overlaps the notch or leaves its panel: ' + JSON.stringify(modal));
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
async function verifyAppleNotch({ appleNotch, window, trayPresentation, setDisplayMode, artifactRoot, demo, monitor }) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  if (!appleNotch.available) {
    const state = await window.webContents.executeJavaScript('window.limits.get()');
    if (state.displayModes.includes('notch') || setDisplayMode('notch').displayMode !== 'tray' || appleNotch.window) throw new Error('Notch mode exposed on a Mac without a notch');
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
  const contentSizing = await verifyContentSizing(target, appleNotch);
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
  await target.webContents.executeJavaScript(`window.limits.displayMode('tray')`);
  if (appleNotch.enabled || target.isVisible() || trayPresentation.entries.length !== 2) throw new Error('Tray mode was not restored');
  await delay(100);
  return { ...report, contentSizing, physical: layout.physical, displayId: layout.displayId, bounds: layout.bounds, hover: true, click: true, escape: true, accountSwitch: demo, reducedMotion: true, modeRestored: true };
}
module.exports = { verifyMacPanel, verifyAppleNotch };
