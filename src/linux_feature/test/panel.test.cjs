const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { panelBounds, panelEdge } = require('../panel/geometry.cjs');
const { createPanelController } = require('../panel/panel.cjs');

const area = { x: 0, y: 0, width: 1280, height: 767 };
class FakeWindow extends EventEmitter {
  constructor() {
    super(); this.visible = false; this.bounds = { x: 420, y: 105, width: 440, height: 590 }; this.moves = 0;
    this.webContents = new EventEmitter();
    this.webContents.setZoomFactor = value => { this.zoom = value; };
    this.webContents.executeJavaScript = async () => undefined;
    this.webContents.backgroundThrottling = true;
    this.webContents.setBackgroundThrottling = value => { this.webContents.backgroundThrottling = value; };
    this.shownBounds = []; this.preparedFrames = [];
    this.paintFrame = async () => {
      this.preparedFrames.push({ bounds: this.getBounds(), visible: this.visible });
    };
  }
  isDestroyed() { return this.destroyed || false; }
  isVisible() { return this.visible; }
  getBounds() { return { ...this.bounds }; }
  setBounds(bounds) { this.bounds = bounds; this.moves++; }
  show() { this.visible = true; this.shownBounds.push(this.getBounds()); this.emit('show'); }
  hide() { this.visible = false; this.emit('hide'); }
  focus() {}
}
function controller() {
  const window = new FakeWindow(), screen = new EventEmitter();
  screen.getPrimaryDisplay = () => ({ bounds: { x: 0, y: 0, width: 1280, height: 800 }, workArea: area });
  screen.getDisplayMatching = screen.getPrimaryDisplay;
  screen.getDisplayNearestPoint = screen.getPrimaryDisplay;
  screen.getCursorScreenPoint = () => ({ x: 1000, y: 790 });
  return { window, screen, panel: createPanelController({ window, screen, waitForPaint: () => window.paintFrame() }) };
}

test('Linux panel enlarges content and keeps its bottom above the taskbar', async () => {
  assert.deepEqual(panelBounds({ area, contentHeight: 410 }), { x: 736, y: 349, width: 528, height: 410 });
  const { window, panel } = controller();
  panel.resize(410); await panel.show();
  assert.equal(window.visible, true);
  assert.equal(window.zoom, 1.2);
  window.zoom = 1;
  window.webContents.emit('dom-ready');
  assert.equal(window.zoom, 1.2);
  assert.equal(window.bounds.width, 528);
  assert.equal(window.bounds.height, 492);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});
