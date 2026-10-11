const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { panelBounds, createPanelController } = require('../panel.cjs');

const area = { x: 0, y: 0, width: 1280, height: 767 };
class FakeWindow extends EventEmitter {
  constructor() { super(); this.visible = false; this.bounds = { x: 420, y: 105, width: 440, height: 590 }; this.moves = 0; }
  isDestroyed() { return false; }
  isVisible() { return this.visible; }
  getBounds() { return { ...this.bounds }; }
  setBounds(bounds) { this.bounds = bounds; this.moves++; }
  show() { this.visible = true; }
  focus() {}
}
function controller() {
  const window = new FakeWindow(), screen = new EventEmitter();
  screen.getPrimaryDisplay = () => ({ workArea: area });
  screen.getDisplayMatching = () => ({ workArea: area });
  return { window, screen, panel: createPanelController({ window, screen }) };
}

test('Linux panel fits a single-account layout and keeps its bottom above the taskbar', () => {
  assert.deepEqual(panelBounds({ area, contentHeight: 410 }), { x: 824, y: 349, width: 440, height: 410 });
  const { window, panel } = controller();
  panel.resize(410); panel.show();
  assert.equal(window.visible, true);
  assert.equal(window.bounds.height, 410);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});
test('expanding and closing account settings resizes both ways without moving the bottom edge', () => {
  const { window, panel } = controller();
  panel.resize(410); panel.show();
  window.bounds.x = 600; window.bounds.y = 320;
  const bottom = window.bounds.y + window.bounds.height;
  panel.resize(485.2);
  assert.equal(window.bounds.height, 486);
  assert.equal(window.bounds.y + window.bounds.height, bottom);
  assert.equal(window.bounds.x, 600);
  panel.resize(410);
  assert.equal(window.bounds.height, 410);
  assert.equal(window.bounds.y + window.bounds.height, bottom);
  const moves = window.moves;
  panel.resize(410);
  assert.equal(window.moves, moves);
});
test('long account lists and small secondary displays keep the panel inside the work area', () => {
  assert.equal(panelBounds({ area, contentHeight: 1200 }).height, 590);
  assert.deepEqual(panelBounds({ area: { x: -360, y: -500, width: 360, height: 400 }, contentHeight: 1200 }), { x: -352, y: -492, width: 344, height: 384 });
  const { window, screen, panel } = controller();
  panel.resize(410); panel.show();
  screen.getDisplayMatching = () => ({ workArea: { x: 0, y: 0, width: 1280, height: 350 } });
  screen.emit('display-metrics-changed');
  assert.equal(window.bounds.height, 334);
  assert.equal(window.bounds.y, 8);
  panel.dispose();
  assert.equal(screen.listenerCount('display-metrics-changed'), 0);
});
test('invalid renderer heights are ignored and controller releases display listeners when closed', () => {
  const { window, screen, panel } = controller();
  const bounds = window.getBounds();
  for (const value of [NaN, Infinity, -1, 0, '410', null, undefined]) assert.equal(panel.resize(value), false);
  assert.deepEqual(window.getBounds(), bounds);
  window.emit('closed');
  assert.equal(screen.listenerCount('display-metrics-changed'), 0);
});
