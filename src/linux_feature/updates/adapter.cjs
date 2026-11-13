'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { compareVersions } = require('../../common/updates/updates.cjs');
const { systemEnvironment } = require('../core/environment.cjs');
const { verifyAppImage } = require('./appimage.cjs');
const { launchInstaller } = require('./installer.cjs');
const run = promisify(execFile);

function linuxAdapter({ app, arch = process.arch, env = process.env, runCommand = run, spawnProcess = spawn }) {
  const image = env.APPIMAGE && path.isAbsolute(env.APPIMAGE) ? path.resolve(env.APPIMAGE) : null;
  const executable = app?.isPackaged ? app.getPath('exe') : null;
  const kind = image ? 'appimage' : executable === '/opt/Limits/limits' ? 'deb' : null;
  const target = image || executable;
  return { enabled: Boolean(app?.isPackaged && kind && ['x64', 'arm64'].includes(arch)), kind, target,
    assetName: release => kind === 'appimage' ? `Limits-${release.version}-${arch === 'arm64' ? 'arm64' : 'x86_64'}.AppImage` : `Limits-${release.version}-${arch === 'arm64' ? 'arm64' : 'amd64'}.deb`,
    async checkTarget() {
      if (!target || !kind || !fs.lstatSync(target).isFile() || fs.realpathSync(target) !== target) throw new Error('installLocation');
      if (kind === 'appimage') { fs.accessSync(target, fs.constants.W_OK); fs.accessSync(path.dirname(target), fs.constants.W_OK); }
      else if (!fs.existsSync('/usr/bin/dpkg') || !fs.existsSync('/usr/bin/pkexec')) throw new Error('packageManagerMissing');
    },
    async validate(file, release, signal) {
      if (kind === 'appimage') return verifyAppImage(file, arch);
      const { stdout } = await runCommand('/usr/bin/dpkg-deb', ['--field', file, 'Package', 'Version', 'Architecture'], { signal, timeout: 30000, env: systemEnvironment(env) });
      const fields = Object.fromEntries(stdout.trim().split(/\r?\n/).map(line => line.split(/: */)));
      if (fields.Package !== 'limits' || fields.Architecture !== (arch === 'arm64' ? 'arm64' : 'amd64') || compareVersions(fields.Version, release.version) !== 0) throw new Error('invalidPackage');
    },
    install(options) {
      return launchInstaller({ ...options, kind, target, env, spawnProcess });
    }
  };
}

module.exports = { linuxAdapter };
