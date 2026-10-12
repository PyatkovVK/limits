'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function verifyTrayStyles({ window, trayPresentation, artifactRoot, settingsPath }) {
  const originalStyle = await window.webContents.executeJavaScript('window.limits.get().then(state => state.preferences.linuxTrayStyle)');
  const originalTrays = trayPresentation.entries.map(entry => entry.tray);
  const screenshots = [];
  try {
    let previousImages;
    for (const style of ['bar', 'classic']) {
      const selected = await window.webContents.executeJavaScript(`(async () => {
        window.limitsSettings.open();
        const select = document.getElementById('settings-tray-style');
        if (!select || select.options.length !== 2) throw new Error('Linux tray style control is missing');
        select.value = ${JSON.stringify(style)};
        await select.onchange();
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
        if (previousImages && image.equals(previousImages[index])) throw new Error('Linux styles produced identical icons');
        return image;
      });
      previousImages = images;
      const filename = `linux-settings-${style}.png`;
      fs.writeFileSync(path.join(artifactRoot, filename), (await window.webContents.capturePage()).toPNG());
      screenshots.push(filename);
    }
    const invalid = await window.webContents.executeJavaScript("window.limits.preference('linuxTrayStyle', 'invalid')");
    if (!invalid.preferenceError || invalid.preferences.linuxTrayStyle !== 'classic') throw new Error('Invalid Linux tray style was accepted');
    return { styles: ['bar', 'classic'], saved: true, retainedTrayIcons: true, screenshots };
  } finally {
    await window.webContents.executeJavaScript(`window.limits.preference('linuxTrayStyle', ${JSON.stringify(originalStyle)}).then(() => window.limitsSettings.dialog.close())`);
    await delay(350);
  }
}
module.exports = { verifyTrayStyles };
