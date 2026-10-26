'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createHash } = require('node:crypto'), { EventEmitter } = require('node:events');
const { PackageUpdates } = require('../src/common/package-updates.cjs');
const { LinuxUpdates } = require('../src/linux_feature/updates.cjs');
const release = { version: '1.5.0', tag: 'v1.5', url: 'https://github.com/PyatkovVK/limits/releases/tag/v1.5' };
function pe() { const value = Buffer.alloc(128); value.write('MZ'); value.writeUInt32LE(64, 60); value.write('PE', 64); value.writeUInt16LE(0x14c, 68); return value; }
function image() { const value = Buffer.alloc(128); Buffer.from('7f454c460201', 'hex').copy(value); Buffer.from('414902', 'hex').copy(value, 8); value.writeUInt16LE(62, 18); return value; }
function setup(t, platform, portable = true) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'limits-package-update-')));
  const target = path.join(root, platform === 'linux' ? 'Limits.AppImage' : 'Limits.exe'); fs.writeFileSync(target, 'old');
  const name = platform === 'linux' ? 'Limits-1.5.0-x86_64.AppImage' : portable ? 'Limits-1.5.0-portable.exe' : 'Limits-Setup-1.5.0.exe';
  const bytes = platform === 'linux' ? image() : pe();
  const digest = createHash('sha256').update(bytes).digest('hex');
  const asset = name => ({ name, size: bytes.length, browser_download_url: `https://github.com/PyatkovVK/limits/releases/download/v1.5/${name}` });
  let quit = 0, installs = 0; const commands = [];
  const options = { root, arch: 'x64', currentVersion: '1.4.0', app: { isPackaged: true, getPath: () => target, quit: () => quit++ },
    env: platform === 'linux' ? { APPIMAGE: target, PATH: '/usr/bin:/bin' } : portable ? { PORTABLE_EXECUTABLE_FILE: target } : {},
    fetchImpl: async (url, options) => {
      assert.equal(options.credentials, 'omit'); assert.ok(options.signal);
      if (url.includes('/releases/tags/')) return Response.json({ tag_name: release.tag, draft: false, prerelease: false, assets: [asset(name), asset('SHA256SUMS.txt')] });
      if (url.endsWith('SHA256SUMS.txt')) return new Response(`${digest}  ${name}\n`);
      return new Response(bytes);
    },
    runCommand: async (command, args, options) => { commands.push({ command, args, options }); return { stdout: '' }; },
    spawnProcess: (command, args, options) => {
      installs++; commands.push({ command, args, options });
      const child = new EventEmitter(); child.unref = () => {}; queueMicrotask(() => child.emit('spawn')); return child;
    }
  };
  const updater = new LinuxUpdates(options);
  updater.state.release = release;
  t.after(() => { updater.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  return { updater, root, target, name, bytes, commands, counts: () => ({ quit, installs }) };
}
test('native package selection downloads, verifies and coalesces without installing before the action', async t => {
  for (const platform of ['linux']) for (const portable of platform === 'win32' ? [true, false] : [true]) {
    const { updater, name, commands, counts } = setup(t, platform, portable);
    const pending = updater.prepare(release); assert.equal(updater.prepare(release), pending); await pending;
    assert.equal(updater.installation.status, 'ready'); assert.equal(path.basename(updater.packageFile), name);
    assert.deepEqual(counts(), { quit: 0, installs: 0 });
    const result = await updater.openRelease(); assert.equal(result.installing, true); assert.deepEqual(counts(), { quit: 1, installs: 1 });
    const handoff = commands.at(-1); assert.equal(handoff.options.detached, true);
    assert.equal(fs.existsSync(handoff.args[0] === '-NoProfile' ? handoff.args[5] : handoff.args[0]), true);
  }
});
test('tampered payloads are rejected before native verification or handoff, and retry can recover', async t => {
  const { updater, bytes, commands, counts } = setup(t, 'linux');
  const original = updater.fetchImpl;
  updater.fetchImpl = async (url, options) => url.endsWith('.AppImage') ? new Response(Buffer.alloc(bytes.length)) : original(url, options);
  await updater.prepare(release); assert.equal(updater.installation.error, 'invalidPackage'); assert.equal(commands.length, 0);
  assert.deepEqual(counts(), { quit: 0, installs: 0 });
  updater.fetchImpl = original; await updater.prepare(release); assert.equal(updater.installation.status, 'ready');
  fs.writeFileSync(updater.packageFile, 'changed after download');
  assert.equal((await updater.openRelease()).error, 'invalidPackage'); assert.deepEqual(counts(), { quit: 0, installs: 0 });
});
test('a current-version result discards a prepared package and shutdown cancels in-flight networking', async t => {
  const { updater } = setup(t, 'linux');
  updater.publish({ status: 'available', release }); await updater.downloadTask;
  const file = updater.packageFile; assert.equal(fs.existsSync(file), true);
  updater.publish({ status: 'current', release: null }); assert.equal(fs.existsSync(file), false); assert.equal(updater.installation.status, 'idle');
  updater.fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  const pending = updater.prepare(release); await new Promise(resolve => setImmediate(resolve)); updater.stop(); await pending;
  assert.notEqual(updater.installation.status, 'ready');
});
test('source builds retain manual release opening and demo installation has no native side effects', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-update-demo-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const demo of [false, true]) {
    let opened = 0;
    const updater = new PackageUpdates({ root, currentVersion: '1.4.0', demo, adapter: { enabled: false }, openExternal: async () => opened++ });
    t.after(() => updater.stop()); updater.state.release = release;
    if (demo) { await updater.prepare(release); assert.equal((await updater.openRelease()).simulated, true); assert.equal(opened, 0); }
    else { assert.equal((await updater.openRelease()).opened, true); assert.equal(opened, 1); }
  }
});
