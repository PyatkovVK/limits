'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { WidgetPositionStore } = require('../widget/position-store.cjs');

test('widget position storage ignores corrupt coordinates and restores negative display origins', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-widget-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new WidgetPositionStore({ root });
  assert.equal(store.load(), null);
  for (const content of ['{', 'null', '{}', '{"x":"100","y":200}', '{"x":1.5,"y":200}']) {
    fs.writeFileSync(store.file, content);
    assert.equal(store.load(), null);
  }
  store.save({ x: -700, y: -300 });
  assert.deepEqual(new WidgetPositionStore({ root }).load(), { x: -700, y: -300 });
  assert.equal(fs.existsSync(`${store.file}.tmp`), false);
  store.clear();
  assert.equal(store.load(), null);
});

test('unavailable widget storage does not interrupt the window lifecycle', () => {
  const unavailable = () => { throw new Error('Read-only filesystem'); };
  const store = new WidgetPositionStore({
    root: os.tmpdir(),
    fileSystem: { readFileSync: unavailable, mkdirSync: unavailable, rmSync: unavailable }
  });
  assert.equal(store.load(), null);
  assert.doesNotThrow(() => store.save({ x: 100, y: 200 }));
  assert.doesNotThrow(() => store.clear());
});
