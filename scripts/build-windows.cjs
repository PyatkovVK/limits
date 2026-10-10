'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

require('./stage-codex.cjs');
require('./build-taskbar-helper.cjs');
require('./assets.cjs');
const root = path.resolve(__dirname, '..');
// Keep large unpacked binaries and compression intermediates off the project disk.
const tempRoot = path.resolve(os.tmpdir());
const output = fs.mkdtempSync(path.join(tempRoot, 'codex-limits-build-'));
console.log('Temporary build directory:', output);
const builder = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
const build = spawnSync(process.execPath, [builder, '--win', '--x64', `--config.directories.output=${output}`], { cwd: root, stdio: 'inherit', windowsHide: true });
if (build.error || build.status !== 0) {
  console.error('Build failed; diagnostics retained at:', output);
  process.exit(build.status || 1);
}
const release = path.join(root, 'release');
fs.mkdirSync(release, { recursive: true });
for (const filename of fs.readdirSync(output)) {
  if (!/\.(exe|blockmap|yml)$/.test(filename) || filename === 'builder-debug.yml') continue;
  const source = path.join(output, filename);
  const target = path.join(release, filename);
  fs.copyFileSync(source, `${target}.new`);
  fs.renameSync(`${target}.new`, target);
}
// Verify the exact resolved temporary target before recursive cleanup.
const resolvedOutput = path.resolve(output);
if (!resolvedOutput.startsWith(tempRoot + path.sep) || !path.basename(resolvedOutput).startsWith('codex-limits-build-')) throw new Error('Unsafe temporary cleanup path');
if (process.env.CODEX_LIMITS_KEEP_BUILD === '1') console.log('Unpacked build retained at:', resolvedOutput);
else fs.rmSync(resolvedOutput, { recursive: true, force: true });
console.log('Windows release ready:', release);
