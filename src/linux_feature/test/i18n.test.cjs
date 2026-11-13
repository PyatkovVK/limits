'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { t } = require('../renderer/i18n.js');

test('Linux widget period labels stay compact in both languages', () => {
  assert.equal(t('ru', 'widgetShortCompact'), '5ч');
  assert.equal(t('ru', 'weeklyCompact'), '7д');
  assert.equal(t('en', 'widgetShortCompact'), '5h');
  assert.equal(t('en', 'weeklyCompact'), '7d');
});

test('Linux translations leave shared strings to the common lookup', () => {
  for (const language of ['ru', 'en']) {
    for (const key of ['refresh', 'login', 'connectAccount', 'settings', 'unknownKey']) {
      assert.equal(t(language, key), null);
    }
  }
});
