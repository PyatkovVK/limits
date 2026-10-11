'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('../scripts/build-plan.cjs');
const pkg = require('../package.json');
const path = require('node:path');
const { bundleCodex } = require('../scripts/bundle-codex.cjs');
const { findCodex } = require('../src/common/codex-path.cjs');

test('Windows bundles a matching standalone runtime and license without changing Mac or Linux resources', async () => {
  const { validateConfiguration } = require('app-builder-lib/out/util/config/config');
  for (const [platform, key, arch, triple] of [
    ['win32', 'win', 'x64', 'x86_64-pc-windows-msvc'],
    ['win32', 'win', 'arm64', 'aarch64-pc-windows-msvc']
  ]) {
    const config = structuredClone(pkg.build);
    const previous = [...(config[key].extraResources || [])];
    const base = path.resolve('artifacts', `codex-${platform}-${arch}`);
    const exe = platform === 'win32' ? 'codex.exe' : 'codex';
    const source = path.join(base, 'vendor', triple, 'bin', exe);
    const resolvePackage = name => {
      assert.equal(name, `@openai/codex-${platform}-${arch}/package.json`);
      return path.join(base, 'package.json');
    };
    const fileSystem = {
      statSync(file) { return { isFile: () => file === source || file.endsWith('Apache-2.0.txt') }; }
    };
    assert.equal(bundleCodex(config, { platform, arch, resolvePackage, fileSystem }), source);
    assert.deepEqual(config[key].extraResources.slice(0, previous.length), previous);
    assert.deepEqual(config[key].extraResources.slice(-2).map(file => file.to), [`codex/${exe}`, 'codex/Apache-2.0.txt']);
    assert.equal(config.extraResources.length, pkg.build.extraResources.length);
    assert.deepEqual(config.mac, pkg.build.mac);
    assert.deepEqual(config.linux, pkg.build.linux);
    await validateConfiguration(config);

    // An installed app can find its own runtime with no PATH or npm packages.
    const resourcesPath = path.resolve('artifacts', 'resources');
    const bundled = path.join(resourcesPath, 'codex', exe);
    assert.equal(findCodex({ platform, arch, env: { PATH: '' }, resourcesPath,
      resolvePackage() { throw new Error('No npm installed'); },
      fileSystem: { statSync(file) { return { isFile: () => file === bundled }; }, accessSync() {} }
    }), bundled);
  }
});

test('missing target runtime stops packaging instead of producing an app that requires Codex', () => {
  const config = structuredClone(pkg.build);
  assert.throws(() => bundleCodex(config, { platform: 'linux', arch: 'ia32' }), /Unsupported/);
  for (const platform of ['darwin', 'linux']) assert.throws(() => bundleCodex(config, { platform, arch: 'x64' }), /Unsupported Windows runtime/);
  assert.throws(() => bundleCodex(config, { platform: 'win32', arch: 'arm64', resolvePackage() { throw new Error('Missing'); } }), /codex-win32-arm64/);
  assert.throws(() => bundleCodex(config, { platform: 'win32', arch: 'x64',
    resolvePackage: () => path.resolve('artifacts', 'package.json'), fileSystem: { statSync() { throw new Error('Missing'); } }
  }), /executable/);
});

test('Mac and Linux builds default to native architecture and accept explicit x64/arm64', () => {
  assert.deepEqual(buildPlan('mac', [], { platform: 'darwin', arch: 'arm64' }).args, ['--mac', '--arm64', '--publish=never']);
  assert.equal(buildPlan('mac', ['--x64'], { platform: 'darwin', arch: 'arm64' }).arch, 'x64');
  assert.deepEqual(buildPlan('linux', [], { platform: 'linux', arch: 'x64' }).args, ['--linux', '--x64', '--publish=never']);
  assert.equal(buildPlan('linux', ['--arm64'], { platform: 'linux', arch: 'x64' }).arch, 'arm64');
  assert.throws(() => buildPlan('mac', [], { platform: 'win32', arch: 'x64' }), /on macOS/);
  assert.throws(() => buildPlan('linux', ['--publish=always'], { platform: 'linux', arch: 'x64' }), /architecture/);
});
test('builder accepts all platform configurations and scopes the Win32 executable to Windows', async () => {
  const { validateConfiguration } = require('app-builder-lib/out/util/config/config');
  await validateConfiguration(pkg.build);
  assert.ok(!pkg.build.extraResources.some(file => file.to.endsWith('.exe')));
  assert.ok(pkg.build.win.extraResources.some(file => file.to === 'taskbar-helper.exe'));
});
test('Debian packaging accepts project metadata without a fabricated author email', async () => {
  const FpmTarget = require('app-builder-lib/out/targets/FpmTarget').default;
  const metadata = await FpmTarget.prototype.computeFpmMetaInfoOptions.call({ options: pkg.build.linux, packager: { appInfo: { computePackageUrl: async () => pkg.homepage, linuxPackageName: pkg.name }, info: { metadata: pkg } } });
  assert.equal(metadata.maintainer, pkg.build.linux.maintainer);
  assert.equal(metadata.url, pkg.homepage);
});
