'use strict';
const path = require('node:path');

function installWindowsBridge({ window, screen, ipcMain, getWidgetHost, panel }) {
  const session = window.webContents.session;
  const preload = session.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'preload.cjs') });
  const trusted = (event, target) => target && !target.isDestroyed() &&
    event.sender === target.webContents && event.senderFrame === target.webContents.mainFrame;
  ipcMain.handle('limits:windows-panel-size', (event, height) => {
    if (!trusted(event, window)) return false;
    return panel.resize(height);
  });
  ipcMain.handle('limits:widget-drag', (event, phase) => {
    const host = getWidgetHost?.();
    if (!trusted(event, host?.window)) return false;
    return host.drag(phase, screen.getCursorScreenPoint());
  });
  const dispose = () => {
    ipcMain.removeHandler('limits:windows-panel-size');
    ipcMain.removeHandler('limits:widget-drag');
    session.unregisterPreloadScript(preload);
  };
  window.once('closed', dispose);
  return dispose;
}

module.exports = { installWindowsBridge };
