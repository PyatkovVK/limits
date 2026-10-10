'use strict';
const fs = require('node:fs');
const path = require('node:path');

function findCodex({ resourcesPath, env = process.env, platform = process.platform, arch = process.arch, fileSystem = fs, resolvePackage = require.resolve } = {}) {
  function executable(file) {
    try {
      if (!fileSystem.statSync(file).isFile()) return false;
      if (platform !== 'win32') fileSystem.accessSync(file, fs.constants.X_OK);
      return true;
    } catch { return false; }
  }
  if (env.CODEX_LIMITS_CODEX_PATH) {
    if (!executable(env.CODEX_LIMITS_CODEX_PATH)) throw new Error('CODEX_LIMITS_CODEX_PATH указывает на отсутствующий или неисполняемый файл.');
    return env.CODEX_LIMITS_CODEX_PATH;
  }
  const exe = platform === 'win32' ? 'codex.exe' : 'codex';
  if (resourcesPath) {
    const bundled = path.join(resourcesPath, 'codex', exe);
    if (executable(bundled)) return bundled;
  }
  // The npm package keeps the native executable in an optional platform package.
  const triple = { 'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc', 'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin', 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl' }[`${platform}-${arch}`];
  if (triple) {
    const suffix = { win32: 'win32', darwin: 'darwin', linux: 'linux' }[platform];
    const packageNames = [`@openai/codex-${suffix}-${arch}`, '@openai/codex'];
    for (const name of packageNames) {
      try {
        const base = path.dirname(resolvePackage(`${name}/package.json`));
        for (const folder of ['bin', 'codex']) {
          const binary = path.join(base, 'vendor', triple, folder, exe);
          if (executable(binary)) return binary;
        }
      } catch { /* Continue to installed CLI. */ }
    }
  }
  for (const dir of (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':').filter(Boolean)) {
    const candidate = path.join(dir, exe);
    if (executable(candidate)) return candidate;
  }
  if (platform === 'darwin') {
    const candidate = require('./Mac feature/codex-path.cjs').findMacCodex({ env, fileSystem, executable });
    if (candidate) return candidate;
  }
  if (platform === 'win32' && env.LOCALAPPDATA) {
    const base = path.join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const candidates = fileSystem.readdirSync(base).map(dir => path.join(base, dir, exe)).filter(executable);
      candidates.sort((a, b) => fileSystem.statSync(b).mtimeMs - fileSystem.statSync(a).mtimeMs);
      if (candidates[0]) return candidates[0];
    } catch { /* Desktop app is optional. */ }
  }
  throw new Error('Не найден Codex CLI. Установите Codex или задайте CODEX_LIMITS_CODEX_PATH.');
}

module.exports = { findCodex };
