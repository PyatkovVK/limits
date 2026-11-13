'use strict';
const WIDTHS = [240, 280, 320, 400];
function startupState({ app, platform, env = process.env, demo = false, smoke = false, platformApi = {} }) {
  if (platform === 'linux' && platformApi.linuxStartup?.startupState) return platformApi.linuxStartup.startupState({ app, env, demo, smoke });
  const supported = ['win32', 'darwin'].includes(platform);
  const available = supported && app.isPackaged && !env.PORTABLE_EXECUTABLE_FILE && !demo && !smoke;
  const enabled = platform === 'darwin' && available && platformApi.appleStartup?.enabled ? platformApi.appleStartup.enabled(app) : supported && Boolean(app.getLoginItemSettings().openAtLogin);
  return { supported, available, enabled };
}
function changePreference(key, value, { app, settings, platform, taskbarSupported, env, demo, smoke, resetPosition, save, update, place, platformApi = {} }) {
  if (key === 'startup' && platform === 'linux' && platformApi.linuxStartup?.setStartup) {
    const changed = platformApi.linuxStartup.setStartup(value, { app, env, demo, smoke });
    if (changed) update();
    return changed;
  }
  if (key === 'linuxTrayStyle' && platform === 'linux' && platformApi.changeTrayStyle) return platformApi.changeTrayStyle(value, { settings, save, update });
  if (key === 'widgetStyle' && platform === 'win32') {
    if (!taskbarSupported || !platformApi.widgetStyles?.includes(value)) return false;
    settings.widgetStyle = value;
    save(); update(); return true;
  }
  if (key === 'islandHoverStyle' && platform === 'darwin' && platformApi.presentation) {
    const { isNotchMode, islandHoverStyles } = platformApi.presentation;
    if (!isNotchMode(settings.displayMode) || !islandHoverStyles.includes(value)) return false;
    settings.islandHoverStyle = value;
    save(); update(); return true;
  }
  if (key === 'widgetResetDisplay' && platform === 'win32' && ['hidden', 'countdown', 'clock'].includes(value)) settings.widgetResetDisplay = value;
  else if (key === 'width' && taskbarSupported && WIDTHS.includes(value)) settings.width = value;
  else if (key === 'visible' && taskbarSupported && typeof value === 'boolean') settings.visible = value;
  else if (key === 'resetPosition' && taskbarSupported) { resetPosition(); return true; }
  else if (key === 'startup' && typeof value === 'boolean' && startupState({ app, platform, env, demo, smoke, platformApi }).available) {
    if (platform === 'darwin' && platformApi.appleStartup?.setEnabled) platformApi.appleStartup.setEnabled(app, value);
    else app.setLoginItemSettings({ openAtLogin: value, args: ['--hidden'] });
    update(); return true;
  } else return false;
  save(); place(); update(); return true;
}
module.exports = { WIDTHS, startupState, changePreference };
