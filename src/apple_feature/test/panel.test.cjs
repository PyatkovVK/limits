'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { panelBounds, createPanelController } = require('../panel.cjs');

const display = { bounds: { x: 0, y: 0, width: 1440, height: 900 }, workArea: { x: 0, y: 24, width: 1440, height: 852 } };
const anchor = { x: 1040, y: 0, width: 64, height: 24 };
class FakeWindow extends EventEmitter {
  constructor() { super(); this.visible = false; this.shows = 0; this.moves = []; }
  getSize() { return [440, 590]; }
  isDestroyed() { return false; }
  setBounds(bounds) { this.moves.push(bounds); }
  show() { this.visible = true; this.shows++; }
  focus() {}
  hide() { this.visible = false; this.emit('hide'); }
}
function controller(window, options = {}) {
  return createPanelController({ window, screen: { getDisplayMatching: () => display, getPrimaryDisplay: () => display }, getTrayBounds: () => [anchor], wait: async () => {}, attempts: 3, ...options });
}

test('first launch waits for status-item layout and positions before showing', async () => {
  const window = new FakeWindow();
  let reads = 0, waits = 0;
  const panel = controller(window, {
    getTrayBounds: () => ++reads < 3 ? [{ x: 0, y: 0, width: 0, height: 0 }] : [anchor],
    wait: async () => { waits++; assert.equal(window.shows, 0); assert.equal(window.moves.length, 0); }
  });
  assert.equal(await panel.show(), true);
  assert.equal(waits, 2);
  assert.equal(window.shows, 1);
  assert.deepEqual(window.moves, [{ x: 852, y: 32, width: 440, height: 590 }]);
  assert.equal(panel.snapshot().fallback, false);
});
test('unavailable status items fall back to the top of the primary screen', async () => {
  const window = new FakeWindow();
  const panel = controller(window, { getTrayBounds: () => [] });
  await panel.show();
  assert.deepEqual(window.moves[0], { x: 992, y: 32, width: 440, height: 590 });
  assert.equal(panel.snapshot().fallback, true);
});
test('non-empty AppKit placeholder at the bottom is ignored until a menu-bar frame arrives', async () => {
  const window = new FakeWindow();
  let reads = 0;
  const panel = controller(window, { getTrayBounds: () => ++reads < 3 ? [{ x: 0, y: 876, width: 80, height: 24 }] : [anchor] });
  await panel.show();
  assert.deepEqual(window.moves, [{ x: 852, y: 32, width: 440, height: 590 }]);
  assert.equal(panel.snapshot().attempts, 3);
});
test('click uses its own indicator and monitor rather than a stale startup position', async () => {
  const window = new FakeWindow();
  const clicked = { x: -180, y: -900, width: 64, height: 28 };
  const secondary = { bounds: { x: -1440, y: -900, width: 1440, height: 900 }, workArea: { x: -1440, y: -872, width: 1440, height: 872 } };
  const panel = controller(window, { screen: { getDisplayMatching: bounds => { assert.equal(bounds, clicked); return secondary; }, getPrimaryDisplay() { throw new Error('Wrong display'); } } });
  await panel.show({ getBounds: () => clicked });
  assert.deepEqual(window.moves[0], { x: -448, y: -864, width: 440, height: 590 });
});
test('panel remains inside small monitors and preserves room for its scrollable content', () => {
  const bounds = panelBounds({ anchor: { x: 200, y: 0, width: 64, height: 24 }, display: { workArea: { x: 0, y: 24, width: 360, height: 400 } }, size: [440, 590] });
  assert.deepEqual(bounds, { x: 8, y: 32, width: 344, height: 384 });
});
test('hiding the window cancels a pending first launch', async () => {
  const window = new FakeWindow();
  let resume;
  const panel = controller(window, { getTrayBounds: () => [], wait: () => new Promise(resolve => { resume = resolve; }) });
  const opening = panel.show();
  window.hide(); resume();
  assert.equal(await opening, false);
  assert.equal(window.shows, 0);
});
test('a newer click supersedes a pending startup request', async () => {
  const window = new FakeWindow();
  let resume;
  const panel = controller(window, { getTrayBounds: () => [], wait: () => new Promise(resolve => { resume = resolve; }) });
  const startup = panel.show();
  await panel.show({ getBounds: () => anchor });
  resume();
  assert.equal(await startup, false);
  assert.equal(window.shows, 1);
  assert.equal(panel.snapshot().anchor, anchor);
});
