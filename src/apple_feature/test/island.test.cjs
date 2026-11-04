'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fitIndicators } = require('../renderer/island.js');
const { isNotchMode, displayModes, notify, offerUpdate } = require('../presentation.cjs');

test('both original presentations remain available and the side panel requires a physical notch', () => {
  assert.deepEqual(displayModes(false), ['tray']);
  assert.deepEqual(displayModes(true), ['tray', 'notch', 'island']);
  assert.equal(isNotchMode('island'), true); assert.equal(isNotchMode('notch'), true); assert.equal(isNotchMode('tray'), false);
});
test('only the side panel handles app notifications, including when system notifications are unavailable', () => {
  const messages = [];
  const notch = { notify(message) { messages.push(message); return true; } };
  const message = { title: 'Limits', body: '5h: 8%' };
  for (const mode of ['tray', 'widget', 'notch']) assert.equal(notify(mode, notch, message), null);
  assert.equal(messages.length, 0);
  assert.equal(notify('island', notch, message), true);
  assert.deepEqual(messages, [message]);
  assert.equal(notify('island', undefined, message), false);
  assert.equal(offerUpdate('island', notch, { version: '2.0' }, key => key), true);
  assert.equal(messages[1].action, 'updates'); assert.ok(messages[1].body.includes('2.0'));
  assert.equal(offerUpdate('notch', notch, { version: '2.0' }, key => key), false);
});
test('a pair of quotas fits on opposite sides without an overflow counter', () => {
  assert.deepEqual(fitIndicators([57, 57], 72), { left: [0], right: [1], hidden: [] });
});
test('many metrics reserve space for +N and every hidden metric remains accounted for', () => {
  const widths = Array.from({ length: 40 }, (_, index) => 24 + (index % 4) * 20);
  const plan = fitIndicators(widths, 116, 28);
  assert.equal(new Set([...plan.left, ...plan.right, ...plan.hidden]).size, widths.length);
  assert.ok(plan.hidden.length > 0);
  const width = indices => indices.reduce((total, index) => total + widths[index], 0) + Math.max(0, indices.length - 1) * 8;
  assert.ok(width(plan.left) <= 116);
  assert.ok(width(plan.right) + 28 + (plan.right.length ? 8 : 0) <= 116);
});
test('long monetary values and narrow wings move to overflow without clipping the value', () => {
  assert.deepEqual(fitIndicators([190, 180, 150], 72, 24), { left: [], right: [], hidden: [0, 1, 2] });
  assert.deepEqual(fitIndicators([], 72), { left: [], right: [], hidden: [] });
});
