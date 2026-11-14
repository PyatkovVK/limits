'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { welcomeBounds } = require('./geometry.cjs');

async function openWelcome({ BrowserWindow, ipcMain, placement, nativeTheme, restrictWindow, display, mode, language, claim, onClose, onCreate }) {
  const config = {
    mode, language, reducedMotion: nativeTheme.prefersReducedMotion,
    display: {
      description: display.description[language],
      variants: display.variants.map(({ label, image, size }) => ({
        label: label[language], size,
        src: 'data:image/png;base64,' + fs.readFileSync(image).toString('base64'),
      })),
    },
  };
  const window = new BrowserWindow({
    ...welcomeBounds(placement), show: false,
    frame: false, resizable: false, transparent: true, skipTaskbar: true, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  const contents = window.webContents;
  const channels = { get: 'limits:welcome:get', finish: 'limits:welcome:finish' };
  let presented = false;
  restrictWindow(window);
  window.on('closed', () => {
    for (const channel of Object.values(channels)) ipcMain.removeHandler(channel);
    onClose(presented);
  });
  const handle = (channel, action) => ipcMain.handle(channel, event => {
    if (event.sender !== contents || event.senderFrame !== contents.mainFrame) throw new Error('Unauthorized');
    return action();
  });
  handle(channels.get, () => config);
  handle(channels.finish, () => { if (presented) window.close(); });
  onCreate(window);
  try {
    await window.loadFile(path.join(__dirname, 'index.html'));
    // Wait for localized content before recording that the user saw the tour.
    await contents.executeJavaScript('window.welcomeReady');
    if (window.isDestroyed()) return false;
    if (!claim()) {
      window.destroy();
      return false;
    }
    presented = true;
    window.show();
    return true;
  } catch (error) {
    if (!window.isDestroyed()) window.destroy();
    throw error;
  }
}

module.exports = { openWelcome };
