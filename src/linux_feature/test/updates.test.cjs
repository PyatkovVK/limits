'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { verifyAppImage, linuxAdapter } = require('../updates.cjs');
function image(arch = 62) { const value = Buffer.alloc(64); Buffer.from('7f454c460201', 'hex').copy(value); Buffer.from('414902', 'hex').copy(value, 8); value.writeUInt16LE(arch, 18); return value; }
test('AppImage verification rejects a wrong format, type or architecture', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-appimage-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'update');
  for (const arch of ['x64', 'arm64']) { fs.writeFileSync(file, image(arch === 'x64' ? 62 : 183)); await verifyAppImage(file, arch); await assert.rejects(verifyAppImage(file, arch === 'x64' ? 'arm64' : 'x64')); }
  fs.writeFileSync(file, Buffer.alloc(64)); await assert.rejects(verifyAppImage(file, 'x64'));
});
test('DEB metadata must match package identity, version and architecture', async () => {
  const release = { version: '1.5.0' };
  for (const fields of ['Package: limits\nVersion: 1.5.0\nArchitecture: amd64\n', 'Package: other\nVersion: 1.5.0\nArchitecture: amd64\n', 'Package: limits\nVersion: 1.4.0\nArchitecture: amd64\n', 'Package: limits\nVersion: 1.5.0\nArchitecture: arm64\n']) {
    const adapter = linuxAdapter({ app: { isPackaged: true, getPath: () => '/opt/Limits/limits' }, arch: 'x64', env: {}, runCommand: async (command, args) => { assert.equal(command, '/usr/bin/dpkg-deb'); assert.deepEqual(args.slice(0, 2), ['--field', 'fixture.deb']); return { stdout: fields }; } });
    assert.equal(adapter.assetName(release), 'Limits-1.5.0-amd64.deb');
    if (fields.startsWith('Package: limits\nVersion: 1.5.0\nArchitecture: amd64')) await adapter.validate('fixture.deb', release);
    else await assert.rejects(adapter.validate('fixture.deb', release));
  }
});
test('the real Linux helper replaces an AppImage and restores it after a failed launch', { skip: process.platform !== 'linux' }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-linux-helper-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const fail of [false, true]) {
    const dir = path.join(root, String(fail)); fs.mkdirSync(dir);
    const target = path.join(dir, "Limits user's $file.AppImage"), job = path.join(dir, 'job'); fs.mkdirSync(job);
    const source = path.join(job, 'new.AppImage'), marker = path.join(dir, 'marker'), result = path.join(dir, 'result.json');
    fs.writeFileSync(target, '#!/bin/sh\nprintf old > "$LIMITS_TEST_MARKER"\nsleep 3\n', { mode: 0o755 });
    fs.writeFileSync(source, fail ? '#!/bin/sh\nexit 13\n' : '#!/bin/sh\nprintf new > "$LIMITS_TEST_MARKER"\nsleep 3\n');
    const output = spawnSync('/bin/sh', [path.join(__dirname, '../install-update.sh'), '999999999', 'appimage', source, target, job, result], { env: { ...process.env, LIMITS_TEST_MARKER: marker }, timeout: 10000, encoding: 'utf8' });
    assert.equal(output.status, fail ? 1 : 0, output.stderr);
    assert.equal(JSON.parse(fs.readFileSync(result)).status, fail ? 'failed' : 'installed');
    assert.match(fs.readFileSync(target, 'utf8'), fail ? /printf old/ : /printf new/);
    assert.equal(fs.existsSync(job), false);
  }
});
