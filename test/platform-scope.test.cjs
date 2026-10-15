'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const pkg = require('../package.json');
const i18n = require('../src/common/renderer/i18n.js');
const { buildPlan } = require('../scripts/build-plan.cjs');
const { configureAppleBuild } = require('../src/apple_feature/scripts/build-config.cjs');
const { offerSignIn } = require('../src/windows_feature/onboarding.cjs');
const { signingEnvironment } = require('../scripts/signing.cjs');

test('Mac and Linux build entrypoint bundles the target runtime and preserves platform resources', () => {
  for (const [target, platform, arch] of [['mac', 'darwin', 'arm64'], ['mac', 'darwin', 'x64'], ['linux', 'linux', 'x64'], ['linux', 'linux', 'arm64']]) {
    let captured;
    const config = structuredClone(pkg.build);
    const output = path.resolve('artifacts', 'limits-build-scope-test');
    const modules = {
      'node:fs': { existsSync: () => true, mkdtempSync: () => output, mkdirSync() {}, readdirSync: () => [], rmSync() {}, writeFileSync: (_file, data) => { captured = JSON.parse(data); } },
      'node:path': path,
      'node:os': { tmpdir: () => path.dirname(output) },
      'node:child_process': { spawnSync: () => ({ status: 0 }) },
      './build-plan.cjs': { buildPlan: (target, flags) => buildPlan(target, flags, { platform, arch }) },
      './signing.cjs': { configureSigning: () => false, signingEnvironment },
      './bundle-codex.cjs': { bundleCodex(_config, options) { assert.equal(options.platform, platform); assert.equal(options.arch, arch); } },
      '../src/windows_feature/scripts/assets.cjs': {},
      '../package.json': pkg,
      '../src/apple_feature/scripts/build-helper.cjs': { buildHelper() {} },
      '../src/apple_feature/scripts/build-config.cjs': { configureAppleBuild: config => configureAppleBuild(config, {}) }
    };
    const requireMock = name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected build dependency: ${name}`);
      return modules[name];
    };
    requireMock.resolve = name => path.resolve('node_modules', name);
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/build.cjs'), 'utf8'), {
      require: requireMock, __dirname: path.resolve(__dirname, '../scripts'), structuredClone,
      process: { argv: ['node', 'build.cjs', target, `--${arch}`], platform, arch, env: {} },
      console: { log() {} }
    });
    if (target === 'mac') configureAppleBuild(config, {});
    config.directories.output = output;
    config.electronDist = path.join(path.dirname(requireMock.resolve('electron/package.json')), 'dist');
    assert.deepEqual(captured, config);
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
      const script = target === 'win' ? '../src/windows_feature/scripts/build-windows.cjs' : '../scripts/build.cjs';
      const filename = path.resolve(__dirname, script);
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
        './signing.cjs': { configureSigning: () => false, signingEnvironment },
        '../../../scripts/signing.cjs': { configureSigning: () => false, signingEnvironment },
        '../package.json': pkg, '../../../package.json': pkg,
        '../src/windows_feature/scripts/assets.cjs': {}, './assets.cjs': {}, './build-taskbar-helper.cjs': {},
        '../src/apple_feature/scripts/build-helper.cjs': { buildHelper() {} },
        '../src/apple_feature/scripts/build-config.cjs': { configureAppleBuild: config => configureAppleBuild(config, {}) },
        '../../../scripts/bundle-codex.cjs': { bundleCodex() {} },
        './bundle-codex.cjs': { bundleCodex(_config, options) { assert.equal(options.platform, platform); assert.equal(options.arch, targetArch); } }
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
      vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        require: requireMock, __dirname: path.dirname(filename), structuredClone,
        process: { argv: ['node', filename, ...(target === 'win' ? [] : [target, `--${targetArch}`])],
          platform, arch: hostArch, execPath: process.execPath, env: {}, exit(code) { assert.fail(`Build exited: ${code}`); } },
        console: { log() {}, error: assert.fail }
      });
      assert.equal(captured.electronDist, installed && hostArch === targetArch ? electronDist : undefined);
      assert.deepEqual(Array.from(builderArgs), [path.resolve('node_modules', 'electron-builder', 'cli.js'),
        `--${target}`, `--${targetArch}`, '--publish=never', `--config=${path.join(output, 'build-config.json')}`]);
      await validateConfiguration(captured);
      assert.equal(await getElectronVersion(path.resolve(__dirname, '..'), captured), pkg.devDependencies.electron);
    }
  }
});

test('Linux and macOS retain their account and authentication messages in both languages', () => {
  const previous = {
    ru: {
      account: 'Аккаунт Codex',
      codexMissing: 'Не найден Codex. Установите приложение Codex или Codex CLI, затем перезапустите Limits.',
      loginUnavailable: 'Codex недоступен. Установите Codex и перезапустите приложение.',
      loginFailed: 'Не удалось открыть вход. Проверьте Codex и попробуйте ещё раз.',
      disconnected: 'Связь с Codex потеряна. Повторяем подключение.',
      refreshFailed: 'Не удалось получить лимиты. Проверьте интернет и вход в Codex. Повторяем автоматически.'
    },
    en: {
      account: 'Codex account',
      codexMissing: 'Codex was not found. Install the Codex app or Codex CLI, then restart Limits.',
      loginUnavailable: 'Codex is unavailable. Install Codex and restart this application.',
      loginFailed: 'Could not open sign-in. Check Codex and try again.',
      unsupported: 'Subscription limits require ChatGPT sign-in. Codex currently uses another authentication method.',
      disconnected: 'Connection to Codex was lost. Reconnecting.',
      refreshFailed: 'Could not read limits. Check your connection and Codex sign-in. Retrying automatically.'
    }
  };
  for (const platform of ['linux', 'darwin', undefined]) {
    for (const [language, strings] of Object.entries(previous)) {
      for (const [key, value] of Object.entries(strings)) assert.equal(i18n.t(language, key, platform), value);
    }
  }
  assert.equal(i18n.t('ru', 'account', 'win32'), 'Аккаунт ChatGPT');
  assert.equal(i18n.t('en', 'codexMissing', 'win32'), 'The connection component was not found. Reinstall Limits.');
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
