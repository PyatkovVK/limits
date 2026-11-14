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
    ru: 'На Linux можно выбрать значки с процентами или полоски 5ч и 7д. Нажмите на значок в трее, чтобы открыть подробности.',
    en: 'On Linux, choose percentage icons or 5h and 7d bars. Click a tray indicator to see details.',
  },
  variants: [
    { label: { ru: 'Значки в трее', en: 'Tray icons' }, image: path.join(__dirname, 'images/icons.png'), size: 'icons' },
    { label: { ru: 'Полоски в трее', en: 'Tray bars' }, image: path.join(__dirname, 'images/bars.png'), size: 'icons' },
  ],
};
