'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const countdown = require('../../common/renderer/countdown.js');
const i18n = require('../../common/renderer/i18n.js');
const windowsI18n = require('../i18n.js');

test('weekly widget countdown updates between samples and switches selected buckets', async () => {
  const nodes = new Map(); let listener, tick;
  const node = id => { if (!nodes.has(id)) nodes.set(id, { textContent: '', value: 0, addEventListener() {} }); return nodes.get(id); };
  const now = Date.now(), unix = Math.ceil(now / 1000);
  const bucket = { id: 'codex', short: { resetsAt: unix + 3600, remaining: 50 }, weekly: { resetsAt: unix + 7 * 86400, remaining: 80 } };
  const sample = { language: 'ru', buckets: [bucket], updatedAt: now };
  const context = { document: { getElementById: node, body: { classList: { toggle() {} }, addEventListener() {} } },
    window: { limitsI18n: { ...i18n, apply() {} }, limitsWindowsI18n: windowsI18n,
      limitsCountdown: { render(el, reset, language, time = Date.now(), options) { el.textContent = countdown.format(reset, time, { ...options, language }); el.language = language; } },
      limits: { subscribe(fn) { listener = fn; }, get: async () => sample } }, setInterval(fn) { tick = fn; }, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/widget.js'), 'utf8'), context);
  await context.window.renderReady;
  assert.equal(node('weekly-reset').textContent, countdown.format(bucket.weekly.resetsAt, Date.now(), { compactDays: true }));
  node('weekly-reset').textContent = 'old'; tick(); assert.notEqual(node('weekly-reset').textContent, 'old');
  listener({ ...sample, language: 'en', selectedId: 'other', buckets: [bucket, { id: 'other', weekly: { resetsAt: unix - 1 } }] });
  assert.equal(node('weekly-reset').textContent, '0:00'); assert.equal(node('weekly-reset').language, 'en');
  listener({ ...sample, buckets: [] }); assert.equal(node('weekly-reset').textContent, '—');
  assert.equal(windowsI18n.t('ru', 'weeklyCompact'), '7д'); assert.equal(windowsI18n.t('en', 'weeklyCompact'), '7d');
});
