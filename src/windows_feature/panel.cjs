'use strict';
const fs = require('node:fs');
const path = require('node:path');

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

function createPanelController({ window, screen, getAnchorBounds, ipcMain, getWidgetHost, root }) {
  let contentHeight = window.getSize()[1], lastAnchor = null;
  const file = root && path.join(root, 'windows-panel-position.json');
  let savedPosition = null, expectedPosition = null;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Number.isSafeInteger(saved.x) && Number.isSafeInteger(saved.y)) savedPosition = { x: saved.x, y: saved.y };
  } catch { /* First launch or an invalid preference uses the tray anchor. */ }
  const onMoved = () => {
    if (window.isDestroyed() || !window.isVisible()) return;
    const [x, y] = window.getPosition();
    if (expectedPosition?.x === x && expectedPosition?.y === y) return;
    savedPosition = expectedPosition = { x, y };
    if (file) try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(savedPosition));
      fs.renameSync(`${file}.tmp`, file);
    } catch { /* Keep the preference in memory if the disk is unavailable. */ }
  };
  window.on('moved', onMoved);
  let modalOperations = 0;
  const onBlur = () => {
    if (!modalOperations && !window.isDestroyed() && window.isVisible()) window.hide();
  };
  window.on('blur', onBlur);
  const onDisplayChanged = () => { if (!window.isDestroyed() && window.isVisible()) place(lastAnchor); };
  screen.on?.('display-metrics-changed', onDisplayChanged);
  screen.on?.('display-removed', onDisplayChanged);
  window.once('closed', () => {
    window.removeListener('blur', onBlur); window.removeListener('moved', onMoved);
    screen.removeListener?.('display-metrics-changed', onDisplayChanged);
    screen.removeListener?.('display-removed', onDisplayChanged);
  });
  async function withModal(operation) {
    modalOperations++;
    try { return await operation(); } finally { modalOperations--; }
  }
  function place(anchor) {
    if (window.isDestroyed()) return false;
    lastAnchor = anchor;
    const display = savedPosition ? screen.getDisplayMatching({ ...savedPosition, width: window.getSize()[0], height: contentHeight }) :
      anchor?.width ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
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
    const area = display.workArea;
    const position = savedPosition ? {
      x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, savedPosition.x))),
      y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height, savedPosition.y))),
    } : panelPosition({ anchor, area, size: window.getSize() });
    expectedPosition = position;
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
    if (savedPosition) return false;
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
