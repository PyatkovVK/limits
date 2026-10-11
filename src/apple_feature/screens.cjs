'use strict';
const path = require('node:path');
const { execFile } = require('node:child_process');

function readScreens(resourcesPath) {
  const helper = resourcesPath ? path.join(resourcesPath, 'apple-screen-info') : path.resolve(__dirname, '../../build/apple-screen-info');
  return new Promise(resolve => {
    execFile(helper, [], { timeout: 3000, maxBuffer: 64 * 1024 }, (error, stdout) => {
      try {
        const data = error ? [] : JSON.parse(stdout);
        resolve(Array.isArray(data) ? data.filter(info => ['id', 'top', 'notchX', 'notchWidth'].every(key => Number.isFinite(info[key]))) : []);
      } catch { resolve([]); }
    });
  });
}
module.exports = { readScreens };
