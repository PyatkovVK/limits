'use strict';

function panelPosition({ anchor, area, size }) {
  if (!anchor?.width) anchor = null;
  const [width, height] = size;
  const center = anchor ? anchor.x + anchor.width / 2 : area.x + area.width - width / 2 - 16;
  return {
    x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, center - width / 2))),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height,
      anchor && anchor.y < area.y + area.height / 2 ? area.y + 8 : area.y + area.height - height - 8))),
  };
}

function createPanelController({ window, screen, getAnchorBounds, ipcMain, getWidgetHost }) {
  let contentHeight = window.getSize()[1], lastAnchor = null;
  let modalOperations = 0;
  const onBlur = () => {
    if (!modalOperations && !window.isDestroyed() && window.isVisible()) window.hide();
  };
  window.on('blur', onBlur);
  window.once('closed', () => window.removeListener('blur', onBlur));
  async function withModal(operation) {
    modalOperations++;
    try { return await operation(); } finally { modalOperations--; }
  }
  function place(anchor) {
    if (window.isDestroyed()) return false;
    lastAnchor = anchor;
    const display = anchor?.width ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
    const height = Math.min(Math.max(80, Math.ceil(contentHeight)), Math.max(1, display.workArea.height - 16));
    const [width, currentHeight] = window.getSize();
    if (height !== currentHeight) {
      // On Windows, resizable:false fixes both native size constraints to the
      // initial size. Widen that range before resizing, then lock it again.
      window.setMinimumSize(width, Math.min(currentHeight, height));
      window.setMaximumSize(width, Math.max(currentHeight, height));
      window.setSize(width, height);
      window.setMinimumSize(width, height);
      window.setMaximumSize(width, height);
    }
    const position = panelPosition({ anchor, area: display.workArea, size: window.getSize() });
    const [x, y] = window.getPosition();
    if (x !== position.x || y !== position.y) window.setPosition(position.x, position.y);
    return true;
  }
  function show(clickedAnchor) {
    if (!place(clickedAnchor?.getBounds?.() || getAnchorBounds?.() || null)) return false;
    window.show(); window.focus();
    return true;
  }
  function follow(widget) {
    if (window.isDestroyed() || !window.isVisible() || !widget || widget.isDestroyed() || !widget.isVisible()) return false;
    return place(widget.getBounds());
  }
  function resize(height) {
    if (!Number.isFinite(height) || height <= 0 || window.isDestroyed()) return false;
    contentHeight = height;
    return place(lastAnchor || getAnchorBounds?.() || null);
  }
  const controller = { show, follow, resize, withModal };
  if (ipcMain) require('./ipc.cjs').installWindowsBridge({ window, screen, ipcMain, getWidgetHost, panel: controller });
  return controller;
}

module.exports = { panelPosition, createPanelController };
