'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { EventEmitter } = require('node:events');
const { createPanelPosition } = require('../src/common/panel-position.cjs');
function setup(t, root) {
  root ||= fs.mkdtempSync(path.join(os.tmpdir(), 'limits-placement-'));
  const window = new EventEmitter(); window.bounds = { x: 100, y: 150, width: 440, height: 590 };
  window.isDestroyed = () => false; window.isVisible = () => true; window.getBounds = () => window.bounds;
  const position = createPanelPosition({ window, root, name: 'fixture' });
  t.after(() => { position.dispose(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, window, position };
}
test('manual placement persists and restores, while programmatic placement never pins the window', t => {
  const { root, window, position } = setup(t);
  position.expect(window.bounds); window.emit('move'); position.flush();
  assert.equal(position.point, null);
  window.bounds = { ...window.bounds, x: -900, y: 60 }; window.emit('moved'); position.flush();
  assert.deepEqual(position.point, { x: -900, y: 60 });
  const restored = setup(t, root).position;
  assert.deepEqual(restored.point, position.point);
  assert.deepEqual(restored.bounds({ x: 0, y: 24, width: 360, height: 400 }, [440, 590]), { x: 8, y: 32, width: 344, height: 384 });
});
test('invalid storage falls back to the tray and pending move listeners are cleaned up', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-placement-'));
  fs.writeFileSync(path.join(root, 'fixture-panel-position.json'), '{"x":"100","y":10}');
  const { position, window } = setup(t, root);
  assert.equal(position.point, null);
  position.expect(window.bounds); window.emit('move'); position.dispose();
  assert.equal(window.listenerCount('move'), 0); assert.equal(window.listenerCount('moved'), 0);
});

test('native one-pixel rounding is not recorded as a manual drag', t => {
  const { position, window } = setup(t);
  position.expect(window.bounds);
  window.bounds = { ...window.bounds, x: window.bounds.x + 1, y: window.bounds.y - 1 };
  window.emit('move'); position.flush();
  assert.equal(position.point, null);
});
