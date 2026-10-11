'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findCodex } = require('../../common/codex-path.cjs');

function find(files, options = {}) {
  const fileSystem = {
    statSync(file) { if (!files.includes(file)) throw new Error('Missing'); return { isFile: () => true }; },
    accessSync() {},
    readdirSync() { return ['v22.4.0', 'v22.22.0']; }
  };
  return findCodex({ platform: 'darwin', arch: 'arm64', env: { HOME: '/Users/test', PATH: '/usr/bin:/bin' }, resolvePackage() { throw new Error('Not bundled'); }, fileSystem, ...options });
}
test('Finder launch discovers Codex bundled inside installed ChatGPT', () => {
  const binary = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
  assert.equal(find([binary]), binary);
});
test('Finder launch discovers system and per-user Codex desktop installations', () => {
  for (const binary of ['/Applications/Codex.app/Contents/Resources/codex', '/Users/test/Applications/Codex.app/Contents/Resources/codex']) assert.equal(find([binary]), binary);
});
test('Homebrew and nvm installs work without terminal PATH and nvm prefers the latest version', () => {
  const brew = '/opt/homebrew/bin/codex';
  assert.equal(find([brew]), brew);
  assert.equal(find(['/Users/test/.nvm/versions/node/v22.4.0/bin/codex', '/Users/test/.nvm/versions/node/v22.22.0/bin/codex']), '/Users/test/.nvm/versions/node/v22.22.0/bin/codex');
});
test('explicit and bundled binaries take precedence, and empty PATH never searches the working directory', () => {
  assert.equal(find(['/custom/codex'], { env: { CODEX_LIMITS_CODEX_PATH: '/custom/codex' } }), '/custom/codex');
  assert.equal(find(['/bundle/codex/codex'], { resourcesPath: '/bundle' }), '/bundle/codex/codex');
  assert.throws(() => find(['codex'], { env: { HOME: '/Users/test', PATH: '' } }), /Не найден/);
  assert.throws(() => find([], { env: { CODEX_LIMITS_CODEX_PATH: '/missing' } }), /неисполняемый/);
});
test('directories and non-executable files do not mask a usable desktop CLI', () => {
  const binary = '/Applications/Codex.app/Contents/Resources/codex';
  const fileSystem = {
    statSync(file) { return { isFile: () => file !== '/usr/bin/codex' }; },
    accessSync(file) { if (file !== binary) throw new Error('Not executable'); },
    readdirSync() { return []; }
  };
  assert.equal(find([], { fileSystem }), binary);
});
