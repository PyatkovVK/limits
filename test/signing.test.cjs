'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { configureSigning } = require('../scripts/signing.cjs');
const { verifySigning } = require('../scripts/verify-signing.cjs');
const signResources = require('../scripts/sign-windows-resources.cjs');
const { configureAppleBuild } = require('../src/apple_feature/scripts/build-config.cjs');
const pkg = require('../package.json');
const config = () => structuredClone(pkg.build);
test('local builds stay available without credentials while releases reject missing credentials', () => {
  const win = config(); configureSigning(win, 'win', {});
  assert.equal(win.win.signExecutable, false); assert.equal(win.win.forceCodeSigning, false);
  const mac = config(); configureAppleBuild(mac, {}); configureSigning(mac, 'mac', {});
  assert.equal(mac.mac.identity, '-'); assert.equal(mac.mac.notarize, false);
  assert.throws(() => configureSigning(config(), 'win', { CODEX_LIMITS_RELEASE: '1' }), /WIN_CSC_LINK/);
  assert.throws(() => configureSigning(config(), 'mac', { CODEX_LIMITS_RELEASE: '1' }), /CSC_LINK/);
  assert.throws(() => configureSigning(config(), 'mac', { CODEX_LIMITS_RELEASE: '1', CSC_LINK: 'dummy-certificate' }), /notarization/);
  assert.throws(() => configureSigning(config(), 'mac', { CODEX_LIMITS_RELEASE: '1', CSC_NAME: '-' }), /Developer ID/);
  const linux = config(); assert.equal(configureSigning(linux, 'linux', { CODEX_LIMITS_RELEASE: '1' }), true);
  assert.deepEqual(linux, config());
});
test('signed release configurations validate and never serialize signing secrets', async () => {
  const { validateConfiguration } = require('app-builder-lib/out/util/config/config');
  const win = config(); configureSigning(win, 'win', { CODEX_LIMITS_RELEASE: '1', WIN_CSC_LINK: 'dummy-private-certificate' });
  assert.equal(win.win.forceCodeSigning, true); assert.equal(win.win.signExecutable, true);
  assert.equal(win.afterPack, path.resolve(__dirname, '../scripts/sign-windows-resources.cjs'));
  await validateConfiguration(win);
  for (const credentials of [
    { APPLE_ID: 'dummy', APPLE_APP_SPECIFIC_PASSWORD: 'dummy', APPLE_TEAM_ID: 'dummy' },
    { APPLE_API_KEY: 'dummy', APPLE_API_KEY_ID: 'dummy', APPLE_API_ISSUER: 'dummy' },
    { APPLE_KEYCHAIN: 'dummy', APPLE_KEYCHAIN_PROFILE: 'dummy' }
  ]) {
    const mac = config(); configureAppleBuild(mac, { CSC_LINK: 'dummy-private-certificate' });
    configureSigning(mac, 'mac', { CODEX_LIMITS_RELEASE: '1', CSC_LINK: 'dummy-private-certificate', ...credentials });
    assert.equal(mac.mac.forceCodeSigning, true); assert.equal(mac.mac.hardenedRuntime, true); assert.equal(mac.mac.notarize, true);
    assert.ok(mac.mac.binaries.includes('Contents/Resources/apple-screen-info'));
    assert.ok(!JSON.stringify(mac).includes('dummy-private-certificate')); await validateConfiguration(mac);
  }
});
test('release workflow can build without certificates while configured signing remains mandatory', async () => {
  const { validateConfiguration } = require('app-builder-lib/out/util/config/config');
  const env = { CODEX_LIMITS_RELEASE: '1', CODEX_LIMITS_ALLOW_UNSIGNED: '1' };
  const win = config();
  assert.equal(configureSigning(win, 'win', env), false);
  assert.equal(win.win.signExecutable, false);
  assert.equal(win.win.forceCodeSigning, false);
  assert.equal(win.afterPack, undefined);
  await validateConfiguration(win);
  const mac = config();
  configureAppleBuild(mac, env);
  assert.equal(configureSigning(mac, 'mac', env), false);
  assert.equal(mac.mac.identity, '-');
  assert.equal(mac.mac.forceCodeSigning, false);
  assert.equal(mac.mac.hardenedRuntime, false);
  assert.equal(mac.mac.notarize, false);
  await validateConfiguration(mac);

  const signedWin = config();
  assert.equal(configureSigning(signedWin, 'win', { ...env, WIN_CSC_LINK: 'dummy-certificate' }), true);
  assert.equal(signedWin.win.signExecutable, true);
  assert.equal(signedWin.win.forceCodeSigning, true);
  assert.ok(signedWin.afterPack);
  await validateConfiguration(signedWin);
  const certificate = { ...env, CSC_LINK: 'dummy-certificate' };
  assert.throws(() => configureSigning(config(), 'mac', certificate), /notarization/);
  const signedMac = config();
  configureAppleBuild(signedMac, certificate);
  assert.equal(configureSigning(signedMac, 'mac', { ...certificate,
    APPLE_ID: 'dummy', APPLE_APP_SPECIFIC_PASSWORD: 'dummy', APPLE_TEAM_ID: 'dummy' }), true);
  assert.equal(signedMac.mac.forceCodeSigning, true);
  assert.equal(signedMac.mac.hardenedRuntime, true);
  assert.equal(signedMac.mac.notarize, true);
  await validateConfiguration(signedMac);
  assert.throws(() => configureSigning(config(), 'mac', { ...env, CSC_NAME: '-' }), /Developer ID/);
});

