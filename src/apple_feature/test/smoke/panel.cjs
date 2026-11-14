'use strict';
const fs = require('node:fs');
const path = require('node:path');

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
    await verifyCompactMacPanel(window);
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

async function verifyContentSizing(window, notch = null) {
  const delay = () => new Promise(resolve => setTimeout(resolve, 600));
  async function height() {
    await window.webContents.executeJavaScript('window.limitsViewPanelReady.then(() => window.limitsViewPanel.report())');
    await delay();
    return notch ? notch.snapshot().fullHeight : window.getBounds().height;
  }
  const compact = await height();
  const expected = await window.webContents.executeJavaScript('window.limitsViewPanel.measure()');
  if (Math.abs(compact - expected - (notch?.snapshot().contentTop || 0)) > 2) throw new Error('Mac panel has empty space below content');
  await window.webContents.executeJavaScript(`(() => {
    const notice = document.createElement('div'); notice.id = 'sizing-smoke'; notice.className = 'notice';
    notice.textContent = 'A longer connection message that wraps onto several lines. '.repeat(8);
    document.querySelector('.panel-content').append(notice);
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
    document.querySelector('.panel-content').append(overflow);
  })()`);
  const capped = await height();
  const scrolls = await window.webContents.executeJavaScript("document.querySelector('main').scrollHeight > document.querySelector('main').clientHeight");
  if (!scrolls || (notch && capped !== notch.snapshot().maxFullHeight)) throw new Error('Mac panel does not scroll when content exceeds available height');
  await window.webContents.executeJavaScript("document.getElementById('sizing-smoke').remove()");
  if (await height() !== compact) throw new Error('Mac panel remained large after overflowing content was removed');
  return { compact, expanded, settings, capped, modal, shrinks: true, scrolls };
}

async function verifyCompactMacPanel(target) {
  const report = await target.webContents.executeJavaScript(`(() => {
    const short = document.querySelector('.panel-quotas .short').getBoundingClientRect();
    const weekly = document.querySelector('.panel-quotas .weekly').getBoundingClientRect();
    const titlebar = document.querySelector('.titlebar').getBoundingClientRect();
    const island = document.body.classList.contains('apple-island');
    const buttonSize = island ? 30 : 32;
    const iconSize = island ? '18px' : '20px';
    const iconInsets = island ? [56, 26] : [65, 29];
    return {
      quotas: short.width > 0 && weekly.width > 0 && short.top === weekly.top && short.right <= weekly.left,
      footer: Boolean(document.querySelector('footer #account')) && Boolean(document.querySelector('footer #refresh')),
      loginHidden: !document.getElementById('login').getClientRects().length,
      icons: titlebar.height === (island ? 38 : 40) && ['settings-button', 'hide'].every((id, index) => {
        const button = document.getElementById(id);
        const bounds = button.getBoundingClientRect();
        const icon = getComputedStyle(button, '::after');
        const rightInset = titlebar.right - bounds.left - bounds.width / 2;
        return bounds.width === buttonSize && bounds.height === buttonSize && icon.width === iconSize && icon.maskImage !== 'none' &&
          Math.abs(rightInset - iconInsets[index]) < 0.5;
      }),
    };
  })()`);
  if (Object.values(report).some(value => !value)) throw new Error('Compact subscription preview failed: ' + JSON.stringify(report));
}

module.exports = { verifyMacPanel, verifyContentSizing, verifyCompactMacPanel };
