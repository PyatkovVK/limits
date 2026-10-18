'use strict';

const PANEL_WIDTH = 528;
const PANEL_ZOOM = 1.2;
const MIN_HEIGHT = 480;
const MAX_HEIGHT = 720;
const margin = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validAnchor = bounds => bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) && bounds.width > 0 && bounds.height > 0;

function panelEdge(display, anchor) {
  const area = display.workArea, bounds = display.bounds || area;
  if (anchor) return anchor.y + anchor.height / 2 < bounds.y + bounds.height / 2 ? 'top' : 'bottom';
  // Opening without a click (for example at startup) follows the reserved panel.
  const top = area.y - bounds.y;
  const bottom = bounds.y + bounds.height - area.y - area.height;
  return top > bottom ? 'top' : 'bottom';
}

function panelBounds({ area, contentHeight, width = PANEL_WIDTH, anchor, edge = 'bottom', position }) {
  const panelWidth = Math.min(width, Math.max(1, area.width - margin * 2));
  const height = Math.min(Math.max(MIN_HEIGHT, Math.ceil(contentHeight)), MAX_HEIGHT, Math.max(1, area.height - margin * 2));
  const x = position ? position.x : anchor ? anchor.x + anchor.width / 2 - panelWidth / 2 : area.x + area.width - panelWidth - 16;
  const y = position ? (edge === 'top' ? position.y : position.y + position.height - height) : edge === 'top'
    ? Math.max(area.y, anchor ? anchor.y + anchor.height : area.y) + margin
    : Math.min(area.y + area.height, anchor ? anchor.y : area.y + area.height) - margin - height;
  return {
    x: Math.round(clamp(x, area.x + margin, area.x + area.width - panelWidth - margin)),
    y: Math.round(clamp(y, area.y + margin, area.y + area.height - height - margin)),
    width: panelWidth, height
  };
}

function createPanelController({ window, screen }) {
  let contentHeight = MAX_HEIGHT, anchor = null, clickedTray = null, edge = 'bottom';
  window.webContents.setZoomFactor(PANEL_ZOOM);
  window.webContents.once('dom-ready', () => window.webContents.setZoomFactor(PANEL_ZOOM));

  function readAnchor(tray) {
    if (!tray) return null;
    try {
      const bounds = tray.getBounds?.();
      if (validAnchor(bounds)) return bounds;
    } catch { /* Linux tray hosts may not expose icon geometry. */ }
    try {
      // Linux StatusNotifierItem hosts commonly return an empty tray rectangle.
      // Capture the cursor during activation, never later during content resizing.
      const point = screen.getCursorScreenPoint();
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      const display = screen.getDisplayNearestPoint(point);
      const bounds = display.bounds || display.workArea;
      if (Math.min(Math.abs(point.y - bounds.y), Math.abs(point.y - bounds.y - bounds.height)) > 64) return null;
      return { ...point, width: 1, height: 1 };
    } catch { return null; /* Cursor coordinates are unavailable on Wayland. */ }
  }
  function place(preservePosition = false) {
    if (window.isDestroyed()) return false;
    const current = window.getBounds();
    const visible = window.isVisible();
    const display = preservePosition && visible ? screen.getDisplayMatching(current)
      : anchor ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
    if (!preservePosition || !visible) edge = panelEdge(display, anchor);
    const bounds = panelBounds({ area: display.workArea, contentHeight, anchor, edge,
      position: preservePosition && visible ? current : null });
    if (['x', 'y', 'width', 'height'].some(key => current[key] !== bounds[key])) window.setBounds(bounds, false);
    return true;
  }
  function resize(height) {
    if (!Number.isFinite(height) || height <= 0) return false;
    // The renderer measures CSS pixels; BrowserWindow uses device-independent pixels.
    contentHeight = height * PANEL_ZOOM;
    return place(true);
  }
  function show(tray) {
    clickedTray = tray || null;
    anchor = readAnchor(clickedTray);
    if (!place()) return false;
    window.show(); window.focus();
    return true;
  }
  const onDisplayChange = () => {
    try {
      const bounds = clickedTray?.getBounds?.();
      if (validAnchor(bounds)) anchor = bounds;
    } catch { /* Retain the activation position if the tray host has no bounds. */ }
    place();
  };
  const dispose = () => {
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.removeListener(event, onDisplayChange);
  };
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(event, onDisplayChange);
  window.once('closed', dispose);
  return { resize, show, dispose };
}

module.exports = { panelBounds, panelEdge, createPanelController };
