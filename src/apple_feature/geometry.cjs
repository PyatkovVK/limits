'use strict';

function chooseDisplay(displays, screens, primary) {
  const notched = displays.filter(display => screens.some(info => info.id === display.id && info.top > 0 && info.notchWidth > 0));
  return notched.find(display => display.id === primary.id) || notched[0] || null;
}

function notchLayout(display, info = {}) {
  const physical = info.top > 0 && info.notchWidth > 0;
  if (!display || !physical) return null;
  const fullWidth = Math.min(460, display.bounds.width - 32);
  const capHeight = physical ? Math.round(info.top) : 10;
  const fullHeight = Math.min(630, display.workArea.y + display.workArea.height - display.bounds.y - 16);
  const closedWidth = Math.min(fullWidth, physical ? Math.round(info.notchWidth + 24) : 148);
  const center = physical ? display.bounds.x + info.notchX + info.notchWidth / 2 : display.bounds.x + display.bounds.width / 2;
  const x = Math.max(display.bounds.x + 4, Math.min(center - fullWidth / 2 - 12, display.bounds.x + display.bounds.width - fullWidth - 28));
  return {
    physical, displayId: display.id, capHeight, fullWidth, fullHeight, maxFullHeight: fullHeight,
    closedWidth, closedHeight: physical ? capHeight + 9 : 30,
    peekWidth: Math.min(fullWidth, Math.max(340, closedWidth + 40)), peekHeight: capHeight + 116,
    bounds: { x: Math.round(x), y: display.bounds.y, width: fullWidth + 24, height: fullHeight + 24 }
  };
}

function hitBounds(layout, phase) {
  const width = phase === 'expanded' ? layout.fullWidth : phase === 'peek' ? layout.peekWidth : layout.closedWidth;
  const height = phase === 'expanded' ? layout.fullHeight : phase === 'peek' ? layout.peekHeight : layout.closedHeight;
  return { x: layout.bounds.x + (layout.bounds.width - width) / 2, y: layout.bounds.y, width, height };
}
function contains(bounds, point, margin = 0) {
  return point.x >= bounds.x - margin && point.x <= bounds.x + bounds.width + margin && point.y >= bounds.y && point.y <= bounds.y + bounds.height + margin;
}
module.exports = { chooseDisplay, notchLayout, hitBounds, contains };
