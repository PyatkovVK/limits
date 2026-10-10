'use strict';
const fs = require('node:fs');
const path = require('node:path');

function findCodex({ resourcesPath, env = process.env } = {}) {
  if (env.CODEX_LIMITS_CODEX_PATH) {
    if (!fs.existsSync(env.CODEX_LIMITS_CODEX_PATH)) throw new Error('CODEX_LIMITS_CODEX_PATH указывает на отсутствующий файл.');
    return env.CODEX_LIMITS_CODEX_PATH;
  }
  const exe = process.platform === 'win32' ? 'codex.exe' : 'codex';
  if (resourcesPath) {
    const bundled = path.join(resourcesPath, 'codex', exe);
    if (fs.existsSync(bundled)) return bundled;
  }
  // The npm package keeps the native executable in an optional platform package.
  const triple = { 'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc', 'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin', 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl' }[`${process.platform}-${process.arch}`];
  if (triple) {
    const suffix = { win32: 'win32', darwin: 'darwin', linux: 'linux' }[process.platform];
    const packageNames = [`@openai/codex-${suffix}-${process.arch}`, '@openai/codex'];
    for (const name of packageNames) {
      try {
        const base = path.dirname(require.resolve(`${name}/package.json`));
        for (const folder of ['bin', 'codex']) {
          const binary = path.join(base, 'vendor', triple, folder, exe);
          if (fs.existsSync(binary)) return binary;
        }
      } catch { /* Continue to installed CLI. */ }
    }
  }
  for (const dir of (env.PATH || env.Path || '').split(path.delimiter)) {
    const candidate = path.join(dir, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (process.platform === 'win32' && env.LOCALAPPDATA) {
    const base = path.join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const candidates = fs.readdirSync(base).map(dir => path.join(base, dir, exe)).filter(file => fs.existsSync(file));
      candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (candidates[0]) return candidates[0];
    } catch { /* Desktop app is optional. */ }
  }
  throw new Error('Не найден Codex CLI. Установите Codex или задайте CODEX_LIMITS_CODEX_PATH.');
}

module.exports = { findCodex };
