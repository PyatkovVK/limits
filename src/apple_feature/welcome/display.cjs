'use strict';
const path = require('node:path');
const { isMenuBarAnchor } = require('../panel/panel.cjs');

async function placement({ screen, getNotchAnchor, getTrayBounds }) {
  const notch = getNotchAnchor();
  if (notch) return { anchor: notch, display: screen.getDisplayMatching(notch), edge: 'top' };
  // AppKit may briefly report a status item at the bottom of the screen.
  for (let attempt = 0; attempt < 25; attempt++) {
    for (const bounds of getTrayBounds()) {
      const display = screen.getDisplayMatching(bounds);
      if (isMenuBarAnchor(bounds, display)) return { anchor: bounds, display, edge: 'top' };
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return { display: screen.getPrimaryDisplay(), edge: 'top' };
}

module.exports = {
  placement,
  description: {
    ru: 'На macOS лимиты видны в строке меню. На MacBook с физической чёлкой доступны ещё два режима.',
    en: 'On macOS, check your limits in the menu bar. MacBooks with a physical notch have two more modes.',
  },
  variants: [
    { label: { ru: 'Строка меню', en: 'Menu bar' }, image: path.join(__dirname, 'images/menu.png'), size: 'strip' },
    { label: { ru: 'Чёлка', en: 'Notch' }, image: path.join(__dirname, 'images/notch.png'), size: 'panel' },
    { label: { ru: 'Вокруг чёлки', en: 'Around the notch' }, image: path.join(__dirname, 'images/around-notch.png'), size: 'strip' },
  ],
};
