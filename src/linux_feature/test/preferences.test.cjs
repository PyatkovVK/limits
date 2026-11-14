'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { changePreference } = require('../../common/core/preferences.cjs');
const { trayStyle, changeTrayStyle } = require('../core/preferences.cjs');

test('Linux tray styles save and redraw immediately, rejecting other platforms and invalid values', () => {
  const settings = {}, events = [];
  const context = { settings, platform: 'linux', taskbarSupported: false, save: () => events.push('save'), update: () => events.push('update'), platformApi: { changeTrayStyle } };
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

test('Linux display settings offer only the two tray styles for current and legacy profiles', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../settings/general/group.js'), 'utf8'), { window });
  for (const language of ['ru', 'en']) {
    for (const displayMode of ['tray', 'widget']) {
      for (const style of [undefined, 'classic', 'bar']) {
        const selection = window.limitsLinuxDisplay.selection({ language, displayMode, preferences: { linuxTrayStyle: style } });
        assert.equal(selection.value, style || 'classic');
        assert.deepEqual(Array.from(selection.options, option => option.value), ['classic', 'bar']);
        assert.deepEqual(Array.from(selection.options, option => option.label), language === 'ru' ? ['Значки в трее', 'Полоски в трее'] : ['Tray icons', 'Tray bars']);
      }
    }
  }
});

test('removed Linux widget preferences cannot mutate settings or reset panel placement', () => {
  const settings = { width: 280, visible: false }, events = [];
  const context = {
    settings, platform: 'linux', taskbarSupported: false,
    save: () => events.push('save'), update: () => events.push('update'),
    place: () => events.push('place'), resetPosition: () => events.push('reset'),
  };
  for (const [key, value] of [['width', 320], ['visible', true], ['resetPosition', true]]) {
    assert.equal(changePreference(key, value, context), false);
  }
  assert.deepEqual(settings, { width: 280, visible: false });
  assert.deepEqual(events, []);
});
