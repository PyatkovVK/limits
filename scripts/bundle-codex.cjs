'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Ship only the app-server executable; the CLI's other tools are not needed.
function bundleCodex(config, { platform = process.platform, arch = process.arch, resolvePackage = require.resolve, fileSystem = fs } = {}) {
  const key = { win32: 'win', darwin: 'mac', linux: 'linux' }[platform];
  if (!key || !['x64', 'arm64'].includes(arch)) throw new Error(`Unsupported runtime: ${platform}-${arch}`);
  const cpu = arch === 'x64' ? 'x86_64' : 'aarch64';
  const system = { win32: 'pc-windows-msvc', darwin: 'apple-darwin', linux: 'unknown-linux-musl' }[platform];
  const target = { packageName: `@openai/codex-${platform}-${arch}`, triple: `${cpu}-${system}`, exe: platform === 'win32' ? 'codex.exe' : 'codex' };
  let base;
  try { base = path.dirname(resolvePackage(`${target.packageName}/package.json`)); }
  catch { throw new Error(`Missing ${target.packageName}. Install dependencies for ${platform}-${arch} before building.`); }
  const binary = ['bin', 'codex'].map(folder => path.join(base, 'vendor', target.triple, folder, target.exe))
    .find(file => { try { return fileSystem.statSync(file).isFile(); } catch { return false; } });
  if (!binary) throw new Error(`Missing ${target.packageName} executable. Reinstall dependencies before building.`);
  if (platform !== 'win32') fileSystem.accessSync(binary, fs.constants.X_OK);
  const license = path.resolve(__dirname, '../licenses/Apache-2.0.txt');
  if (!fileSystem.statSync(license).isFile()) throw new Error('Missing Codex license.');
  config[key].extraResources = [
    ...(config[key].extraResources || []),
    { from: binary, to: `codex/${target.exe}` },
    { from: license, to: 'codex/Apache-2.0.txt' }
  ];
  return binary;
}

module.exports = { bundleCodex };
