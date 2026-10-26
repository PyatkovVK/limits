'use strict';
const WIDTHS = [240, 280, 320, 400];
function startupState({ app, platform, env = process.env, demo = false, smoke = false }) {
  if (platform === 'linux') return require('../linux_feature/startup.cjs').startupState({ app, env, demo, smoke });
  const supported = ['win32', 'darwin'].includes(platform);
  return { supported, available: supported && app.isPackaged && !env.PORTABLE_EXECUTABLE_FILE && !demo && !smoke,
    enabled: supported ? Boolean(app.getLoginItemSettings().openAtLogin) : false };
}
function changePreference(key, value, { app, settings, platform, taskbarSupported, env, demo, smoke, resetPosition, save, update, place }) {
  if (key === 'startup' && platform === 'linux') {
    const changed = require('../linux_feature/startup.cjs').setStartup(value, { app, env, demo, smoke });
    if (changed) update();
    return changed;
  }
  if (key === 'linuxTrayStyle' && platform === 'linux') return require('../linux_feature/preferences.cjs').changeTrayStyle(value, { settings, save, update });
  if (key === 'width' && taskbarSupported && WIDTHS.includes(value)) settings.width = value;
  else if (key === 'visible' && taskbarSupported && typeof value === 'boolean') settings.visible = value;
  else if (key === 'resetPosition' && taskbarSupported) { resetPosition(); return true; }
  else if (key === 'startup' && typeof value === 'boolean' && startupState({ app, platform, env, demo, smoke }).available) {
    app.setLoginItemSettings({ openAtLogin: value, args: ['--hidden'] }); update(); return true;
  } else return false;
  save(); place(); update(); return true;
}
module.exports = { WIDTHS, startupState, changePreference };
