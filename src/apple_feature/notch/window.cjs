'use strict';
const path = require('node:path');

function createNotchWindow({ BrowserWindow, webPreferences, restrictWindow, onBlur, onClose, onContextMenu }) {
  const window = new BrowserWindow({
    width: 484,
    height: 654,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    type: 'panel',
    webPreferences: { ...webPreferences, backgroundThrottling: false }
  });
  restrictWindow(window);
  window.setAlwaysOnTop(true, 'pop-up-menu');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setHiddenInMissionControl(true);
  window.setIgnoreMouseEvents(true, { forward: true });
  window.on('blur', onBlur);
  window.on('close', event => {
    event.preventDefault();
    onClose();
  });
  window.webContents.on('context-menu', onContextMenu);
  return window;
}

async function loadNotchWindow(window) {
  await window.loadFile(path.join(__dirname, '../../common/view-panel/index.html'), { query: { apple: 'notch' } });
  await window.webContents.executeJavaScript('window.limitsViewPanelReady');
}

module.exports = { createNotchWindow, loadNotchWindow };