test('Windows extraResources must both be signed successfully', async () => {
  // Load the builder entry point before a platform implementation to avoid its circular imports.
  require('app-builder-lib');
  const { WinPackager } = require('app-builder-lib/out/winPackager');
  assert.equal(typeof WinPackager.prototype.signIf, 'function', 'hook must use the installed builder API');
  const signed = []; const appOutDir = path.resolve('artifacts', 'win-unpacked');
  await signResources({ electronPlatformName: 'win32', appOutDir, packager: { signIf: async file => { signed.push(file); return true; } } });
  assert.deepEqual(signed, [path.join(appOutDir, 'resources', 'taskbar-helper.exe'), path.join(appOutDir, 'resources', 'codex', 'codex.exe')]);
  await assert.rejects(signResources({ electronPlatformName: 'win32', appOutDir, packager: { signIf: async () => false } }), /Could not sign/);
});
test('Windows verification passes paths as data and rejects a failed native signature check', () => {
  const output = path.resolve('artifacts', "release ' $special");
  const fileSystem = { readdirSync: () => ['Limits-1-portable.exe', 'Limits-Setup-1.exe'] };
  let call;
  verifySigning(output, 'win', 'x64', { fileSystem, env: {}, run: (...args) => { call = args; return { status: 0 }; } });
  assert.equal(call[0], 'powershell.exe');
  assert.ok(!call[1].join(' ').includes(output));
  assert.equal(JSON.parse(call[2].env.LIMITS_SIGNING_FILES).length, 5);
  assert.throws(() => verifySigning(output, 'win', 'x64', { fileSystem, run: () => ({ status: 1 }) }), /verification failed/);
  assert.throws(() => verifySigning(output, 'win', 'x64', { fileSystem: { readdirSync: () => [] } }), /Both Windows/);
});
test('macOS verification rejects ad hoc signing and requires runtime, Gatekeeper and stapled ticket checks', () => {
  const output = path.resolve('artifacts', 'signed-mac'); const calls = [];
  const run = (command, args) => {
    calls.push([command, args]);
    return { status: 0, stderr: args.includes('--display') ? 'Authority=Developer ID Application: Example\nflags=0x10000(runtime)' : '' };
  };
  verifySigning(output, 'mac', 'arm64', { run });
  assert.ok(calls.some(([cmd]) => cmd === 'spctl')); assert.ok(calls.some(([cmd, args]) => cmd === 'xcrun' && args[0] === 'stapler'));
  assert.ok(calls[0][1].includes(path.join(output, 'mac-arm64', 'Limits.app')));
  assert.throws(() => verifySigning(output, 'mac', 'x64', { run: () => ({ status: 0, stderr: 'Signature=adhoc' }) }), /Developer ID/);
  assert.throws(() => verifySigning(output, 'mac', 'x64', { run: (cmd, args) => cmd === 'xcrun' ? { status: 1 } : run(cmd, args) }), /verification failed/);
});
