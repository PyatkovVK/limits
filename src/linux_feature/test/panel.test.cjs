const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { panelBounds, panelEdge, createPanelController } = require('../panel.cjs');

const area = { x: 0, y: 0, width: 1280, height: 767 };
class FakeWindow extends EventEmitter {
  constructor() {
    super(); this.visible = false; this.bounds = { x: 420, y: 105, width: 440, height: 590 }; this.moves = 0;
    this.webContents = new EventEmitter();
    this.webContents.setZoomFactor = value => { this.zoom = value; };
  }
  isDestroyed() { return this.destroyed || false; }
  isVisible() { return this.visible; }
  getBounds() { return { ...this.bounds }; }
  setBounds(bounds) { this.bounds = bounds; this.moves++; }
  show() { this.visible = true; }
  focus() {}
}
function controller() {
  const window = new FakeWindow(), screen = new EventEmitter();
  screen.getPrimaryDisplay = () => ({ bounds: { x: 0, y: 0, width: 1280, height: 800 }, workArea: area });
  screen.getDisplayMatching = screen.getPrimaryDisplay;
  screen.getDisplayNearestPoint = screen.getPrimaryDisplay;
  screen.getCursorScreenPoint = () => ({ x: 1000, y: 790 });
  return { window, screen, panel: createPanelController({ window, screen }) };
}

test('Linux panel enlarges content and keeps its bottom above the taskbar', () => {
  assert.deepEqual(panelBounds({ area, contentHeight: 410 }), { x: 736, y: 279, width: 528, height: 480 });
  const { window, panel } = controller();
  panel.resize(410); panel.show();
  assert.equal(window.visible, true);
  assert.equal(window.zoom, 1.2);
  window.zoom = 1;
  window.webContents.emit('dom-ready');
  assert.equal(window.zoom, 1.2);
  assert.equal(window.bounds.width, 528);
  assert.equal(window.bounds.height, 492);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});
test('expanding and closing account settings resizes both ways without moving the bottom edge', () => {
  const { window, panel } = controller();
  panel.resize(410); panel.show();
  window.bounds.x = 600; window.bounds.y = 240;
  const bottom = window.bounds.y + window.bounds.height;
  panel.resize(485.2);
  assert.equal(window.bounds.height, 583);
  assert.equal(window.bounds.y + window.bounds.height, bottom);
  assert.equal(window.bounds.x, 600);
  panel.resize(410);
  assert.equal(window.bounds.height, 492);
  assert.equal(window.bounds.y + window.bounds.height, bottom);
  const moves = window.moves;
  panel.resize(410);
  assert.equal(window.moves, moves);
});
test('long account lists and small secondary displays keep the panel inside the work area', () => {
  assert.equal(panelBounds({ area, contentHeight: 1200 }).height, 720);
  assert.deepEqual(panelBounds({ area: { x: -360, y: -500, width: 360, height: 400 }, contentHeight: 1200 }), { x: -352, y: -492, width: 344, height: 384 });
  const { window, screen, panel } = controller();
  panel.resize(410); panel.show();
  screen.getPrimaryDisplay = () => ({ workArea: { x: 0, y: 0, width: 1280, height: 350 } });
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
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) assert.equal(screen.listenerCount(event), 0);
  window.destroyed = true;
  assert.equal(panel.show(), false);
  assert.equal(panel.resize(410), false);
});

test('top and bottom tray activations open next to the icon and preserve the attached edge when resizing', () => {
  const { window, panel } = controller();
  let bounds = { x: 500, y: 0, width: 24, height: 28 };
  const tray = { getBounds: () => bounds };
  panel.resize(410); panel.show(tray);
  assert.equal(window.bounds.x, 248);
  assert.equal(window.bounds.y, 36);
  panel.resize(500);
  assert.equal(window.bounds.y, 36);
  assert.equal(window.bounds.height, 600);
  panel.resize(410);
  assert.equal(window.bounds.y, 36);
  assert.equal(window.bounds.height, 492);
  bounds = { x: 500, y: 772, width: 24, height: 28 };
  panel.show(tray);
  assert.equal(window.bounds.y + window.bounds.height, 759);
  panel.resize(500);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});

