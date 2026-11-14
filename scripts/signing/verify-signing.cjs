'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function verifySigning(output, target, arch, { run = spawnSync, fileSystem = fs, env = process.env } = {}) {
  function check(command, args, options = {}) {
    const result = run(command, args, { windowsHide: true, encoding: 'utf8', ...options });
    if (result.error || result.status !== 0) throw new Error(`Release signature verification failed: ${command}`);
    return result;
  }
  if (target === 'win') {
    const packages = fileSystem.readdirSync(output).filter(name => name.endsWith('.exe')).map(name => path.join(output, name));
    if (packages.length < 2) throw new Error('Both Windows release packages must exist before signature verification.');
    const app = path.join(output, 'win-unpacked');
    const files = [path.join(app, 'Limits.exe'), path.join(app, 'resources', 'taskbar-helper.exe'), path.join(app, 'resources', 'codex', 'codex.exe'), ...packages];
    const script = `$ErrorActionPreference = 'Stop'
      $signingFiles = ConvertFrom-Json $env:LIMITS_SIGNING_FILES
      $publisher = $null
      foreach ($file in $signingFiles) {
        $signature = Get-AuthenticodeSignature -LiteralPath $file
        if ($signature.Status -ne 'Valid' -or !$signature.SignerCertificate) { throw 'Invalid release signature' }
        if (!$publisher) { $publisher = $signature.SignerCertificate.Thumbprint }
        if ($signature.SignerCertificate.Thumbprint -ne $publisher) { throw 'Release publisher mismatch' }
      }`;
    // Paths are data passed through the environment, never interpolated into shell code.
    check('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...env, LIMITS_SIGNING_FILES: JSON.stringify(files) } });
  } else if (target === 'mac') {
    const app = path.join(output, arch === 'arm64' ? 'mac-arm64' : 'mac', 'Limits.app');
    check('codesign', ['--verify', '--deep', '--strict', app]);
    const details = check('codesign', ['--display', '--verbose=4', app]);
    const metadata = `${details.stdout || ''}\n${details.stderr || ''}`;
    if (!/Authority=Developer ID Application:/.test(metadata) || !/flags=.*\bruntime\b/.test(metadata)) throw new Error('macOS release requires Developer ID and hardened runtime.');
    check('codesign', ['--verify', '--strict', path.join(app, 'Contents', 'Resources', 'apple-screen-info')]);
    check('spctl', ['--assess', '--type', 'execute', app]);
    check('xcrun', ['stapler', 'validate', app]);
  }
}
module.exports = { verifySigning };
