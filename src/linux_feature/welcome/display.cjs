'use strict';
const path = require('node:path');
const { panelEdge } = require('../panel/geometry.cjs');

function placement({ screen, getTrayBounds }) {
  const [anchor] = getTrayBounds();
  const display = anchor ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
  return { anchor, display, edge: panelEdge(display, anchor) };
}

module.exports = {
  placement,
  description: {
    ru: 'Выберите стиль значков в настройках. Нажмите на значок в трее, чтобы открыть подробности.',
    en: 'Choose a tray icon style in Settings. Click a tray indicator to see details.',
  },
  variants: [
    { label: { ru: 'Классические', en: 'Classic' }, image: path.join(__dirname, 'images/icons.png'), size: 'icons' },
  ],
};
