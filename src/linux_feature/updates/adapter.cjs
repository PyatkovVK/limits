'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { verifyAppImage } = require('./appimage.cjs');
const { launchInstaller } = require('./installer.cjs');

function linuxAdapter({ app, arch = process.arch, env = process.env, spawnProcess = spawn }) {
  // A package in the user's cache cannot be trusted across a privilege boundary.
  if (!app?.isPackaged || !['x64', 'arm64'].includes(arch) || !env.APPIMAGE || !path.isAbsolute(env.APPIMAGE)) {
    return { enabled: false };
  }
  const target = path.resolve(env.APPIMAGE);
  return { enabled: true,
    assetName: release => `Limits-${release.version}-${arch === 'arm64' ? 'arm64' : 'x86_64'}.AppImage`,
    async checkTarget() {
      if (!fs.lstatSync(target).isFile() || fs.realpathSync(target) !== target) throw new Error('installLocation');
      fs.accessSync(target, fs.constants.W_OK);
      fs.accessSync(path.dirname(target), fs.constants.W_OK);
    },
    validate(file) {
      return verifyAppImage(file, arch);
    },
    install(options) {
      return launchInstaller({ ...options, target, env, spawnProcess });
    }
  };
}

module.exports = { linuxAdapter };
