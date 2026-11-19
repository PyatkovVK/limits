'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const countdown = require('../renderer/reset-clock.js');
const i18n = require('../../common/renderer/i18n.js');
const windowsI18n = require('../renderer/i18n.js');
const widgetStyle = require('../settings/widget/styles.js');

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
  const context = { document: { getElementById: node, querySelector: node, body: { dataset: {}, classList: { toggle() {} }, addEventListener() {} } },
    window: { limitsI18n: { ...i18n, apply() {} }, limitsWindowsI18n: windowsI18n, limitsWindowsWidgetStyle: widgetStyle,
      limitsWindows: { onWidgetClick() {} },
      limits: { subscribe(fn) { listener = fn; }, get: async () => sample } }, setInterval(fn) { tick = fn; }, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/reset-clock.js'), 'utf8'), context.window);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../widget/renderer/widget.js'), 'utf8'), context);
  await context.window.renderReady;
  assert.equal(context.document.body.dataset.widgetStyle, 'classic');
  for (const style of ['rows', 'cells', 'invalid']) {
    listener({ ...sample, preferences: { widgetStyle: style } });
    assert.equal(context.document.body.dataset.widgetStyle, style === 'invalid' ? 'classic' : style);
  }
  assert.equal(node('weekly-reset').textContent, countdown.format(bucket.weekly.resetsAt, 'ru', Date.now()));
  node('weekly-reset').textContent = 'old'; tick(); assert.notEqual(node('weekly-reset').textContent, 'old');
  listener({ ...sample, language: 'en', selectedId: 'other', buckets: [bucket, { id: 'other', weekly: { resetsAt: unix - 1 } }] });
  assert.equal(node('weekly-reset').textContent, countdown.format(unix - 1, 'en'));
  assert.match(node('weekly-reset').title, /^Resets at/);
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
  listener({ ...sample, providerId: 'zai', capabilities: { apiKey: true }, account: { planType: 'Pro' },
    buckets: [{ ...bucket, id: 'zai', name: 'Z.ai' }] });
  assert.equal(node('widget-plan').textContent, 'Z.ai · Pro');
  assert.equal(node('weekly-value').textContent, '80');
  assert.equal(windowsI18n.t('ru', 'weeklyCompact'), '7д'); assert.equal(windowsI18n.t('en', 'weeklyCompact'), '7d');
});
