'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { panelPosition, createPanelController } = require('../panel.cjs');

const area = { x: 0, y: 0, width: 1920, height: 1032 };
const bounds = { x: 800, y: 1032, width: 280, height: 34 };
function controller() {
  const window = {
    destroyed: false, visible: false, position: [0, 0], moves: 0, shows: 0, focuses: 0,
    isDestroyed() { return this.destroyed; },
    isVisible() { return this.visible; },
    getSize: () => [440, 590],
    getPosition() { return this.position; },
    setPosition(x, y) { this.position = [x, y]; this.moves++; },
    show() { this.visible = true; this.shows++; },
    focus() { this.focuses++; },
  };
  const widget = {
    destroyed: false, visible: true, bounds: { ...bounds },
    isDestroyed() { return this.destroyed; },
    isVisible() { return this.visible; },
    getBounds() { return this.bounds; },
  };
  const screen = { getDisplayMatching: () => ({ workArea: area }), getPrimaryDisplay: () => ({ workArea: area }) };
  const panel = createPanelController({ window, screen, getAnchorBounds: () => widget.bounds });
  return { window, widget, screen, panel };
}

test('open Windows details follow the widget without showing or focusing again', () => {
  const { window, widget, panel } = controller();
  panel.show();
  assert.deepEqual(window.position, [720, 434]);
  widget.bounds.x = 400;
  assert.equal(panel.follow(widget), true);
  assert.deepEqual(window.position, [320, 434]);
  assert.equal(window.shows, 1);
  assert.equal(window.focuses, 1);
  for (let i = 0; i < 20; i++) panel.follow(widget);
  assert.equal(window.moves, 2);
});

test('moving the widget keeps a dismissed panel hidden and in its last position', () => {
  const { window, widget, panel } = controller();
  panel.show(); window.visible = false;
  widget.bounds.x = 400;
  assert.equal(panel.follow(widget), false);
  assert.deepEqual(window.position, [720, 434]);
  assert.equal(window.shows, 1);
  panel.show();
  assert.deepEqual(window.position, [320, 434]);
});

test('hidden and destroyed widgets or panels never move the details window', () => {
  for (const target of ['window', 'widget']) {
    const context = controller(); context.panel.show();
    context.widget.bounds.x = 400;
    context[target].destroyed = true;
    assert.equal(context.panel.follow(context.widget), false);
    assert.equal(context.window.moves, 1);
  }
  const { window, widget, panel } = controller(); panel.show();
  widget.visible = false; widget.bounds.x = 400;
  assert.equal(panel.follow(widget), false);
  assert.equal(window.moves, 1);
});

test('the panel stays on screen at both taskbar edges and follows widget resizing', () => {
  const { window, widget, panel } = controller(); panel.show();
  widget.bounds.x = 56; panel.follow(widget);
  assert.deepEqual(window.position, [0, 434]);
  widget.bounds.x = 1640; panel.follow(widget);
  assert.deepEqual(window.position, [1480, 434]);
  widget.bounds.x = 800; widget.bounds.width = 200; panel.follow(widget);
  assert.deepEqual(window.position, [680, 434]);
});

test('placement uses the widget display and supports negative monitor origins and a top taskbar', () => {
  const { window, widget, screen, panel } = controller();
  const secondary = { x: -1920, y: -1080, width: 1920, height: 1032 };
  screen.getDisplayMatching = anchor => { assert.equal(anchor, widget.bounds); return { workArea: secondary }; };
  widget.bounds = { x: -800, y: -48, width: 280, height: 34 };
  panel.show();
  assert.deepEqual(window.position, [-880, -646]);
  assert.deepEqual(panelPosition({ anchor: { ...bounds, y: 0 }, area: { ...area, y: 48 }, size: [440, 590] }), { x: 720, y: 56 });
});

test('opening from a tray click uses its bounds rather than the widget', () => {
  const { window, panel } = controller();
  panel.show({ getBounds: () => ({ ...bounds, x: 1650, width: 32 }) });
  assert.deepEqual(window.position, [1446, 434]);
  assert.deepEqual(panelPosition({ anchor: { x: 0, y: 0, width: 0, height: 0 }, area, size: [440, 590] }), { x: 1464, y: 434 });
});
