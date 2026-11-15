'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { activationCommand, createGenmonPresentation, genmonAvailable } = require('../panel/genmon.cjs');

test('the XFCE panel command uses the source or stable packaged entry point', () => {
  assert.equal(activationCommand({ executable: '/tmp/Electron Node', appPath: "/tmp/O'Brien", demo: true }),
    "'/tmp/Electron Node' '/tmp/O'\\''Brien' '--demo' '--linux-panel-activate'");
  assert.equal(activationCommand({ executable: '/tmp/mount/bin/limits', packaged: true, appImage: '/home/test/Limits.AppImage' }),
    "'/home/test/Limits.AppImage' '--linux-panel-activate'");
});

test('Genmon follows the current quota and mode with one stable command', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-genmon-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, 'xfce4/panel/plugins/genmon.desktop');
  fs.mkdirSync(path.dirname(plugin), { recursive: true });
  fs.writeFileSync(plugin, '');
  assert.equal(genmonAvailable({ XDG_CURRENT_DESKTOP: 'XFCE', XDG_DATA_DIRS: root }), true);
  assert.equal(genmonAvailable({ XDG_CURRENT_DESKTOP: 'GNOME', XDG_DATA_DIRS: root }), false);

  const file = path.join(root, 'xfce-panel.xml');
  const read = () => fs.readFileSync(file, 'utf8');
  const activate = 'limits --linux-panel-activate';
  const panel = createGenmonPresentation({ root, activate });
  const state = { bucket: { short: { remaining: 0 }, weekly: null }, language: 'ru' };
  panel.update({ ...state, style: 'line' });
  assert.equal(panel.command, "cat '" + file + "'");
  assert.match(read(), /5ч <b>0%<\/b>.*7д <b>—<\/b>/);
  panel.update({ ...state, style: 'shelf' });
  assert.match(read(), /▫▫▫▫▫.*┄┄┄┄┄/);
  assert.ok(read().includes('<txtclick>' + activate + '</txtclick>'));
  panel.update({ ...state, style: 'classic' });
  assert.equal(read().trim(), '');
  panel.update({ ...state, style: 'line' });
  panel.clear();
  assert.equal(read().trim(), '');
});
