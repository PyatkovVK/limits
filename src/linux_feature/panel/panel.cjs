'use strict';

const { createPanelPosition } = require('../../common/panel/panel-position.cjs');
const { PANEL_WIDTH, PANEL_ZOOM, MAX_HEIGHT, panelBounds, panelEdge } = require('./geometry.cjs');
const { TrayAnchor } = require('./tray-anchor.cjs');
const { preparePanel, paintPanel, revealPanel } = require('./presentation.cjs');

function createPanelController({
  window, screen, root, createPosition = createPanelPosition, trayAnchor = new TrayAnchor(screen), waitForPaint = paintPanel
}) {
  const remembered = createPosition({ window, root, name: 'linux' });
  let contentHeight = MAX_HEIGHT, anchor = null, clickedTray = null, edge = 'bottom';
  let generation = 0, opening = false, disposed = false;
  // Keep hidden layout measurements and the first transparent frame current.
  window.webContents.setBackgroundThrottling(false);
  window.webContents.setZoomFactor(PANEL_ZOOM);
  window.webContents.once('dom-ready', () => window.webContents.setZoomFactor(PANEL_ZOOM));

  function place(preservePosition = false) {
    if (disposed || window.isDestroyed()) return false;
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

  async function show(tray) {
    if (disposed || window.isDestroyed()) return false;
    if (tray) {
      clickedTray = tray;
      anchor = trayAnchor.read(clickedTray);
    }
    if (!place()) return false;
    if (window.isVisible()) { window.focus(); return true; }
    const request = ++generation;
    opening = true;
    try {
      let previousHeight;
      // A width/zoom change can wrap text differently. Settle that layout
      // while hidden so the first visible frame already has its full height.
      for (let attempt = 0; attempt < 3; attempt++) {
        const height = await preparePanel(window.webContents);
        if (request !== generation || disposed || window.isDestroyed()) return false;
        if (!Number.isFinite(height) || height <= 0) break;
        resize(height);
        if (height === previousHeight) break;
        previousHeight = height;
      }
      // Commit the resized, transparent surface before mapping the native window.
      // Otherwise its last cached frame can flash before the reveal is painted.
      await waitForPaint(window.webContents);
      if (request !== generation || disposed || window.isDestroyed()) return false;
      window.show();
      window.focus();
      // Let the window manager finish mapping and constraining the window
      // while its surface is still transparent, before starting the fade.
      await waitForPaint(window.webContents);
      if (request !== generation || disposed || window.isDestroyed()) return false;
      remembered.expect(window.getBounds());
      await revealPanel(window.webContents);
      return request === generation;
    } catch (error) {
      if (request === generation && !disposed && !window.isDestroyed()) {
        console.error('Linux panel:', error.message);
      }
      return false;
    } finally {
      if (request === generation) opening = false;
    }
  }

  const cancel = () => { generation++; opening = false; };
  window.on('hide', cancel);

  function hide() {
    cancel();
    if (disposed || window.isDestroyed()) return false;
    window.hide();
    return true;
  }

  function toggle(tray) {
    if (window.isDestroyed()) return false;
    return opening || window.isVisible() ? hide() : show(tray);
  }

  const onDisplayChange = () => {
    trayAnchor.clear();
    const bounds = trayAnchor.bounds(clickedTray);
    if (bounds) anchor = bounds;
    place();
  };
  const dispose = () => {
    disposed = true;
    cancel();
    window.removeListener('hide', cancel);
    remembered.dispose();
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.removeListener(event, onDisplayChange);
  };
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(event, onDisplayChange);
  window.once('closed', dispose);
  return { resize, show, hide, toggle, dispose };
}

module.exports = { createPanelController };
