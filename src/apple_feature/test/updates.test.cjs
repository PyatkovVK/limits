'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { AppleUpdates, assetUrl, checksumFor, validateArchiveListing, download, responseFor } = require('../updates.cjs');
const release = { version: '1.5.0', tag: 'v1.5', url: 'https://github.com/PyatkovVK/limits/releases/tag/v1.5' };
const urlFor = name => `https://github.com/PyatkovVK/limits/releases/download/v1.5/${name}`;
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, { tampered = false, signed = false, badTeam = false, arch = 'arm64' } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'limits-mac-update-test-')));
  const target = path.join(root, 'Limits.app'); fs.mkdirSync(target);
  let quit = 0, spawns = 0;
  const commands = [], requests = [];
  const archive = Buffer.from('verified archive fixture');
  const name = `Limits-1.5.0-${arch}.zip`;
  const digest = createHash('sha256').update(archive).digest('hex');
  const asset = name => ({ name, size: archive.length, browser_download_url: urlFor(name) });
  const updater = new AppleUpdates({ root, currentVersion: '1.4.0', arch, applicationDirectories: [root],
    app: { isPackaged: true, getPath: () => path.join(target, 'Contents/MacOS/Limits'), quit: () => quit++ },
    fetchImpl: async (url, options) => {
      requests.push(url); assert.ok(options.signal); assert.equal(options.credentials, 'omit');
      if (url.includes('/releases/tags/')) return Response.json({ tag_name: release.tag, draft: false, prerelease: false, assets: [asset(name), asset('SHA256SUMS.txt')] });
      if (url.endsWith('SHA256SUMS.txt')) return new Response(`${digest}  ${name}\n`);
      return new Response(tampered ? Buffer.from('different archive') : archive);
    },
    runCommand: async (command, args) => {
      commands.push([command, args]);
      if (command.endsWith('/unzip')) return { stdout: 'Limits.app/Contents/Info.plist\nLimits.app/Contents/MacOS/Limits\n' };
      if (command.endsWith('/ditto')) fs.mkdirSync(path.join(args.at(-1), 'Limits.app'));
      if (command.endsWith('/plutil')) return { stdout: { CFBundleIdentifier: 'dev.codexlimits.desktop', CFBundleShortVersionString: '1.5.0', CFBundleExecutable: 'Limits' }[args[1]] };
      if (command.endsWith('/codesign')) return { stdout: '', stderr: `TeamIdentifier=${signed ? badTeam && args.at(-1) !== target ? 'OTHERTEAM' : 'LIMITSTEAM' : 'not set'}\n` };
      return { stdout: '', stderr: '' };
    },
    spawnProcess: (command, args, options) => {
      spawns++; assert.equal(command, '/bin/sh'); assert.equal(options.detached, true);
      assert.equal(args[3], target); assert.equal(fs.existsSync(args[0]), true);
      const child = new EventEmitter(); child.unref = () => {};
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });
  t.after(() => { updater.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, updater, commands, requests, counts: () => ({ quit, spawns }) };
}

test('macOS prepares the correct verified ZIP, coalesces downloads and installs only on request', async t => {
  for (const arch of ['arm64', 'x64']) {
    const { updater, commands, requests, counts } = fixture(t, { arch });
    updater.state.release = release;
    const pending = updater.prepare(release);
    assert.equal(updater.prepare(release), pending);
    await pending;
    assert.equal(updater.snapshot().installation.status, 'ready');
    assert.deepEqual(counts(), { quit: 0, spawns: 0 });
    assert.ok(requests.some(url => url.endsWith(`Limits-1.5.0-${arch}.zip`)));
    assert.ok(commands.some(([command, args]) => command.endsWith('/lipo') && args[1] === (arch === 'arm64' ? 'arm64' : 'x86_64')));
    assert.ok(commands.some(([command, args]) => command.endsWith('/codesign') && args.includes('--strict')));
    const result = await updater.openRelease();
    assert.equal(result.installing, true);
    assert.deepEqual(counts(), { quit: 1, spawns: 1 });
  }
});

test('damaged downloads and a changed signing team cannot be installed', async t => {
  for (const options of [{ tampered: true }, { signed: true, badTeam: true }]) {
    const { updater, commands, counts } = fixture(t, options);
    updater.state.release = release; await updater.prepare(release);
    assert.equal(updater.snapshot().installation.error, 'invalidPackage');
    assert.equal(updater.job, undefined);
    assert.deepEqual(counts(), { quit: 0, spawns: 0 });
    if (options.tampered) assert.ok(!commands.length, 'never extract an unverified download');
  }
});

test('package URLs, checksum manifests, redirects and archive paths are restricted', async () => {
  assert.equal(assetUrl({ name: 'SHA256SUMS.txt', browser_download_url: urlFor('SHA256SUMS.txt') }, release), urlFor('SHA256SUMS.txt'));
  for (const url of ['http://github.com/x', 'https://evil.test/file', `${urlFor('SHA256SUMS.txt')}?token=x`]) {
    assert.throws(() => assetUrl({ name: 'SHA256SUMS.txt', browser_download_url: url }, release));
  }
  assert.throws(() => checksumFor('a'.repeat(64) + '  a.zip\n' + 'b'.repeat(64) + '  a.zip', 'a.zip'));
  for (const list of ['../Limits.app/x', 'Limits.app/../../escape', '/Limits.app/a', 'Other.app/a']) assert.throws(() => validateArchiveListing(list));
  validateArchiveListing('Limits.app/Contents/Info.plist\n');
  await assert.rejects(responseFor(urlFor('a.zip'), { signal: new AbortController().signal,
    fetchImpl: async () => new Response('', { status: 302, headers: { location: 'https://evil.test/package' } }) }), /invalidPackage/);
});

test('bounded streaming rejects oversized data and an aborted download cannot become ready', async t => {
  const { updater, root } = fixture(t);
  await assert.rejects(download(urlFor('large.zip'), path.join(root, 'large'), { signal: new AbortController().signal,
    fetchImpl: async () => new Response('too much data'), maxBytes: 4 }), /invalidPackage/);
  updater.fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  const task = updater.prepare(release); await tick(); updater.stop(); await task;
  assert.notEqual(updater.snapshot().installation.status, 'ready');
});

test('the real macOS installation helper replaces a bundle and restores the old one when launch fails', { skip: process.platform !== 'darwin' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-install-helper-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const fail of [false, true]) {
    const area = path.join(root, String(fail)); fs.mkdirSync(area);
    const target = path.join(area, 'Limits.app'); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'version'), 'old');
    const job = path.join(area, 'download-job'); fs.mkdirSync(job);
    const source = path.join(job, 'Limits.app'); fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'version'), 'new');
    const opener = path.join(area, 'open'); fs.writeFileSync(opener, `#!/bin/sh\nexit ${fail ? 1 : 0}\n`, { mode: 0o700 });
    const script = path.join(area, 'install.sh');
    fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, '../install-update.sh'), 'utf8').replaceAll('/usr/bin/open', `"${opener}"`));
    const result = path.join(area, 'result.json');
    const output = spawnSync('/bin/sh', [script, '999999999', source, target, job, result]);
    assert.equal(output.status, fail ? 1 : 0, output.stderr.toString());
    assert.equal(fs.readFileSync(path.join(target, 'version'), 'utf8'), fail ? 'old' : 'new');
    assert.equal(JSON.parse(fs.readFileSync(result)).status, fail ? 'failed' : 'installed');
    assert.equal(fs.existsSync(job), false);
  }
});
