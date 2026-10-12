'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { changePreference } = require('../../common/preferences.cjs');
const { trayStyle } = require('../preferences.cjs');

test('Linux tray styles save and redraw immediately, rejecting other platforms and invalid values', () => {
  const settings = {}, events = [];
  const context = { settings, platform: 'linux', taskbarSupported: false, save: () => events.push('save'), update: () => events.push('update') };
  for (const style of ['bar', 'classic']) {
    assert.equal(changePreference('linuxTrayStyle', style, context), true);
    assert.equal(settings.linuxTrayStyle, style);
  }
  assert.deepEqual(events, ['save', 'update', 'save', 'update']);
  for (const value of ['unknown', null, 1, {}]) assert.equal(changePreference('linuxTrayStyle', value, context), false);
  for (const platform of ['win32', 'darwin']) assert.equal(changePreference('linuxTrayStyle', 'bar', { ...context, platform }), false);
  assert.equal(events.length, 4);
  assert.equal(trayStyle('bar'), 'bar');
  for (const value of [undefined, 'classic', 'unknown', null]) assert.equal(trayStyle(value), 'classic');
});
