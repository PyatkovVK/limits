'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findCodex } = require('../../common/codex-path.cjs');
const normalized = value => value.replaceAll('\\', '/');
function find(files, { arch = 'x64', env = {}, nonExecutable = [] } = {}) {
  const fileSystem = {
    statSync(file) {
      const modified = files[normalized(file)];
      if (modified === undefined) throw new Error('Missing');
      return { isFile: () => true, mtimeMs: modified };
    },
    accessSync(file) { if (nonExecutable.includes(normalized(file))) throw new Error('Not executable'); },
    readdirSync(root) {
      const prefix = normalized(root) + '/';
      return [...new Set(Object.keys(files).filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length).split('/')[0]))];
    },
  };
  return normalized(findCodex({ platform: 'linux', arch, env: { HOME: '/home/test', PATH: '/usr/bin:/bin', ...env }, fileSystem, resolvePackage() { throw new Error('Not bundled'); } }));
}
test('desktop Linux discovers VS Code and Flatpak extension binaries without a shell PATH', () => {
  for (const root of ['.vscode/extensions', '.var/app/com.visualstudio.code/data/vscode/extensions']) {
    const binary = `/home/test/${root}/openai.chatgpt-26.1007/bin/linux-x86_64/codex`;
    assert.equal(find({ [binary]: 1 }), binary);
  }
  const arm = '/home/test/.vscode/extensions/openai.chatgpt-26.1007/bin/linux-aarch64/codex';
  assert.equal(find({ [arm]: 1 }, { arch: 'arm64' }), arm);
});
test('extension updates select the newest executable while explicit overrides and PATH take precedence', () => {
  const first = '/home/test/.vscode/extensions/openai.chatgpt-26.1007/bin/linux-x86_64/codex';
  const second = '/home/test/.vscode/extensions/openai.chatgpt-26.1008/bin/linux-x86_64/codex';
  assert.equal(find({ [first]: 1, [second]: 2 }), second);
  assert.equal(find({ [first]: 1, [second]: 2 }, { nonExecutable: [second] }), first);
  assert.equal(find({ [first]: 1, '/usr/bin/codex': 0 }), '/usr/bin/codex');
  assert.equal(find({ [first]: 1, '/custom/codex': 0 }, { env: { CODEX_LIMITS_CODEX_PATH: '/custom/codex' } }), '/custom/codex');
  assert.throws(() => find({ [first]: 1 }, { env: { CODEX_LIMITS_CODEX_PATH: '/missing' } }), /неисполняемый/);
  assert.throws(() => find({ [first]: 1 }, { arch: 'ia32' }), /Не найден/);
});
