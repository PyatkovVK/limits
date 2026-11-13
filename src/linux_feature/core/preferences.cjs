'use strict';

const { styles: TRAY_STYLES, normalize: trayStyle } = require('../settings/general/styles.js');

function changeTrayStyle(value, { settings, save, update }) {
  if (!TRAY_STYLES.includes(value)) return false;
  settings.linuxTrayStyle = value;
  save();
  update();
  return true;
}

module.exports = { TRAY_STYLES, trayStyle, changeTrayStyle };