test('Linux empty or unavailable tray bounds use the activation cursor and its display', () => {
  const { window, screen, panel } = controller();
  const display = { bounds: { x: -1280, y: -800, width: 1280, height: 800 }, workArea: { x: -1280, y: -770, width: 1280, height: 770 } };
  screen.getCursorScreenPoint = () => ({ x: -600, y: -785 });
  screen.getDisplayNearestPoint = () => display;
  screen.getDisplayMatching = () => display;
  for (const tray of [{ getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }) }, { getBounds() { throw new Error('Unsupported'); } }, {}]) {
    panel.resize(410); panel.show(tray);
    assert.equal(window.bounds.x, -863);
    assert.equal(window.bounds.y, -762);
    screen.getCursorScreenPoint = () => ({ x: -100, y: -10 });
    panel.resize(500);
    assert.equal(window.bounds.y, -762);
    screen.emit('display-metrics-changed');
    assert.equal(window.bounds.y, -762);
    screen.getCursorScreenPoint = () => ({ x: -600, y: -785 });
  }
});

test('startup and unavailable cursor coordinates follow the reserved top panel', () => {
  const { window, screen, panel } = controller();
  const display = { bounds: { x: 0, y: 0, width: 1280, height: 800 }, workArea: { x: 0, y: 32, width: 1280, height: 768 } };
  screen.getPrimaryDisplay = () => display;
  screen.getCursorScreenPoint = () => { throw new Error('Wayland'); };
  assert.equal(panelEdge(display), 'top');
  panel.show({});
  assert.equal(window.bounds.y, 40);
  screen.getCursorScreenPoint = () => ({ x: 600, y: 400 });
  panel.show({});
  assert.equal(window.bounds.y, 40);
  panel.show();
  assert.equal(window.bounds.y, 40);
});

test('a small display does not permanently shrink the panel width', () => {
  const { window, screen, panel } = controller();
  const primary = screen.getPrimaryDisplay;
  screen.getPrimaryDisplay = () => ({ workArea: { x: 0, y: 0, width: 360, height: 400 } });
  panel.show();
  assert.equal(window.bounds.width, 344);
  screen.getPrimaryDisplay = primary;
  panel.show();
  assert.equal(window.bounds.width, 528);
});

test('display changes re-read tray placement and move the open panel to the new edge', () => {
  const { window, screen, panel } = controller();
  let bounds = { x: 500, y: 0, width: 24, height: 28 };
  panel.resize(410); panel.show({ getBounds: () => bounds });
  bounds = { x: 700, y: 772, width: 24, height: 28 };
  screen.emit('display-metrics-changed');
  assert.equal(window.bounds.x, 448);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});


test('unknown tray geometry keeps a stable activation point across repeated clicks and Settings', () => {
  const { window, screen, panel } = controller();
  let cursor = { x: 600, y: 790 };
  screen.getCursorScreenPoint = () => cursor;
  const tray = { getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }) };
  panel.resize(410); panel.show(tray);
  const expected = window.getBounds();
  for (const x of [594, 607, 591, 610]) {
    cursor = { x, y: 785 };
    window.visible = false; panel.show(tray);
    assert.deepEqual(window.bounds, expected);
  }
  cursor = { x: 300, y: 300 };
  panel.show();
  assert.deepEqual(window.bounds, expected, 'opening Settings reuses the last tray anchor');
});

test('a different display edge gets its own stable fallback and valid icon bounds take priority', () => {
  const { window, screen, panel } = controller();
  screen.getCursorScreenPoint = () => ({ x: 600, y: 790 });
  const tray = {};
  panel.show(tray);
  const bottom = window.getBounds();
  screen.getCursorScreenPoint = () => ({ x: 400, y: 10 });
  panel.show(tray);
  assert.notEqual(window.bounds.x, bottom.x);
  tray.getBounds = () => ({ x: 700, y: 0, width: 24, height: 24 });
  panel.show(tray);
  assert.equal(window.bounds.x, 448);
});
