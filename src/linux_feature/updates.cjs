'use strict';
const fs = require('node:fs'), path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { PackageUpdates } = require('../common/package-updates.cjs');
const { compareVersions } = require('../common/updates.cjs');
const { browserEnvironment } = require('./browser.cjs');
const run = promisify(execFile);
async function verifyAppImage(file, arch) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const data = Buffer.alloc(64); const { bytesRead } = await handle.read(data, 0, 64, 0);
    if (bytesRead !== 64 || data.toString('hex', 0, 4) !== '7f454c46' || data[4] !== 2 || data[5] !== 1 ||
        data.toString('hex', 8, 11) !== '414902' || data.readUInt16LE(18) !== (arch === 'arm64' ? 183 : 62)) throw new Error('invalidPackage');
  } finally { await handle.close(); }
}
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
      const { stdout } = await runCommand('/usr/bin/dpkg-deb', ['--field', file, 'Package', 'Version', 'Architecture'], { signal, timeout: 30000, env: browserEnvironment(env) });
      const fields = Object.fromEntries(stdout.trim().split(/\r?\n/).map(line => line.split(/: */)));
      if (fields.Package !== 'limits' || fields.Architecture !== (arch === 'arm64' ? 'arm64' : 'amd64') || compareVersions(fields.Version, release.version) !== 0) throw new Error('invalidPackage');
    },
    async install({ file, job, resultFile, pid }) {
      const script = path.join(job, 'install.sh'); fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'install-update.sh')), { mode: 0o700 });
      const child = spawnProcess('/bin/sh', [script, String(pid), kind, file, target, job, resultFile], { detached: true, stdio: 'ignore', env: browserEnvironment(env) });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref();
    }
  };
}
class LinuxUpdates extends PackageUpdates {
  constructor(options) { super({ ...options, adapter: linuxAdapter(options) }); }
}
module.exports = { LinuxUpdates, linuxAdapter, verifyAppImage };
