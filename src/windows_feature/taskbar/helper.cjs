'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function taskbarHelperPath(resourcesPath) {
  return resourcesPath ? path.join(resourcesPath, 'taskbar-helper.exe') : path.resolve(__dirname, '../../../build/taskbar-helper.exe');
}

function dismissTrayOverflow(resourcesPath) {
  spawnSync(taskbarHelperPath(resourcesPath), ['--dismiss-tray-overflow'], {
    windowsHide: true, timeout: 1000, stdio: 'ignore',
  });
}

function disablePanelTransitions(window, resourcesPath) {
  const handle = window.getNativeWindowHandle();
  const id = handle.length === 8 ? handle.readBigInt64LE() : handle.readUInt32LE();
  if (!id) return false;
  return spawnSync(taskbarHelperPath(resourcesPath), ['--disable-panel-transitions', String(process.pid), String(id)], {
    windowsHide: true, timeout: 1000, stdio: 'ignore',
  }).status === 0;
}

module.exports = { taskbarHelperPath, dismissTrayOverflow, disablePanelTransitions };
