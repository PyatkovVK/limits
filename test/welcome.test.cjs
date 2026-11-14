'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { welcomeMode, markWelcomeShown } = require('../src/common/welcome/once.cjs');
const { welcomeBounds } = require('../src/common/welcome/geometry.cjs');
const windows = require('../src/windows_feature/welcome/display.cjs');
const mac = require('../src/apple_feature/welcome/display.cjs');
const linux = require('../src/linux_feature/welcome/display.cjs');

function profile(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-welcome-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('only the 2.0 release opens a welcome and a fresh profile gets the install tour', t => {
  const root = profile(t);
  fs.mkdirSync(path.join(root, 'Cache'));
  for (const version of ['1.8.0', '2.0.0-beta.1', '2.0.1', '2.1.0', '3.0.0']) {
    assert.equal(welcomeMode(root, version), null, version);
  }
  assert.equal(welcomeMode(root, '2.0.0'), 'install');
  assert.equal(welcomeMode(root, '2.0'), 'install');
});

test('existing profiles get the update tour and can claim it only once', t => {
  const root = profile(t);
  fs.writeFileSync(path.join(root, 'widget-settings.json'), '{}');
  assert.equal(welcomeMode(root, '2.0.0'), 'update');
  assert.equal(markWelcomeShown(root), true);
  assert.equal(markWelcomeShown(root), false);
  assert.equal(welcomeMode(root, '2.0.0'), null);
  assert.equal(welcomeMode(root, '3.0.0'), null);
  assert.equal(fs.readFileSync(path.join(root, 'widget-settings.json'), 'utf8'), '{}');
});

test('the one-time marker is shared by both welcome paths', t => {
  const root = profile(t);
  assert.equal(welcomeMode(root, '2.0.0'), 'install');
  assert.equal(markWelcomeShown(root), true);
  fs.writeFileSync(path.join(root, 'accounts.json'), '{}');
  assert.equal(welcomeMode(root, '2.0.0'), null);
});

test('Windows opens above the active widget on its monitor and beside a vertical tray', () => {
  const display = { id: 2, bounds: { x: -1200, y: 0, width: 1200, height: 900 }, workArea: { x: -1200, y: 0, width: 1200, height: 860 } };
  const screen = { getDisplayMatching: () => display };
  const widget = { x: -760, y: 824, width: 260, height: 34 };
  const place = windows.placement({ screen, widget, getTrayBounds: () => assert.fail('Visible widget takes priority') });
  const bounds = welcomeBounds(place);
  assert.equal(bounds.x + bounds.width / 2, widget.x + widget.width / 2);
  assert.equal(bounds.y + bounds.height + 8, widget.y);

  const taskbar = { x: -40, y: 0, width: 40, height: 900 };
  display.workArea = { x: -1200, y: 0, width: 1160, height: 900 };
  const tray = { x: -36, y: 760, width: 28, height: 28 };
  const trayPlacement = windows.placement({ screen, taskbar, getTrayBounds: () => [tray] });
  const trayBounds = welcomeBounds(trayPlacement);
  assert.equal(trayPlacement.edge, 'right');
  assert.equal(trayBounds.x + trayBounds.width + 8, taskbar.x);
});

test('macOS anchors the welcome under the active notch or menu bar', async () => {
  const display = { bounds: { x: 0, y: -800, width: 1200, height: 800 }, workArea: { x: 0, y: -770, width: 1200, height: 770 } };
  const screen = { getDisplayMatching: () => display };
  const notch = { x: 450, y: -800, width: 300, height: 38 };
  const menu = { x: 900, y: -800, width: 36, height: 30 };
  const notchPlacement = await mac.placement({ screen, getNotchAnchor: () => notch, getTrayBounds: () => assert.fail('Notch takes priority') });
  const notchBounds = welcomeBounds(notchPlacement);
  assert.equal(notchBounds.x + notchBounds.width / 2, 600);
  assert.equal(notchBounds.y, notch.y + notch.height + 8);
  const menuPlacement = await mac.placement({ screen, getNotchAnchor: () => null, getTrayBounds: () => [menu] });
  const menuBounds = welcomeBounds(menuPlacement);
  assert.equal(menuBounds.x + menuBounds.width / 2, 918);
  assert.equal(menuBounds.y, display.workArea.y + 8);
});

test('Linux falls back to the reserved tray edge and fits a small work area', () => {
  const display = { bounds: { x: 0, y: 0, width: 400, height: 460 }, workArea: { x: 0, y: 32, width: 400, height: 428 } };
  const screen = { getPrimaryDisplay: () => display };
  const placement = linux.placement({ screen, getTrayBounds: () => [] });
  assert.equal(placement.edge, 'top');
  assert.deepEqual(welcomeBounds(placement), { x: 8, y: 40, width: 384, height: 412 });
});