test('expanding and closing account settings resizes both ways without moving the bottom edge', async () => {
  const { window, panel } = controller();
  panel.resize(410); await panel.show();
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
test('long account lists and small secondary displays keep the panel inside the work area', async () => {
  assert.equal(panelBounds({ area, contentHeight: 1200 }).height, 720);
  assert.deepEqual(panelBounds({ area: { x: -360, y: -500, width: 360, height: 400 }, contentHeight: 1200 }), { x: -352, y: -492, width: 344, height: 384 });
  const { window, screen, panel } = controller();
  panel.resize(410); await panel.show();
  screen.getPrimaryDisplay = () => ({ workArea: { x: 0, y: 0, width: 1280, height: 350 } });
  screen.emit('display-metrics-changed');
  assert.equal(window.bounds.height, 334);
  assert.equal(window.bounds.y, 8);
  panel.dispose();
  assert.equal(screen.listenerCount('display-metrics-changed'), 0);
});
test('invalid renderer heights are ignored and controller releases display listeners when closed', async () => {
  const { window, screen, panel } = controller();
  const bounds = window.getBounds();
  for (const value of [NaN, Infinity, -1, 0, '410', null, undefined]) assert.equal(panel.resize(value), false);
  assert.deepEqual(window.getBounds(), bounds);
  window.emit('closed');
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) assert.equal(screen.listenerCount(event), 0);
  window.destroyed = true;
  assert.equal(await panel.show(), false);
  assert.equal(panel.resize(410), false);
});

test('top and bottom tray activations open next to the icon and preserve the attached edge when resizing', async () => {
  const { window, panel } = controller();
  let bounds = { x: 500, y: 0, width: 24, height: 28 };
  const tray = { getBounds: () => bounds };
  panel.resize(410); await panel.show(tray);
  assert.equal(window.bounds.x, 248);
  assert.equal(window.bounds.y, 36);
  panel.resize(500);
  assert.equal(window.bounds.y, 36);
  assert.equal(window.bounds.height, 600);
  panel.resize(410);
  assert.equal(window.bounds.y, 36);
  assert.equal(window.bounds.height, 492);
  bounds = { x: 500, y: 772, width: 24, height: 28 };
  await panel.show(tray);
  assert.equal(window.bounds.y + window.bounds.height, 759);
  panel.resize(500);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});

test('Linux empty or unavailable tray bounds use the activation cursor and its display', async () => {
  const { window, screen, panel } = controller();
  const display = { bounds: { x: -1280, y: -800, width: 1280, height: 800 }, workArea: { x: -1280, y: -770, width: 1280, height: 770 } };
  screen.getCursorScreenPoint = () => ({ x: -600, y: -785 });
  screen.getDisplayNearestPoint = () => display;
  screen.getDisplayMatching = () => display;
  for (const tray of [{ getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }) }, { getBounds() { throw new Error('Unsupported'); } }, {}]) {
    panel.resize(410); await panel.show(tray);
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

test('startup and unavailable cursor coordinates follow the reserved top panel', async () => {
  const { window, screen, panel } = controller();
  const display = { bounds: { x: 0, y: 0, width: 1280, height: 800 }, workArea: { x: 0, y: 32, width: 1280, height: 768 } };
  screen.getPrimaryDisplay = () => display;
  screen.getCursorScreenPoint = () => { throw new Error('Wayland'); };
  assert.equal(panelEdge(display), 'top');
  await panel.show({});
  assert.equal(window.bounds.y, 40);
  screen.getCursorScreenPoint = () => ({ x: 600, y: 400 });
  await panel.show({});
  assert.equal(window.bounds.y, 40);
  await panel.show();
  assert.equal(window.bounds.y, 40);
});

test('a small display does not permanently shrink the panel width', async () => {
  const { window, screen, panel } = controller();
  const primary = screen.getPrimaryDisplay;
  screen.getPrimaryDisplay = () => ({ workArea: { x: 0, y: 0, width: 360, height: 400 } });
  await panel.show();
  assert.equal(window.bounds.width, 344);
  screen.getPrimaryDisplay = primary;
  await panel.show();
  assert.equal(window.bounds.width, 528);
});

test('display changes re-read tray placement and move the open panel to the new edge', async () => {
  const { window, screen, panel } = controller();
  let bounds = { x: 500, y: 0, width: 24, height: 28 };
  panel.resize(410); await panel.show({ getBounds: () => bounds });
  bounds = { x: 700, y: 772, width: 24, height: 28 };
  screen.emit('display-metrics-changed');
  assert.equal(window.bounds.x, 448);
  assert.equal(window.bounds.y + window.bounds.height, 759);
});


test('short Linux content shrinks below the old 480px floor and grows again', async () => {
  const { window, panel } = controller();
  panel.resize(150); await panel.show();
  assert.equal(window.bounds.height, 180);
  const bottom = window.bounds.y + window.bounds.height;
  panel.resize(600);
  assert.equal(window.bounds.height, 720);
  panel.resize(150);
  assert.equal(window.bounds.height, 180);
  assert.equal(window.bounds.y + window.bounds.height, bottom);
  assert.equal(panelBounds({ area, contentHeight: 1 }).height, 80);
});

test('unknown tray geometry keeps a stable activation point across repeated clicks and Settings', async () => {
  const { window, screen, panel } = controller();
  let cursor = { x: 600, y: 790 };
  screen.getCursorScreenPoint = () => cursor;
  const tray = { getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }) };
  panel.resize(410); await panel.show(tray);
  const expected = window.getBounds();
  for (const x of [594, 607, 591, 610]) {
    cursor = { x, y: 785 };
    window.visible = false; await panel.show(tray);
    assert.deepEqual(window.bounds, expected);
  }
  cursor = { x: 300, y: 300 };
  await panel.show();
  assert.deepEqual(window.bounds, expected, 'opening Settings reuses the last tray anchor');
});

test('a different display edge gets its own stable fallback and valid icon bounds take priority', async () => {
  const { window, screen, panel } = controller();
  screen.getCursorScreenPoint = () => ({ x: 600, y: 790 });
  const tray = {};
  await panel.show(tray);
  const bottom = window.getBounds();
  screen.getCursorScreenPoint = () => ({ x: 400, y: 10 });
  await panel.show(tray);
  assert.notEqual(window.bounds.x, bottom.x);
  tray.getBounds = () => ({ x: 700, y: 0, width: 24, height: 24 });
  await panel.show(tray);
  assert.equal(window.bounds.x, 448);
});

