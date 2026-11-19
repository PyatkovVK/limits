'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const run = promisify(execFile);
const scriptName = 'install-update.ps1';
const powershell = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const scriptArgs = job => ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(job, scriptName)];

function copyInstallerScript(job) {
  // Native PowerShell needs a filesystem path outside app.asar.
  fs.copyFileSync(path.join(__dirname, scriptName), path.join(job, scriptName));
}

function verifyWindowsPackage(file, version, target) {
  return run(powershell(), [...scriptArgs(path.dirname(file)), '-VerifyOnly', '-Package', file, '-Current', target, '-Version', version],
    { windowsHide: true, timeout: 120000 });
}

async function launchInstaller({ job, target, packageFile, packageHash, version, portable, resultFile, pid, spawnProcess }) {
  const config = path.join(job, 'install.json');
  fs.writeFileSync(config, JSON.stringify({ pid, target, package: packageFile, sha256: packageHash,
    version, portable, result: resultFile }));
  const child = spawnProcess(powershell(), [...scriptArgs(job), '-Config', config],
    { detached: true, stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
}

module.exports = { copyInstallerScript, verifyWindowsPackage, launchInstaller };
