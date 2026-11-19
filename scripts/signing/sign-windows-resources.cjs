'use strict';
const path = require('node:path');
// electron-builder signs app.asar.unpacked, but our extraResources are outside it.
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  for (const relative of ['taskbar-helper.exe', 'codex/codex.exe']) {
    const file = path.join(context.appOutDir, 'resources', relative);
    if (!await context.packager.signIf(file)) throw new Error(`Could not sign bundled executable: ${relative}`);
  }
};
