'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { verifyPanel } = require('./panel.cjs');

async function verifyTrayStyles({ window, trayPresentation, artifactRoot, settingsPath }) {
  const panel = await verifyPanel({ window, trayPresentation, artifactRoot });
  const originalStyle = await window.webContents.executeJavaScript('window.limits.get().then(state => state.preferences.linuxTrayStyle)');
  const xfce = await window.webContents.executeJavaScript('window.limits.get().then(state => state.preferences.xfcePanelAvailable)');
  const trayStyles = ['classic', 'digits', 'rings'];
  const styles = xfce ? [...trayStyles, 'line', 'shelf'] : trayStyles;
  const genmon = path.join(path.dirname(settingsPath), 'xfce-panel.xml');
  const originalTrays = trayPresentation.entries.map(entry => entry.tray);
  const screenshots = [];
  try {
    let previousImages;
    for (const style of styles) {
      const selected = await window.webContents.executeJavaScript(`(async () => {
        window.limitsSettings.open();
        const select = document.getElementById('display-mode');
        const expectedModes = ${JSON.stringify(styles)};
        if (!select || [...select.options].map(option => option.value).join() !== expectedModes.join()) throw new Error('Linux tray style control has unexpected modes');
        select.value = ${JSON.stringify(style)};
        await window.limits.displayMode(select.value);
        const state = await window.limits.get();
        return { selected: select.value, saved: state.preferences.linuxTrayStyle, error: state.preferenceError };
      })()`);
      if (selected.selected !== style || selected.saved !== style || selected.error) throw new Error('Linux tray style did not apply');
      await delay(350);
      if (JSON.parse(fs.readFileSync(settingsPath, 'utf8')).linuxTrayStyle !== style) throw new Error('Linux tray style was not persisted');
      const images = trayPresentation.entries.map((entry, index) => {
        if (entry.tray !== originalTrays[index]) throw new Error('Linux tray style recreated a tray icon');
        const image = entry.image.toPNG();
        fs.writeFileSync(path.join(artifactRoot, `linux-tray-${style}-${entry.kind}.png`), image);
        if (trayStyles.includes(style) && previousImages && image.equals(previousImages[index])) throw new Error('Linux styles produced identical icons');
        return image;
      });
      previousImages = images;
      if (!trayStyles.includes(style)) {
        const output = fs.readFileSync(genmon, 'utf8');
        if (!output.includes('72%') || !output.includes('46%') || !output.includes('--linux-panel-activate')) {
          throw new Error('Genmon did not receive the selected quota and click action');
        }
        if (output.includes('font_family="monospace"') !== (style === 'shelf')) throw new Error('Genmon styles produced the same layout');
      }
      const filename = `linux-settings-${style}.png`;
      fs.writeFileSync(path.join(artifactRoot, filename), (await window.webContents.capturePage()).toPNG());
      screenshots.push(filename);
    }
    const invalid = await window.webContents.executeJavaScript("window.limits.preference('linuxTrayStyle', 'invalid')");
    if (!invalid.preferenceError || invalid.preferences.linuxTrayStyle !== styles.at(-1)) throw new Error('Invalid Linux tray style was accepted');
    return { panel, styles, saved: true, retainedTrayIcons: true, screenshots };
  } finally {
    await window.webContents.executeJavaScript(`window.limits.preference('linuxTrayStyle', ${JSON.stringify(originalStyle)}).then(() => window.limitsSettings.dialog.close())`);
    await delay(350);
  }
}
module.exports = { verifyTrayStyles };
