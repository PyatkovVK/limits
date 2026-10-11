'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
if (process.platform !== 'win32') {
  console.error('Run npm run build:win on Windows.');
  process.exit(1);
}

const standalone = process.argv.includes('--standalone');
require('./build-taskbar-helper.cjs');
require('./assets.cjs');
const root = path.resolve(__dirname, '../../..');
// Keep large unpacked binaries and compression intermediates off the project disk.
const tempRoot = path.resolve(os.tmpdir());
const output = fs.mkdtempSync(path.join(tempRoot, 'limits-build-'));
console.log('Temporary build directory:', output);
const config = structuredClone(require('../../../package.json').build);
const signedRelease = require('../../../scripts/signing.cjs').configureSigning(config, 'win');
config.directories.output = output;
// Electron 44 may not have downloaded its runtime yet. Otherwise let the builder fetch it.
if (process.arch === 'x64') {
  const electronDist = path.join(path.dirname(require.resolve('electron/package.json')), 'dist');
  if (fs.existsSync(path.join(electronDist, 'version'))) config.electronDist = electronDist;
}
require('../../../scripts/bundle-codex.cjs').bundleCodex(config, { platform: 'win32', arch: 'x64' });
if (standalone) {
  // Preserve the legacy command's filenames; every build now includes the runtime.
  config.nsis.artifactName = 'Limits-Standalone-Setup-${version}.${ext}';
  config.portable.artifactName = 'Limits-Standalone-${version}-portable.${ext}';
}
const configPath = path.join(output, 'build-config.json');
fs.writeFileSync(configPath, JSON.stringify(config));
console.log('Includes the Codex app-server runtime; no separate Codex installation is required.');
const builder = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
const build = spawnSync(process.execPath, [builder, '--win', '--x64', '--publish=never', `--config=${configPath}`], { cwd: root, stdio: 'inherit', windowsHide: true });
if (build.error || build.status !== 0) {
  console.error('Build failed; diagnostics retained at:', output);
  process.exit(build.status || 1);
}
if (signedRelease) require('../../../scripts/verify-signing.cjs').verifySigning(output, 'win', 'x64');
const release = path.join(root, 'release');
fs.mkdirSync(release, { recursive: true });
const unpacked = path.join(output, 'win-unpacked');
function sizeOf(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, item) => {
    const file = path.join(dir, item.name);
    return total + (item.isDirectory() ? sizeOf(file) : fs.statSync(file).size);
  }, 0);
}
console.log('Installed application size:', (sizeOf(unpacked) / 1024 / 1024).toFixed(1), 'MiB');
for (const filename of fs.readdirSync(output)) {
  if (!/\.(exe|blockmap|yml)$/.test(filename) || filename === 'builder-debug.yml') continue;
  const source = path.join(output, filename);
  const target = path.join(release, filename);
  fs.copyFileSync(source, `${target}.new`);
  fs.renameSync(`${target}.new`, target);
}
// Verify the exact resolved temporary target before recursive cleanup.
const resolvedOutput = path.resolve(output);
if (!resolvedOutput.startsWith(tempRoot + path.sep) || !path.basename(resolvedOutput).startsWith('limits-build-')) throw new Error('Unsafe temporary cleanup path');
if (process.env.CODEX_LIMITS_KEEP_BUILD === '1') console.log('Unpacked build retained at:', resolvedOutput);
else fs.rmSync(resolvedOutput, { recursive: true, force: true });
console.log('Windows release ready:', release);
