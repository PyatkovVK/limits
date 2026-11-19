'use strict';
const path = require('node:path');

function findLinuxCodex({ env, arch, fileSystem, executable }) {
  const home = env.HOME || require('node:os').homedir();
  for (const dir of ['.local/bin', '.npm-global/bin', '.volta/bin']) {
    const candidate = path.join(home, dir, 'codex');
    if (executable(candidate)) return candidate;
  }
  const platformDir = { x64: 'linux-x86_64', arm64: 'linux-aarch64' }[arch];
  if (!platformDir) return null;
  const roots = [
    '.vscode/extensions', '.vscode-insiders/extensions',
    '.var/app/com.visualstudio.code/data/vscode/extensions',
    '.var/app/com.visualstudio.code.insiders/data/vscode-insiders/extensions',
  ];
  const candidates = [];
  for (const relative of roots) {
    const root = path.join(home, relative);
    try {
      for (const name of fileSystem.readdirSync(root)) {
        if (!name.startsWith('openai.chatgpt-')) continue;
        const candidate = path.join(root, name, 'bin', platformDir, 'codex');
        if (executable(candidate)) candidates.push({ path: candidate, modified: fileSystem.statSync(candidate).mtimeMs || 0 });
      }
    } catch { /* VS Code and its extension are optional. */ }
  }
  candidates.sort((a, b) => b.modified - a.modified || b.path.localeCompare(a.path, 'en', { numeric: true }));
  return candidates[0]?.path || null;
}
module.exports = { findLinuxCodex };
