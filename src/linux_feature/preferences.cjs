'use strict';
const TRAY_STYLES = ['bar', 'classic'];
function trayStyle(value) { return TRAY_STYLES.includes(value) ? value : 'classic'; }
function changeTrayStyle(value, { settings, save, update }) {
  if (!TRAY_STYLES.includes(value)) return false;
  settings.linuxTrayStyle = value;
  save(); update();
  return true;
}
module.exports = { TRAY_STYLES, trayStyle, changeTrayStyle };
