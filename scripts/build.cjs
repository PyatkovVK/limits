'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { buildPlan } = require('./build-plan.cjs');

const root = path.resolve(__dirname, '..');
let plan;
try { plan = buildPlan(process.argv[2], process.argv.slice(3)); }
catch (error) { console.error(error.message); process.exit(1); }
require('../src/windows_feature/scripts/assets.cjs');
const tempRoot = path.resolve(os.tmpdir());
const output = fs.mkdtempSync(path.join(tempRoot, 'limits-build-'));
const config = structuredClone(require('../package.json').build);
if (process.argv[2] === 'mac') {
  require('../src/apple_feature/scripts/build-helper.cjs').buildHelper();
  require('../src/apple_feature/scripts/build-config.cjs').configureAppleBuild(config);
}
const { configureSigning, signingEnvironment } = require('./signing.cjs');
const signedRelease = configureSigning(config, process.argv[2]);
config.directories.output = output;
// Electron 44 downloads its runtime lazily; a fresh npm install may have no dist yet.
// Let electron-builder download it unless a matching local runtime is available.
if (plan.arch === process.arch) {
  const electronDist = path.join(path.dirname(require.resolve('electron/package.json')), 'dist');
  if (fs.existsSync(path.join(electronDist, 'version'))) config.electronDist = electronDist;
}
const configPath = path.join(output, 'build-config.json');
fs.writeFileSync(configPath, JSON.stringify(config));
console.log('Temporary build directory:', output);
const builder = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
const result = spawnSync(process.execPath, [builder, ...plan.args, `--config=${configPath}`], { cwd: root, env: signingEnvironment(), stdio: 'inherit', windowsHide: true });
if (result.error || result.status !== 0) {
  console.error('Build failed; diagnostics retained at:', output);
  process.exit(result.status || 1);
}
if (signedRelease) require('./verify-signing.cjs').verifySigning(output, process.argv[2], plan.arch);
const release = path.join(root, 'release');
fs.mkdirSync(release, { recursive: true });
for (const filename of fs.readdirSync(output)) {
  if (!/\.(dmg|zip|AppImage|deb|blockmap|yml)$/.test(filename) || filename === 'builder-debug.yml') continue;
  const target = path.join(release, filename);
  fs.copyFileSync(path.join(output, filename), `${target}.new`);
  fs.renameSync(`${target}.new`, target);
}
const resolvedOutput = path.resolve(output);
if (!resolvedOutput.startsWith(tempRoot + path.sep) || !path.basename(resolvedOutput).startsWith('limits-build-')) throw new Error('Unsafe temporary cleanup path');
if (process.env.CODEX_LIMITS_KEEP_BUILD === '1') console.log('Unpacked build retained at:', resolvedOutput);
else fs.rmSync(resolvedOutput, { recursive: true, force: true });
console.log('Release ready:', release);
