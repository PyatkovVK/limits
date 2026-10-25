'use strict';
const fs = require('node:fs'), path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { PackageUpdates } = require('../common/package-updates.cjs');
const run = promisify(execFile);
async function verifyPE(file) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const header = Buffer.alloc(64); const { bytesRead } = await handle.read(header, 0, 64, 0);
    if (bytesRead !== 64 || header.toString('ascii', 0, 2) !== 'MZ') throw new Error('invalidPackage');
    const offset = header.readUInt32LE(60), size = (await handle.stat()).size;
    if (offset < 64 || offset > size - 6 || offset > 16 * 1024 * 1024) throw new Error('invalidPackage');
    const pe = Buffer.alloc(6); await handle.read(pe, 0, 6, offset);
    if (pe.toString('hex', 0, 4) !== '50450000' || ![0x14c, 0x8664].includes(pe.readUInt16LE(4))) throw new Error('invalidPackage');
  } finally { await handle.close(); }
}
function windowsAdapter({ app, arch = process.arch, env = process.env, runCommand = run, spawnProcess = spawn }) {
  const portable = Boolean(env.PORTABLE_EXECUTABLE_FILE);
  const target = app?.isPackaged ? path.resolve(env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')) : null;
  const powershell = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return { enabled: Boolean(target && arch === 'x64'), target, portable,
    assetName: release => portable ? `Limits-${release.version}-portable.exe` : `Limits-Setup-${release.version}.exe`,
    async checkTarget() {
      if (!target || !fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink()) throw new Error('installLocation');
      fs.accessSync(path.dirname(target), fs.constants.W_OK);
    },
    async validate(file, _release, signal) {
      await verifyPE(file);
      // Require the existing publisher when upgrading an Authenticode-signed app.
      const script = `$ErrorActionPreference = 'Stop'
        $paths = ConvertFrom-Json $env:LIMITS_UPDATE_SIGNATURE_FILES
        $current = Get-AuthenticodeSignature -LiteralPath $paths[0]
        if ($current.Status -eq 'Valid' -and $current.SignerCertificate) {
          $next = Get-AuthenticodeSignature -LiteralPath $paths[1]
          if ($next.Status -ne 'Valid' -or !$next.SignerCertificate -or $current.SignerCertificate.Thumbprint -ne $next.SignerCertificate.Thumbprint) { throw 'Publisher mismatch' }
        }`;
      try { await runCommand(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { signal, timeout: 30000, windowsHide: true, env: { ...env, LIMITS_UPDATE_SIGNATURE_FILES: JSON.stringify([target, file]) } }); }
      catch { throw new Error('invalidPackage'); }
    },
    async install({ file, job, resultFile, pid }) {
      const script = path.join(job, 'install.ps1'), config = path.join(job, 'install.json');
      fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'install-update.ps1')));
      fs.writeFileSync(config, JSON.stringify({ pid, portable, source: file, target, job, resultFile }));
      const child = spawnProcess(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ConfigFile', config], { detached: true, stdio: 'ignore', windowsHide: true });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref();
    }
  };
}
class WindowsUpdates extends PackageUpdates {
  constructor(options) { super({ ...options, adapter: windowsAdapter(options) }); }
}
module.exports = { WindowsUpdates, windowsAdapter, verifyPE };
