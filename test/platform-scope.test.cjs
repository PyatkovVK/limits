'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const pkg = require('../package.json');
const i18n = require('../src/common/renderer/i18n.js');
const { buildPlan } = require('../scripts/build/build-plan.cjs');
const { configureAppleBuild } = require('../src/apple_feature/scripts/build-config.cjs');
const { offerSignIn } = require('../src/windows_feature/ai-connects/codex/sign-in-prompt.cjs');
const { signingEnvironment } = require('../scripts/signing/signing.cjs');

function runBuild(target, requireMock, process) {
  const dirname = path.resolve(__dirname, '../scripts/build');
  const load = name => {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(dirname, name), 'utf8'), {
      module, require: mockedRequire, __dirname: dirname, structuredClone, process,
      console: { log() {}, error: assert.fail }
    });
    return module.exports;
  };
  const mockedRequire = name => name === './build-unix.cjs' ? load(name) : requireMock(name);
  mockedRequire.resolve = requireMock.resolve;
  load((target === 'win' ? 'windows' : target) + '.cjs');
}

test('Mac and Linux build entrypoints bundle the target runtime and preserve platform resources', () => {
  for (const [target, platform, arch] of [['mac', 'darwin', 'arm64'], ['mac', 'darwin', 'x64'], ['linux', 'linux', 'x64'], ['linux', 'linux', 'arm64']]) {
    let captured;
    let preparedAssets = false;
    const config = structuredClone(pkg.build);
    const output = path.resolve('artifacts', 'limits-build-scope-test');
    const modules = {
      'node:fs': { existsSync: () => true, mkdtempSync: () => output, mkdirSync() {}, readdirSync: () => [], rmSync() {}, writeFileSync: (_file, data) => { captured = JSON.parse(data); } },
      'node:path': path,
      'node:os': { tmpdir: () => path.dirname(output) },
      'node:child_process': { spawnSync: () => ({ status: 0 }) },
      './build-plan.cjs': { buildPlan: (target, flags) => buildPlan(target, flags, { platform, arch }) },
      '../signing/signing.cjs': { configureSigning: () => false, signingEnvironment },
      '../prepare/bundle-codex.cjs': { bundleCodex(_config, options) { assert.equal(options.platform, platform); assert.equal(options.arch, arch); } },
      '../prepare/assets.cjs': {},
      '../../package.json': pkg,
      ...(target === 'mac' ? {
        '../../src/apple_feature/scripts/build-helper.cjs': { buildHelper() {} },
        '../../src/apple_feature/scripts/build-config.cjs': { configureAppleBuild: config => configureAppleBuild(config, {}) },
      } : {}),
    };
    const requireMock = name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected build dependency: ${name}`);
      if (name === '../prepare/assets.cjs') preparedAssets = true;
      return modules[name];
    };
    requireMock.resolve = name => path.resolve('node_modules', name);
    runBuild(target, requireMock, { argv: ['node', target, '--' + arch], platform, arch, env: {} });
    if (target === 'mac') configureAppleBuild(config, {});
    config.directories.output = output;
    config.electronDist = path.join(path.dirname(requireMock.resolve('electron/package.json')), 'dist');
    assert.deepEqual(captured, config);
    assert.ok(preparedAssets);
    assert.ok(![...captured.extraResources, ...(captured[target].extraResources || [])].some(file => file.to.startsWith('codex/')));
  }
});

test('packaging reaches electron-builder with an absent Electron dist and only reuses native runtimes', async () => {
  const { validateConfiguration } = require('app-builder-lib/out/util/config/config');
  const { getElectronVersion } = require('app-builder-lib/out/electron/electronVersion');
  for (const [target, platform, hostArch, targetArch] of [
    ['linux', 'linux', 'x64', 'x64'], ['linux', 'linux', 'x64', 'arm64'],
    ['mac', 'darwin', 'arm64', 'arm64'], ['mac', 'darwin', 'arm64', 'x64'],
    ['mac', 'darwin', 'x64', 'x64'],
    ['win', 'win32', 'x64', 'x64'], ['win', 'win32', 'arm64', 'x64']
  ]) {
    for (const installed of [false, true]) {
      const output = path.resolve('artifacts', 'limits-build-electron-test');
      const electronDist = path.resolve('node_modules', 'electron', 'dist');
      let captured;
      let builderArgs;
      const modules = {
        'node:fs': {
          existsSync(file) { assert.equal(file, path.join(electronDist, 'version')); return installed; },
          mkdtempSync: () => output, mkdirSync() {}, readdirSync: () => [], rmSync() {},
          writeFileSync: (_file, data) => { captured = JSON.parse(data); }
        },
        'node:path': path, 'node:os': { tmpdir: () => path.dirname(output) },
        'node:child_process': { spawnSync: (_exe, args) => { builderArgs = args; return { status: 0 }; } },
        './build-plan.cjs': { buildPlan: (target, flags) => buildPlan(target, flags, { platform, arch: hostArch }) },
        '../signing/signing.cjs': { configureSigning: () => false, signingEnvironment },
        '../../package.json': pkg,
        '../prepare/assets.cjs': {},
        ...(target === 'win' ? { '../../src/windows_feature/scripts/build-taskbar-helper.cjs': {} } : {}),
        ...(target === 'mac' ? {
          '../../src/apple_feature/scripts/build-helper.cjs': { buildHelper() {} },
          '../../src/apple_feature/scripts/build-config.cjs': { configureAppleBuild: config => configureAppleBuild(config, {}) },
        } : {}),
        '../prepare/bundle-codex.cjs': { bundleCodex(_config, options) { assert.equal(options.platform, platform); assert.equal(options.arch, targetArch); } }
      };
      const requireMock = name => {
        assert.ok(Object.hasOwn(modules, name), `Unexpected build dependency: ${name}`);
        return modules[name];
      };
      requireMock.resolve = name => {
        // Only package metadata is guaranteed to exist after npm install Electron 44.
        assert.ok(['electron/package.json', 'electron-builder/package.json'].includes(name), name);
        return path.resolve('node_modules', name);
      };
      runBuild(target, requireMock, { argv: ['node', target, ...(target === 'win' ? [] : ['--' + targetArch])],
        platform, arch: hostArch, execPath: process.execPath, env: {}, exit(code) { assert.fail('Build exited: ' + code); } });
      assert.equal(captured.electronDist, installed && hostArch === targetArch ? electronDist : undefined);
      assert.deepEqual(Array.from(builderArgs), [path.resolve('node_modules', 'electron-builder', 'cli.js'),
        `--${target}`, `--${targetArch}`, '--publish=never', `--config=${path.join(output, 'build-config.json')}`]);
      await validateConfiguration(captured);
      assert.equal(await getElectronVersion(path.resolve(__dirname, '..'), captured), pkg.devDependencies.electron);
    }
  }
});

test('all packaged platforms describe the included connection component', () => {
  for (const platform of ['win32', 'linux', 'darwin', undefined]) {
    assert.equal(i18n.t('ru', 'account', platform), 'Аккаунт ChatGPT');
    assert.equal(i18n.t('en', 'codexMissing', platform), 'The connection component was not found. Reinstall Limits.');
    assert.equal(i18n.t('ru', 'loginUnavailable', platform), 'Вход временно недоступен. Перезапустите Limits.');
  }
});

test('Windows onboarding offers sign-in once and preserves panel dismissal during polling', () => {
  const accounts = new EventEmitter();
  let openings = 0;
  offerSignIn(accounts, () => { openings++; });
  for (const status of ['connecting', 'ready', 'error']) accounts.emit('state', { status });
  assert.equal(openings, 0);
  accounts.emit('state', { status: 'signed-out' });
  assert.equal(openings, 1);
  for (const status of ['signed-out', 'signing-in', 'signed-out']) accounts.emit('state', { status });
  assert.equal(openings, 1);
});
