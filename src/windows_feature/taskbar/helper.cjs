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

module.exports = { taskbarHelperPath, dismissTrayOverflow };
