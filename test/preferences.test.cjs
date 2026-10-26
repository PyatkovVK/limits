const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startupState, changePreference } = require('../src/common/preferences.cjs');
function context(platform = 'win32', home) {
  return { platform, env: {}, app: { isPackaged: true, getPath: () => home, getLoginItemSettings: () => ({ openAtLogin: false }), setLoginItemSettings(value) { this.saved = value; } },
    settings: { width: 280, visible: true }, taskbarSupported: platform === 'win32', saves: 0,
    save() { this.saves++; }, update() {}, place() {}, resetPosition() {} };
}
test('startup availability is limited to installed Windows/macOS builds and never changes it in demo or portable builds', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-startup-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  for (const platform of ['win32', 'darwin', 'linux']) {
    const value = context(platform, home);
    assert.equal(startupState(value).available, platform !== 'linux');
    for (const patch of [{ demo: true }, { smoke: true }, { env: { PORTABLE_EXECUTABLE_FILE: 'app.exe' } }]) {
      assert.equal(changePreference('startup', true, { ...value, ...patch }), false);
      assert.equal(value.app.saved, undefined);
    }
    assert.equal(changePreference('startup', true, value), platform !== 'linux');
    if (platform === 'win32') assert.deepEqual(value.app.saved, { openAtLogin: true, args: ['--hidden'] });
    if (platform === 'darwin') {
      assert.equal(startupState(value).enabled, true);
      assert.equal(changePreference('startup', false, value), true);
      assert.equal(startupState(value).enabled, false);
    }
  }
});
test('widget settings reject unsupported platforms, unknown keys and invalid widths or checkbox values', () => {
  const value = context();
  // Bind callbacks just as the main process binds its closures.
  value.save = () => value.saves++;
  assert.equal(changePreference('width', 320, value), true);
  assert.equal(value.settings.width, 320);
  assert.equal(changePreference('visible', false, value), true);
  assert.equal(value.settings.visible, false);
  for (const [key, input] of [['width', '400'], ['width', 999], ['visible', 1], ['unknown', true]]) assert.equal(changePreference(key, input, value), false);
  assert.equal(value.saves, 2);
  for (const platform of ['darwin', 'linux']) assert.equal(changePreference('width', 320, context(platform)), false);
});