test('saved manual placement is restored by the platform controller and kept during resize', async t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-panel-restore-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'linux-panel-position.json'), JSON.stringify({ x: 200, y: 70 }));
  const window = new FakeWindow();
  const display = { bounds: { x: 0, y: 0, width: 1440, height: 1000 }, workArea: { x: 0, y: 24, width: 1440, height: 976 } };
  const screen = new EventEmitter(); screen.getPrimaryDisplay = screen.getDisplayMatching = () => display;
  const panel = createPanelController({ window, screen, root, getTrayBounds: () => [], wait: async () => {}, attempts: 1 });
  await panel.show();
  assert.equal(window.bounds.x, 200); assert.equal(window.bounds.y, 70);
  panel.resize(420);
  assert.equal(window.bounds.x, 200); assert.equal(window.bounds.y, 70);
  window.emit('closed');
});


test('opening settles changed content at the final width before the first visible frame', async () => {
  const { window, panel } = controller();
  const heights = [180, 310, 310];
  const measuredWidths = [];
  window.webContents.executeJavaScript = async script => {
    if (!script.includes('window.limitsViewPanel.measure()')) return;
    assert.equal(window.visible, false);
    measuredWidths.push(window.bounds.width);
    return heights.shift();
  };
  assert.equal(await panel.show(), true);
  assert.deepEqual(measuredWidths, [528, 528, 528]);
  assert.equal(window.shownBounds.length, 1);
  assert.equal(window.shownBounds[0].height, 372);
  assert.deepEqual(window.preparedFrames, [
    { bounds: window.shownBounds[0], visible: false },
    { bounds: window.shownBounds[0], visible: true },
  ]);
  assert.equal(window.webContents.backgroundThrottling, false);
  panel.hide();
  assert.equal(window.webContents.backgroundThrottling, false);
  assert.deepEqual(window.bounds, window.shownBounds[0]);
});

test('a second tray click cancels an opening still waiting for the renderer', async () => {
  const { window, panel } = controller();
  let finish;
  window.webContents.executeJavaScript = () => new Promise(resolve => { finish = resolve; });
  const pending = panel.toggle({});
  assert.equal(window.visible, false);
  assert.equal(await panel.toggle({}), true);
  finish(310);
  assert.equal(await pending, false);
  assert.equal(window.webContents.backgroundThrottling, false);
  assert.equal(window.visible, false);
  assert.equal(window.shownBounds.length, 0);
});

test('closing the controller while preparing cannot show a retired window', async () => {
  const { window, panel } = controller();
  let finish;
  window.webContents.executeJavaScript = () => new Promise(resolve => { finish = resolve; });
  const pending = panel.show();
  panel.dispose();
  finish(310);
  assert.equal(await pending, false);
  assert.equal(window.shownBounds.length, 0);
});

test('opening an already visible panel focuses it without restarting the reveal', async () => {
  const { window, panel } = controller();
  await panel.show();
  window.webContents.executeJavaScript = async () => assert.fail('Visible panel should not replay its opening');
  assert.equal(await panel.show(), true);
  assert.equal(window.shownBounds.length, 1);
});


test('a cancelled opening cannot reveal a frame that finishes painting later', async () => {
  const { window, panel } = controller();
  let finishPaint;
  const painting = new Promise(resolve => { finishPaint = resolve; });
  let paintingStarted;
  const started = new Promise(resolve => { paintingStarted = resolve; });
  window.paintFrame = () => { paintingStarted(); return painting; };
  const pending = panel.show();
  await started;
  panel.hide();
  finishPaint();
  assert.equal(await pending, false);
  assert.equal(window.visible, false);
  assert.equal(window.shownBounds.length, 0);
});


test('hiding during native mapping cancels the reveal after the frame completes', async () => {
  const { window, panel } = controller();
  let finishMap, mapStarted;
  const mapping = new Promise(resolve => { finishMap = resolve; });
  const started = new Promise(resolve => { mapStarted = resolve; });
  window.paintFrame = async () => {
    if (window.visible) { mapStarted(); await mapping; }
  };
  window.webContents.executeJavaScript = async script => {
    assert.ok(!script.includes("classList.replace"), 'Cancelled opening must not reveal the mapped window');
  };
  const pending = panel.show();
  await started;
  panel.hide();
  finishMap();
  assert.equal(await pending, false);
  assert.equal(window.visible, false);
});


test('the renderer is revealed only after the window manager finishes placement', async () => {
  const { window, panel } = controller();
  let mapped = false, revealed = false;
  window.paintFrame = async () => {
    if (window.visible) {
      window.bounds.x -= 12;
      window.bounds.y -= 25;
      window.emit('move');
      mapped = true;
    }
  };
  window.webContents.executeJavaScript = async script => {
    if (script.includes('classList.replace')) {
      assert.equal(mapped, true);
      assert.equal(window.bounds.x, window.shownBounds[0].x - 12);
      assert.equal(window.bounds.y, window.shownBounds[0].y - 25);
      revealed = true;
    }
  };
  assert.equal(await panel.show(), true);
  assert.equal(revealed, true);
  panel.dispose();
});
