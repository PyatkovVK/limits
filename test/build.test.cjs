'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('../scripts/build-plan.cjs');
const pkg = require('../package.json');

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
