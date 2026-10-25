'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { WindowsUpdates } = require('../updates.cjs');
const release = { version: '1.5.0', tag: 'v1.5', url: 'https://github.com/PyatkovVK/limits/releases/tag/v1.5' };
function fixture(t, { portable = false, tampered = false, invalidSignature = false, duplicate = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-win-update-'));
  const target = path.join(root, 'Limits.exe'); fs.writeFileSync(target, 'original');
  const name = portable ? 'Limits-1.5.0-portable.exe' : 'Limits-Setup-1.5.0.exe';
  const content = Buffer.from('verified Windows package');
  const digest = createHash('sha256').update(content).digest('hex');
  const asset = name => ({ name, size: content.length, browser_download_url: `https://github.com/PyatkovVK/limits/releases/download/v1.5/${name}` });
  let quits = 0, spawns = 0, verifications = 0, config;
  const updater = new WindowsUpdates({ root, currentVersion: '1.4.0', arch: 'x64', env: portable ? { PORTABLE_EXECUTABLE_FILE: target } : {},
    app: { isPackaged: true, getPath: () => target, quit: () => quits++ },
    fetchImpl: async (url, options) => {
      assert.equal(options.credentials, 'omit'); assert.ok(options.signal);
      if (url.includes('/releases/tags/')) return Response.json({ tag_name: 'v1.5', draft: false, prerelease: false,
        assets: [asset(name), asset('SHA256SUMS.txt'), ...(duplicate ? [asset(name)] : [])] });
      if (url.endsWith('SHA256SUMS.txt')) return new Response(`${digest}  ${name}\n`);
      return new Response(tampered ? Buffer.from('tampered') : content);
    },
    verifyPackage: async (file, version) => { verifications++; assert.equal(version, '1.5.0'); assert.deepEqual(fs.readFileSync(file), content); if (invalidSignature) throw new Error('bad signature'); },
    spawnProcess(command, args, options) {
      spawns++; assert.equal(options.windowsHide, true); assert.equal(options.detached, true); assert.equal(options.stdio, 'ignore');
      assert.ok(command.endsWith('powershell.exe')); config = JSON.parse(fs.readFileSync(args.at(-1), 'utf8'));
      const child = new EventEmitter(); child.unref = () => {}; process.nextTick(() => child.emit('spawn')); return child;
    },
  });
  t.after(() => { updater.stop(); assert.ok(root.startsWith(os.tmpdir() + path.sep)); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, target, updater, counts: () => ({ quits, spawns, verifications }), config: () => config };
}
for (const portable of [false, true]) test(`Windows ${portable ? 'portable' : 'NSIS'} downloads, verifies and hands off only on explicit installation`, async t => {
  const { updater, target, counts, config } = fixture(t, { portable });
  updater.publish({ status: 'available', release });
  const first = updater.downloadTask; assert.equal(updater.prepare(release), first); await first;
  assert.equal(updater.snapshot().installation.status, 'ready');
  assert.deepEqual(counts(), { quits: 0, spawns: 0, verifications: 1 });
  assert.deepEqual(await updater.openRelease(), { installing: true });
  assert.deepEqual(counts(), { quits: 1, spawns: 1, verifications: 1 });
  assert.equal(config().portable, portable); assert.equal(config().target, target);
  const job = updater.job; updater.stop(); assert.equal(fs.existsSync(job), true, 'Handoff must retain helper files');
  assert.deepEqual(await updater.openRelease(), { error: 'unavailable' });
});
for (const options of [{ tampered: true }, { invalidSignature: true }, { duplicate: true }]) test(`Windows rejects an unverified update: ${JSON.stringify(options)}`, async t => {
  const { updater, counts, root } = fixture(t, options);
  updater.publish({ status: 'available', release }); await updater.downloadTask;
  assert.equal(updater.installation.error, 'invalidPackage'); assert.equal(updater.job, undefined);
  assert.equal(counts().spawns, 0); assert.equal(fs.readFileSync(path.join(root, 'Limits.exe'), 'utf8'), 'original');
});
test('Windows clears superseded packages and aborts pending downloads on quit', async t => {
  const { updater } = fixture(t);
  updater.publish({ status: 'available', release }); await updater.downloadTask;
  const job = updater.job; updater.publish({ status: 'current', release: null });
  assert.equal(fs.existsSync(job), false); assert.equal(updater.installation.status, 'idle');
  updater.fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  const pending = updater.prepare(release); await new Promise(resolve => setImmediate(resolve)); updater.stop(); await pending;
  assert.notEqual(updater.installation.status, 'ready');
});
test('Windows reports helper launch errors and allows retry without quitting', async t => {
  const { updater, counts } = fixture(t);
  updater.publish({ status: 'available', release }); await updater.downloadTask;
  updater.spawnProcess = () => { throw new Error('blocked'); };
  assert.deepEqual(await updater.openRelease(), { error: 'installFailed' }); assert.equal(counts().quits, 0);
  await updater.prepare(release); assert.equal(updater.installation.status, 'ready');
});

test('Windows PowerShell helper verifies PE metadata, replaces portable EXE and rolls back failed relaunch', { skip: process.platform !== 'win32', timeout: 45000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-native-update-'));
  t.after(() => { assert.equal(path.dirname(root), os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); });
  const csc = path.join(process.env.SystemRoot, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const ps = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const compile = (name, version, exitCode, body = `return ${exitCode};`) => {
    const file = path.join(root, name + '.exe'), source = path.join(root, name + '.cs');
    fs.writeFileSync(source, `using System; using System.IO; using System.Reflection; [assembly:AssemblyProduct("Limits")] [assembly:AssemblyInformationalVersion("${version}")] class Fixture { static int Main() { ${body} } }`);
    const built = spawnSync(csc, ['/nologo', '/target:winexe', `/out:${file}`, source], { encoding: 'utf8', windowsHide: true });
    assert.equal(built.status, 0, built.stdout + built.stderr); return file;
  };
  const old = compile('old', '1.4.0', 0), good = compile('good', '1.5.0', 0), bad = compile('bad', '1.5.0', 2);
  const bytes = fs.readFileSync(good), digest = createHash('sha256').update(bytes).digest('hex');
  const name = 'Limits-Setup-1.5.0.exe';
  const native = new WindowsUpdates({ root, currentVersion: '1.4.0', arch: 'x64', env: {},
    app: { isPackaged: true, getPath: () => old }, fetchImpl: async url => {
      if (url.includes('/releases/tags/')) return Response.json({ tag_name: 'v1.5', draft: false, prerelease: false, assets: [name, 'SHA256SUMS.txt'].map(name => ({name, size: bytes.length, browser_download_url: `https://github.com/PyatkovVK/limits/releases/download/v1.5/${name}`})) });
      return url.endsWith('SHA256SUMS.txt') ? new Response(`${digest}  ${name}\n`) : new Response(bytes);
    } });
  native.publish({ status: 'available', release }); await native.downloadTask;
  assert.equal(native.installation.status, 'ready', JSON.stringify(native.installation)); native.stop();
  const target = path.join(root, 'Portable app with spaces.exe');
  const helper = path.resolve(__dirname, '../install-update.ps1');
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const runHelper = file => {
    fs.copyFileSync(old, target);
    const config = path.join(root, 'install.json'), result = path.join(root, 'result.json');
    // Use a PID which cannot exist, so this test never waits for the test runner.
    fs.writeFileSync(config, JSON.stringify({ pid: 2147483647, target, package: file, sha256: hash(file), version: '1.5.0', portable: true, result }));
    return spawnSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Config', config], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  };
  let result = runHelper(good); assert.equal(result.status, 0, result.stderr); assert.equal(hash(target), hash(good));
  result = runHelper(bad); assert.equal(result.status, 1, result.stderr); assert.equal(hash(target), hash(old));
  const installer = compile('installer', '1.5.0', 0, `string command = Environment.CommandLine; string directory = command.Substring(command.IndexOf("/D=") + 3); File.Copy(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "good.exe"), Path.Combine(directory, "Limits.exe"), true); File.WriteAllText(Path.Combine(directory, "arguments.txt"), command); return 0;`);
  const installed = path.join(root, 'Installed app with spaces'); fs.mkdirSync(installed);
  const installedExe = path.join(installed, 'Limits.exe'); fs.copyFileSync(old, installedExe);
  const config = path.join(root, 'nsis.json');
  fs.writeFileSync(config, JSON.stringify({ pid: 2147483647, target: installedExe, package: installer, sha256: hash(installer), version: '1.5.0', portable: false, result: path.join(root, 'nsis-result.json') }));
  result = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Config', config], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); assert.equal(hash(installedExe), hash(good));
  const argumentsText = fs.readFileSync(path.join(installed, 'arguments.txt'), 'utf8');
  assert.ok(argumentsText.trimEnd().endsWith(`/S --updated /D=${installed}`), argumentsText);
  const rejected = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-VerifyOnly', '-Package', old, '-Current', old, '-Version', '1.5.0'], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(rejected.status, 0);
});
