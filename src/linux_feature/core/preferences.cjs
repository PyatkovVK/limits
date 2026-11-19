'use strict';

const { available, normalize: trayStyle } = require('../settings/general/styles.js');

function changeTrayStyle(value, { settings, save, update }, xfce = false) {
  if (!available(xfce).includes(value)) return false;
  settings.linuxTrayStyle = value;
  save();
  update();
  return true;
}

module.exports = { trayStyle, changeTrayStyle };
