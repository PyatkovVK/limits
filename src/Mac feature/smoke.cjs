'use strict';
const fs = require('node:fs');
const path = require('node:path');

async function verifyMacPanel({ window, trayPresentation, artifactRoot, demo }) {
  for (const { image } of trayPresentation.entries) {
    const { width, height } = image.getSize();
    if (width !== 64 || height !== 18 || !image.getScaleFactors().includes(2)) throw new Error('Mac menu-bar indicators lack the wide Retina images');
  }
  const originalTheme = await window.webContents.executeJavaScript('document.body.dataset.theme');
  if (demo) await window.webContents.executeJavaScript(`window.limits.get().then(next => render({ ...next, demo: false, profiles: next.profiles.filter(profile => profile.id === next.selectedProfileId) }))`);
  const themes = [];
  try {
    for (const theme of ['light', 'dark']) {
      const report = await window.webContents.executeJavaScript(`(() => {
        document.body.dataset.theme = ${JSON.stringify(theme)};
        const style = getComputedStyle(document.body);
        const bounds = document.body.getBoundingClientRect();
        return { platform: document.body.dataset.platform, radius: style.borderRadius, theme: style.colorScheme, overflow: document.body.scrollWidth > innerWidth, nativeFont: style.fontFamily.includes('-apple-system'), fillsWindow: bounds.top === 0 && bounds.bottom === innerHeight, scrollContained: getComputedStyle(document.querySelector('main')).overflowY === 'auto' };
      })()`);
      if (report.platform !== 'darwin' || report.radius !== '22px' || report.theme !== theme || report.overflow || !report.nativeFont || !report.fillsWindow || !report.scrollContained) throw new Error('Mac glass panel styling failed: ' + JSON.stringify(report));
      if (demo) {
        const image = await window.webContents.capturePage();
        fs.writeFileSync(path.join(artifactRoot, `mac-panel-${theme}.png`), image.toPNG());
      }
      themes.push(report);
    }
  } finally {
    if (demo) await window.webContents.executeJavaScript('window.limits.get().then(render)');
    await window.webContents.executeJavaScript(`document.body.dataset.theme = ${JSON.stringify(originalTheme)}`);
  }
  return { themes, menuBar: { indicators: 2, width: 64, height: 18, retina: true } };
}
module.exports = { verifyMacPanel };
