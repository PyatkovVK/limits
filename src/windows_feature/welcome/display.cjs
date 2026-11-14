'use strict';
const path = require('node:path');

function placement({ screen, widget, taskbar, getTrayBounds }) {
  const anchor = widget || getTrayBounds()[0] || taskbar;
  const display = anchor ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const vertical = !widget && taskbar && taskbar.height > taskbar.width && screen.getDisplayMatching(taskbar).id === display.id;
  let edge = 'bottom';
  if (vertical) edge = taskbar.x + taskbar.width / 2 < bounds.x + bounds.width / 2 ? 'left' : 'right';
  else if (anchor && anchor.y + anchor.height / 2 < bounds.y + bounds.height / 2) edge = 'top';
  return { anchor, display, edge };
}

module.exports = {
  placement,
  description: {
    ru: 'На Windows лимиты видны в виджете на панели задач или в трее. Нажмите на индикатор, чтобы открыть подробности.',
    en: 'On Windows, check your limits in the taskbar widget or system tray. Click an indicator to see details.',
  },
  variants: [
    { label: { ru: 'Классический', en: 'Classic' }, image: path.join(__dirname, 'images/classic.png'), size: 'strip' },
    { label: { ru: 'Строки', en: 'Rows' }, image: path.join(__dirname, 'images/rows.png'), size: 'strip' },
    { label: { ru: 'Ячейки', en: 'Cells' }, image: path.join(__dirname, 'images/cells.png'), size: 'strip' },
    { label: { ru: 'Трей', en: 'System tray' }, image: path.join(__dirname, 'images/tray.png'), size: 'icons' },
  ],
};
