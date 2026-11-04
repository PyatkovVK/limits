'use strict';

function chooseDisplay(displays, screens, primary) {
  const notched = displays.filter(display => screens.some(info => info.id === display.id && info.top > 0 && info.notchWidth > 0));
  return notched.find(display => display.id === primary.id) || notched[0] || null;
}

function notchLayout(display, info = {}, mode = 'notch') {
  const physical = info.top > 0 && info.notchWidth > 0;
  if (!display || !physical) return null;
  const island = mode === 'island';
  const fullWidth = Math.min(island ? Math.max(500, info.notchWidth + 208) : 460, display.bounds.width - 32);
  const capHeight = physical ? Math.round(info.top) : 10;
  const fullHeight = Math.min(630, display.workArea.y + display.workArea.height - display.bounds.y - 16);
  const center = physical ? display.bounds.x + info.notchX + info.notchWidth / 2 : display.bounds.x + display.bounds.width / 2;
  const localCenter = info.notchX + info.notchWidth / 2;
  // Keep curved joins away from adjacent menus. Missing/partial metadata is occupied.
  const clearance = Number.isFinite(info.menuBarLeft) && Number.isFinite(info.menuBarRight)
    ? 2 * Math.min(localCenter - info.menuBarLeft, info.menuBarRight - localCenter) - 24 : 0;
  const x = Math.max(display.bounds.x + 4, Math.min(center - fullWidth / 2 - 12, display.bounds.x + display.bounds.width - fullWidth - 28));
  const layout = {
    physical, displayId: display.id, capHeight, fullWidth, fullHeight, maxFullHeight: fullHeight,
    notchWidth: Math.round(info.notchWidth),
    menuBarWidth: Math.max(Math.round(info.notchWidth), Math.floor(clearance)),
    notificationWidth: fullWidth,
    bounds: { x: Math.round(x), y: display.bounds.y, width: fullWidth + 24, height: fullHeight + 24 }
  };
  fitMenuBar(layout, mode);
  return layout;
}

function fitMenuBar(layout, mode, metricCount = 2) {
  const island = mode === 'island';
  layout.closedWidth = Math.min(layout.fullWidth, island && metricCount > 2 ? layout.fullWidth : layout.notchWidth + (island ? 192 : 24));
  // Keep the neck attached to the physical notch and its compact indicators.
  // Foreground menu changes must not widen it into a rectangular top block.
  layout.capWidth = layout.closedWidth;
  layout.metersWidth = Math.min(layout.fullWidth, layout.capWidth);
  layout.metersTop = 0;
  layout.metersHeight = layout.capHeight + 4;
  layout.contentTop = layout.capHeight;
  layout.closedHeight = layout.capHeight + (island ? 4 : 9);
  layout.peekWidth = Math.min(layout.fullWidth, Math.max(340, layout.closedWidth + 40));
  layout.peekHeight = layout.contentTop + 116;
  layout.notificationHeight = Math.min(layout.maxFullHeight, layout.closedHeight + 164);
}

function hitBounds(layout, phase) {
  const width = phase === 'notification' ? layout.notificationWidth : phase === 'expanded' ? layout.fullWidth : phase === 'peek' ? layout.peekWidth : layout.closedWidth;
  const height = phase === 'notification' ? layout.notificationHeight : phase === 'expanded' ? layout.fullHeight : phase === 'peek' ? layout.peekHeight : layout.closedHeight;
  return { x: layout.bounds.x + (layout.bounds.width - width) / 2, y: layout.bounds.y, width, height,
    capHeight: layout.capHeight, menuBarWidth: Math.min(width, layout.capWidth) };
}
function contains(bounds, point, margin = 0) {
  if (point.y < bounds.y + (bounds.capHeight || 0)) {
    // Hover slop must never extend into neighbouring menu-bar controls.
    const inset = (bounds.width - bounds.menuBarWidth) / 2;
    return point.y >= bounds.y && point.x >= bounds.x + inset && point.x <= bounds.x + bounds.width - inset;
  }
  return point.x >= bounds.x - margin && point.x <= bounds.x + bounds.width + margin && point.y >= bounds.y && point.y <= bounds.y + bounds.height + margin;
}
module.exports = { chooseDisplay, notchLayout, fitMenuBar, hitBounds, contains };
