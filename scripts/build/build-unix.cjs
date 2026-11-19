'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { buildPlan } = require('./build-plan.cjs');

function buildUnix(target, flags, configurePlatform) {
  const root = path.resolve(__dirname, '../..');
  let plan;
  try { plan = buildPlan(target, flags); }
  catch (error) { console.error(error.message); process.exit(1); }
  require('../prepare/assets.cjs');
  const tempRoot = path.resolve(os.tmpdir());
  const output = fs.mkdtempSync(path.join(tempRoot, 'limits-build-'));
  const config = structuredClone(require('../../package.json').build);
  require('../prepare/bundle-codex.cjs').bundleCodex(config, { platform: process.platform, arch: plan.arch });
  configurePlatform?.(config);
  const { configureSigning, signingEnvironment } = require('../signing/signing.cjs');
  const signedRelease = configureSigning(config, target);
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
  if (signedRelease) require('../signing/verify-signing.cjs').verifySigning(output, target, plan.arch);
  const release = path.join(root, 'release');
  fs.mkdirSync(release, { recursive: true });
  for (const filename of fs.readdirSync(output)) {
    if (!/\.(dmg|zip|AppImage|deb|blockmap|yml)$/.test(filename) || filename === 'builder-debug.yml') continue;
    const destination = path.join(release, filename);
    fs.copyFileSync(path.join(output, filename), `${destination}.new`);
    fs.renameSync(`${destination}.new`, destination);
  }
  const resolvedOutput = path.resolve(output);
  if (!resolvedOutput.startsWith(tempRoot + path.sep) || !path.basename(resolvedOutput).startsWith('limits-build-')) throw new Error('Unsafe temporary cleanup path');
  if (process.env.CODEX_LIMITS_KEEP_BUILD === '1') console.log('Unpacked build retained at:', resolvedOutput);
  else fs.rmSync(resolvedOutput, { recursive: true, force: true });
  console.log('Release ready:', release);
}

module.exports = { buildUnix };
