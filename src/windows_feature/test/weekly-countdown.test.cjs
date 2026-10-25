'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const countdown = require('../renderer/reset-clock.js');
const i18n = require('../../common/renderer/i18n.js');
const windowsI18n = require('../i18n.js');

test('weekly widget countdown updates between samples and switches selected buckets', async () => {
  const nodes = new Map(); let listener, tick;
  const rows = new Map();
  const node = id => {
    if (!nodes.has(id)) {
      const classes = new Set();
      rows.set(id, classes);
      nodes.set(id, { textContent: '', value: 0, addEventListener() {},
        closest: () => ({ classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } } }) });
    }
    return nodes.get(id);
  };
  const now = Date.now(), unix = Math.ceil(now / 1000);
  const bucket = { id: 'codex', short: { resetsAt: unix + 3600, remaining: 50 }, weekly: { resetsAt: unix + 7 * 86400, remaining: 80 } };
  const sample = { language: 'ru', buckets: [bucket], updatedAt: now };
  const context = { document: { getElementById: node, body: { classList: { toggle() {} }, addEventListener() {} } },
    window: { limitsI18n: { ...i18n, apply() {} }, limitsWindowsI18n: windowsI18n,
      limitsWindowsResetClock: { render(el, reset, language, time = Date.now(), options) { el.textContent = countdown.format(reset, language, time); el.language = language; } },
      limits: { subscribe(fn) { listener = fn; }, get: async () => sample } }, setInterval(fn) { tick = fn; }, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/widget.js'), 'utf8'), context);
  await context.window.renderReady;
  assert.equal(node('weekly-reset').textContent, countdown.format(bucket.weekly.resetsAt, 'ru', Date.now()));
  node('weekly-reset').textContent = 'old'; tick(); assert.notEqual(node('weekly-reset').textContent, 'old');
  listener({ ...sample, language: 'en', selectedId: 'other', buckets: [bucket, { id: 'other', weekly: { resetsAt: unix - 1 } }] });
  assert.equal(node('weekly-reset').textContent, countdown.format(unix - 1, 'en'));  assert.equal(node('weekly-reset').language, 'en');
  listener({ ...sample, buckets: [] }); assert.equal(node('weekly-reset').textContent, '—');
  listener({ ...sample, buckets: [{ ...bucket, short: { remaining: 67 }, weekly: { remaining: 66 } }] });
  assert.equal(rows.get('short-bar').has('limit-67'), true);
  assert.equal(rows.get('weekly-bar').has('limit-67'), false);
  assert.equal(node('short-value').textContent, '67');
  listener({ ...sample, buckets: [{ ...bucket, short: { remaining: 68 }, weekly: { remaining: 67 } }] });
  assert.equal(rows.get('short-bar').has('limit-67'), false);
  assert.equal(rows.get('weekly-bar').has('limit-67'), true);
  listener({ ...sample, buckets: [] });
  assert.equal(rows.get('weekly-bar').has('limit-67'), false);
  assert.equal(windowsI18n.t('ru', 'weeklyCompact'), '7д'); assert.equal(windowsI18n.t('en', 'weeklyCompact'), '7d');
});
