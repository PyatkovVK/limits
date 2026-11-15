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
  const context = { settings, platform: 'linux', taskbarSupported: false, save: () => events.push('save'), update: () => events.push('update'),
    platformApi: { changeTrayStyle: (value, target) => changeTrayStyle(value, target, true) } };
  for (const style of ['classic', 'digits', 'rings', 'line', 'shelf']) {
    assert.equal(changePreference('linuxTrayStyle', style, context), true);
    assert.equal(settings.linuxTrayStyle, style);
  }
  assert.deepEqual(events, Array.from({ length: 5 }, () => ['save', 'update']).flat());
  for (const value of ['bar', 'unknown', null, 1, {}]) assert.equal(changePreference('linuxTrayStyle', value, context), false);
  for (const platform of ['win32', 'darwin']) assert.equal(changePreference('linuxTrayStyle', 'digits', { ...context, platform }), false);
  assert.equal(changeTrayStyle('line', context), false);
  assert.equal(events.length, 10);
  assert.equal(trayStyle('shelf', true), 'shelf');
  for (const value of [undefined, 'classic', 'bar', 'shelf', 'unknown', null]) assert.equal(trayStyle(value), 'classic');
});

test('Linux settings offer wide styles when Genmon is available and migrate the legacy bar', () => {
  const window = {};
  const context = vm.createContext({ window, globalThis: window });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../common/settings/general/group.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings/general/styles.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings/general/group.js'), 'utf8'), context);
  for (const language of ['ru', 'en']) for (const xfcePanelAvailable of [true, false]) {
    const next = { language, displayMode: 'tray', preferences: { linuxTrayStyle: 'bar', xfcePanelAvailable } };
    const group = window.limitsGeneralSettings.describe(next, key => key, {});
    const selection = group.settings.find(setting => setting.id === 'display-mode');
    assert.equal(selection.value, 'classic');
    assert.deepEqual(Array.from(selection.options, option => option.value),
      xfcePanelAvailable ? ['classic', 'digits', 'rings', 'line', 'shelf'] : ['classic', 'digits', 'rings']);
    assert.ok(selection.options.every(option => option.label));
    assert.equal(selection.options[0].label, language === 'ru' ? 'Классические' : 'Classic');
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
