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
  const notchHeight = Math.ceil(info.top);
  // The visible menu bar can extend one point below the camera's safe-area inset.
  const capHeight = Math.max(notchHeight, display.workArea.y - display.bounds.y);
  const fullHeight = Math.min(630, display.workArea.y + display.workArea.height - display.bounds.y - 16);
  const center = physical ? display.bounds.x + info.notchX + info.notchWidth / 2 : display.bounds.x + display.bounds.width / 2;
  const localCenter = info.notchX + info.notchWidth / 2;
  // Only confirmed boundaries restrict a wing. Unknown is not the same as occupied.
  const left = Number.isFinite(info.menuBarLeft) ? info.menuBarLeft : 0;
  const right = Number.isFinite(info.menuBarRight) ? info.menuBarRight : display.bounds.width;
  const clearance = 2 * Math.min(localCenter - left, right - localCenter) - 16;
  const x = Math.max(display.bounds.x + 4, Math.min(center - fullWidth / 2 - 12, display.bounds.x + display.bounds.width - fullWidth - 28));
  const layout = {
    physical, displayId: display.id, notchHeight, capHeight, fullWidth, fullHeight, maxFullHeight: fullHeight,
    notchWidth: Math.round(info.notchWidth),
    menuBarWidth: Math.max(Math.round(info.notchWidth), Math.floor(clearance)),
    notificationWidth: fullWidth,
    bounds: { x: Math.round(x), y: display.bounds.y, width: fullWidth + 24, height: fullHeight + 24 }
  };
  fitMenuBar(layout, mode);
  return layout;
}

function fitMenuBar(layout, mode, metricCount = 2, hoverStyle = 'minimal') {
  const island = mode === 'island';
  const preferredWidth = Math.min(layout.fullWidth, island && metricCount > 2 ? layout.fullWidth : layout.notchWidth + (island ? 192 : 24));
  const availableWidth = Math.min(preferredWidth, layout.menuBarWidth);
  // Each compact wing needs room for 100% at about 8px plus its outer inset.
  layout.indicatorMode = !island || availableWidth >= preferredWidth ? 'full'
    : availableWidth >= layout.notchWidth + 56 ? 'values' : 'hidden';
  layout.closedWidth = !island ? preferredWidth : layout.indicatorMode === 'hidden' ? Math.min(layout.fullWidth, layout.notchWidth) : availableWidth;
  layout.capWidth = layout.closedWidth;
  layout.metersWidth = Math.min(layout.fullWidth, layout.capWidth);
  layout.metersTop = 0;
  layout.metersHeight = layout.notchHeight;
  // Leave a full inset after the curved shoulder before details and Settings.
  layout.contentTop = layout.capHeight + 12;
  layout.closedHeight = island ? layout.notchHeight : layout.capHeight + 9;
  layout.peekWidth = layout.closedWidth;
  layout.hoverStyle = hoverStyle;
  const informative = hoverStyle === 'informative';
  layout.peekFallback = island && layout.indicatorMode === 'hidden';
  layout.peekShowsValues = !island && informative;
  layout.peekHeight = layout.peekFallback ? layout.contentTop + 116
    : layout.capHeight + 19 + (layout.peekShowsValues ? 17 : 0) + (informative ? 18 : 0);
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
    return point.y >= bounds.y && point.y < bounds.y + bounds.height &&
      point.x >= bounds.x + inset && point.x <= bounds.x + bounds.width - inset;
  }
  return point.x >= bounds.x - margin && point.x <= bounds.x + bounds.width + margin && point.y >= bounds.y && point.y <= bounds.y + bounds.height + margin;
}
module.exports = { chooseDisplay, notchLayout, fitMenuBar, hitBounds, contains };
