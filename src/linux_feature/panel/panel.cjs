'use strict';

const { createPanelPosition } = require('../../common/panel/panel-position.cjs');
const { PANEL_WIDTH, PANEL_ZOOM, MAX_HEIGHT, panelBounds, panelEdge } = require('./geometry.cjs');
const { TrayAnchor } = require('./tray-anchor.cjs');

function createPanelController({
  window, screen, root, createPosition = createPanelPosition, trayAnchor = new TrayAnchor(screen)
}) {
  const remembered = createPosition({ window, root, name: 'linux' });
  let contentHeight = MAX_HEIGHT, anchor = null, clickedTray = null, edge = 'bottom';
  window.webContents.setZoomFactor(PANEL_ZOOM);
  window.webContents.once('dom-ready', () => window.webContents.setZoomFactor(PANEL_ZOOM));

  function place(preservePosition = false) {
    if (window.isDestroyed()) return false;
    const current = window.getBounds();
    const visible = window.isVisible();
    let display;
    if (remembered.point) {
      display = screen.getDisplayMatching({ ...remembered.point, width: PANEL_WIDTH, height: contentHeight });
    } else if (preservePosition && visible) {
      display = screen.getDisplayMatching(current);
    } else {
      display = anchor ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
    }
    if (!preservePosition || !visible) edge = panelEdge(display, anchor);
    let bounds = panelBounds({
      area: display.workArea, contentHeight, anchor, edge,
      position: preservePosition && visible ? current : null
    });
    bounds = remembered.bounds(display.workArea, [PANEL_WIDTH, bounds.height]) || bounds;
    remembered.expect(bounds);
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
    if (tray) {
      clickedTray = tray;
      anchor = trayAnchor.read(clickedTray);
    }
    if (!place()) return false;
    window.show();
    window.focus();
    return true;
  }

  function hide() {
    if (window.isDestroyed()) return false;
    window.hide();
    return true;
  }

  function toggle(tray) {
    if (window.isDestroyed()) return false;
    return window.isVisible() ? hide() : show(tray);
  }

  const onDisplayChange = () => {
    trayAnchor.clear();
    const bounds = trayAnchor.bounds(clickedTray);
    if (bounds) anchor = bounds;
    place();
  };
  const dispose = () => {
    remembered.dispose();
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.removeListener(event, onDisplayChange);
  };
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(event, onDisplayChange);
  window.once('closed', dispose);
  return { resize, show, hide, toggle, dispose };
}

module.exports = { createPanelController };
