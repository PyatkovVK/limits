'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { verifyAppImage } = require('../updates/appimage.cjs');
const { linuxAdapter } = require('../updates/adapter.cjs');
const { LinuxUpdates } = require('../updates/updates.cjs');
function image(arch = 62) { const value = Buffer.alloc(64); Buffer.from('7f454c460201', 'hex').copy(value); Buffer.from('414902', 'hex').copy(value, 8); value.writeUInt16LE(arch, 18); return value; }
test('AppImage verification rejects a wrong format, type or architecture', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-appimage-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'update');
  for (const arch of ['x64', 'arm64']) { fs.writeFileSync(file, image(arch === 'x64' ? 62 : 183)); await verifyAppImage(file, arch); await assert.rejects(verifyAppImage(file, arch === 'x64' ? 'arm64' : 'x64')); }
  fs.writeFileSync(file, Buffer.alloc(64)); await assert.rejects(verifyAppImage(file, 'x64'));
});
test('DEB updates open the release page without downloading or launching an installer', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-deb-updates-'));
  const releaseUrl = 'https://github.com/PyatkovVK/limits/releases/tag/v1.5.0';
  const opened = [];
  const updater = new LinuxUpdates({ root, currentVersion: '1.4.0', arch: 'x64', env: {},
    app: { isPackaged: true, getPath: () => '/opt/Limits/limits', quit: () => assert.fail('The app must stay open') },
    fetchImpl: async url => {
      assert.match(url, /^https:\/\/api\.github\.com\/repos\/PyatkovVK\/limits\/releases\?/);
      return Response.json([{ tag_name: 'v1.5.0', draft: false, prerelease: false, html_url: releaseUrl }]);
    },
    openExternal: async url => opened.push(url),
    spawnProcess: () => assert.fail('The app must not launch an installer'),
  });
  t.after(() => { updater.stop(); fs.rmSync(root, { recursive: true, force: true }); });

  const available = await updater.check();
  assert.equal(available.offer.version, '1.5.0');
  assert.equal(available.installation.enabled, false);
  await updater.prepare(available.release);
  assert.deepEqual(await updater.openRelease(), { opened: true, simulated: false });
  assert.deepEqual(opened, [releaseUrl]);
  assert.equal(updater.snapshot().installation.status, 'idle');
  assert.equal(fs.existsSync(path.join(root, 'package-updates')), false);
});

test('update handoff copies the relocated helper and launches it with a clean system environment', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-linux-handoff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'Limits.AppImage');
  const file = path.join(root, 'new.AppImage');
  const resultFile = path.join(root, 'result.json');
  const env = {
    APPIMAGE: target, APPDIR: '/tmp/.mount_Limits',
    PATH: '/tmp/.mount_Limits/usr/bin:/usr/bin',
    LD_LIBRARY_PATH: '/tmp/.mount_Limits/lib', DBUS_SESSION_BUS_ADDRESS: 'session'
  };
  let handoff, detached = false;
  const adapter = linuxAdapter({
    app: { isPackaged: true, getPath: () => target }, arch: 'x64', env,
    spawnProcess(command, args, options) {
      handoff = { command, args, options };
      const child = new EventEmitter();
      child.unref = () => { detached = true; };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    }
  });
  await adapter.install({ file, job: root, resultFile, pid: 12345 });
  const script = path.join(root, 'install.sh');
  assert.deepEqual(fs.readFileSync(script), fs.readFileSync(path.join(__dirname, '../updates/install-update.sh')));
  assert.equal(handoff.command, '/bin/sh');
  assert.deepEqual(handoff.args, [script, '12345', file, target, root, resultFile]);
  assert.equal(handoff.options.detached, true);
  assert.equal(handoff.options.env.PATH, '/usr/bin');
  assert.equal(handoff.options.env.LD_LIBRARY_PATH, undefined);
  assert.equal(handoff.options.env.APPDIR, undefined);
  assert.equal(handoff.options.env.DBUS_SESSION_BUS_ADDRESS, 'session');
  assert.equal(detached, true);
  assert.equal(env.APPDIR, '/tmp/.mount_Limits', 'launching does not mutate the app environment');
});

test('the real Linux helper replaces an AppImage and restores it after a failed launch', { skip: process.platform !== 'linux' }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-linux-helper-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const fail of [false, true]) {
    const dir = path.join(root, String(fail)); fs.mkdirSync(dir);
    const target = path.join(dir, "Limits user's $file.AppImage"), job = path.join(dir, 'job'); fs.mkdirSync(job);
    const source = path.join(job, 'new.AppImage'), marker = path.join(dir, 'marker'), result = path.join(dir, 'result.json');
    fs.writeFileSync(target, '#!/bin/sh\nprintf old > "$LIMITS_TEST_MARKER"\nsleep 3\n', { mode: 0o755 });
    fs.writeFileSync(source, fail ? '#!/bin/sh\nexit 13\n' : '#!/bin/sh\nprintf new > "$LIMITS_TEST_MARKER"\nsleep 3\n');
    const output = spawnSync('/bin/sh', [path.join(__dirname, '../updates/install-update.sh'), '999999999', source, target, job, result], { env: { ...process.env, LIMITS_TEST_MARKER: marker }, timeout: 10000, encoding: 'utf8' });
    assert.equal(output.status, fail ? 1 : 0, output.stderr);
    assert.equal(JSON.parse(fs.readFileSync(result)).status, fail ? 'failed' : 'installed');
    assert.match(fs.readFileSync(target, 'utf8'), fail ? /printf old/ : /printf new/);
    assert.equal(fs.existsSync(job), false);
  }
});
