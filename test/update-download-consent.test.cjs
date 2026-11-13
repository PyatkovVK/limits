'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { CHECK_INTERVAL } = require('../src/common/updates/updates.cjs');
const { LinuxUpdates } = require('../src/linux_feature/updates/updates.cjs');
const { WindowsUpdates } = require('../src/windows_feature/updates/updates.cjs');
const { AppleUpdates } = require('../src/apple_feature/updates.cjs');

for (const [platform, UpdateType] of [['linux', LinuxUpdates], ['win32', WindowsUpdates], ['darwin', AppleUpdates]]) {
  test(`${platform} checks, postponement and newer offers never download without an action`, async t => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'limits-update-consent-')));
    const target = path.join(root, platform === 'darwin' ? 'Limits.app' : 'Limits');
    if (platform === 'darwin') fs.mkdirSync(target); else fs.writeFileSync(target, 'installed app');
    let time = 1000, tag = 'v1.5', quits = 0;
    const checks = [], downloads = [];
    const updater = new UpdateType({ root, currentVersion: '1.4.0', arch: 'x64', now: () => time,
      env: { APPIMAGE: target }, applicationDirectories: [root],
      app: { isPackaged: true, getPath: () => platform === 'darwin' ? path.join(target, 'Contents/MacOS/Limits') : target, quit: () => quits++ },
      fetchImpl: async url => {
        if (url.includes('/releases?')) {
          checks.push(url);
          return Response.json([{ tag_name: tag, draft: false, prerelease: false, html_url: `https://github.com/PyatkovVK/limits/releases/tag/${tag}` }]);
        }
        downloads.push(url);
        return new Response('', { status: 503 });
      },
    });
    t.after(() => { updater.stop(); fs.rmSync(root, { recursive: true, force: true }); });
    const assertWaiting = async () => {
      await updater.downloadTask;
      assert.equal(updater.snapshot().status, 'available');
      assert.equal(updater.snapshot().installation.status, 'idle');
      assert.equal(updater.downloadTask == null, true);
      assert.equal(downloads.length, 0);
      assert.equal(quits, 0);
    };
    await updater.start(); await assertWaiting();
    for (let cycle = 0; cycle < 2; cycle++) {
      time += CHECK_INTERVAL; await updater.resume(); await assertWaiting();
    }
    updater.dismiss('1.5.0');
    await updater.check(); await assertWaiting();
    assert.equal(updater.snapshot().offer, null);
    tag = 'v1.6';
    await updater.check(); await assertWaiting();
    assert.equal(updater.snapshot().offer.version, '1.6.0');
    assert.equal(checks.length, 5);

    assert.deepEqual(await updater.openRelease(), { error: 'downloadFailed' });
    assert.equal(downloads.length, 1, 'Only the explicit action may request package metadata');
    assert.ok(downloads[0].endsWith('/releases/tags/v1.6'));
    await updater.check();
    assert.equal(downloads.length, 1, 'A background check must not retry a failed download');
    assert.deepEqual(await updater.openRelease(), { error: 'downloadFailed' });
    assert.equal(downloads.length, 2, 'Retry also requires an explicit action');
    assert.equal(quits, 0);
  });
}

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/common/settings/updates/installation.js'), 'utf8'), context);
const presentation = (platform, language, installation, update = {}) => context.window.limitsInstallation.presentation({ platform, language,
  updates: { status: 'available', release: { version: '1.5.0' }, installation: { enabled: true, version: '1.5.0', ...installation }, ...update } });

for (const platform of ['linux', 'win32', 'darwin']) for (const language of ['ru', 'en']) {
  test(`${platform}/${language} offers download before installation and handles progress, retry and newer versions`, () => {
    const download = language === 'ru' ? 'Скачать обновление' : 'Download update';
    const install = language === 'ru' ? 'Установить и перезапустить' : 'Install and restart';
    const idle = presentation(platform, language, { status: 'idle', version: null });
    assert.equal(idle.button, download); assert.equal(idle.disabled, false);
    assert.ok(idle.hint.includes(download));
    for (const status of ['downloading', 'verifying', 'installing']) {
      assert.equal(presentation(platform, language, { status }).disabled, true);
    }
    const progress = presentation(platform, language, { status: 'downloading', progress: 42 });
    assert.equal(progress.status, 'downloading'); assert.equal(progress.progress, 42);
    assert.ok(progress.result.includes('42%'));
    assert.equal(presentation(platform, language, { status: 'ready' }).button, install);
    const error = presentation(platform, language, { status: 'error', error: 'downloadFailed' });
    assert.equal(error.button, language === 'ru' ? 'Повторить скачивание' : 'Retry download');
    assert.equal(error.disabled, false); assert.equal(error.error, true);
    for (const status of ['checking', 'error']) {
      assert.equal(presentation(platform, language, { status: 'idle' }, { status }).button, download);
      assert.equal(presentation(platform, language, { status: 'ready' }, { status }).button, install);
    }
    const newer = presentation(platform, language, { status: 'ready' }, { release: { version: '1.6.0' } });
    assert.equal(newer.button, download); assert.equal(newer.result, undefined);
    assert.equal(presentation(platform, language, { status: 'installing' }, { release: { version: '1.6.0' } }).disabled, true);
  });
}
