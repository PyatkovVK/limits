'use strict';
const path = require('node:path');

function findMacCodex({ env, fileSystem, executable }) {
  const home = env.HOME || require('node:os').homedir();
  // Finder does not inherit the shell PATH. Desktop installs carry their own CLI.
  for (const dir of ['/Applications', path.join(home, 'Applications')]) {
    for (const app of ['Codex.app', 'ChatGPT.app']) {
      for (const relative of ['Contents/Resources/codex', 'Contents/MacOS/codex', 'Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex']) {
        const candidate = path.join(dir, app, relative);
        if (executable(candidate)) return candidate;
      }
    }
  }
  const dirs = ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local/bin'), path.join(home, '.volta/bin'), path.join(home, '.npm-global/bin')];
  const nvm = path.join(env.NVM_DIR || path.join(home, '.nvm'), 'versions/node');
  try {
    for (const version of fileSystem.readdirSync(nvm).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))) dirs.push(path.join(nvm, version, 'bin'));
  } catch { /* nvm is optional. */ }
  for (const dir of dirs) {
    const candidate = path.join(dir, 'codex');
    if (executable(candidate)) return candidate;
  }
  return null;
}
module.exports = { findMacCodex };
