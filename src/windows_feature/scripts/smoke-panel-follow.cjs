'use strict';
// Exercise the actual widget drag handler and panel controller using isolated demo data.
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { panelPosition } = require('../panel.cjs');
if (process.platform !== 'win32') throw new Error('Run the panel follow check on Windows.');

const artifactRoot = path.resolve(__dirname, '../../../artifacts');
fs.mkdirSync(artifactRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifactRoot, 'panel-follow-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.disableHardwareAcceleration();

// Foreground apps must not affect this test's own widget visibility.
const widgetModule = require('../widget.cjs');
const NativeWidget = widgetModule.TaskbarWidget;
widgetModule.TaskbarWidget = class extends NativeWidget {
  emit(event, ...args) {
    if (event === 'metrics') args[0] = { ...args[0], fullscreen: false };
    return super.emit(event, ...args);
  }
};
process.argv.push('--demo', '--hidden');
require('../../common/main.cjs');

const pause = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    let widget, panel;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const windows = BrowserWindow.getAllWindows().filter(window => !window.isDestroyed());
      widget = windows.find(window => window.webContents.getURL().endsWith('/widget.html'));
      panel = windows.find(window => window.webContents.getURL().endsWith('/index.html'));
      if (widget?.isVisible() && panel && !panel.webContents.isLoading() && !widget.webContents.isLoading()) break;
      await pause();
    }
    assert.ok(widget?.isVisible(), 'Demo taskbar widget must be ready');
    assert.ok(panel, 'Details panel must be ready');
    await widget.webContents.executeJavaScript('window.renderReady');
    await panel.webContents.executeJavaScript('window.renderReady');
    await panel.webContents.executeJavaScript('window.limitsWindowsPanelReady');
    await pause();
    const compactHeight = panel.getSize()[1];
    assert.ok(compactHeight < 400, 'Details must fit their content instead of the old 590 px window: ' + JSON.stringify(await panel.webContents.executeJavaScript('({height:innerHeight, measured:window.limitsWindowsPanel?.measure(), platform:document.body.dataset.platform})')));
    await panel.webContents.executeJavaScript('window.limitsSettings.open(); window.limitsWindowsPanel.report()');
    await pause();
    const settingsHeight = panel.getSize()[1];
    assert.ok(settingsHeight > compactHeight, 'Settings must grow the window');
    await panel.webContents.executeJavaScript('window.limitsSettings.dialog.close(); window.limitsWindowsPanel.report()');
    await pause();
    assert.ok(Math.abs(panel.getSize()[1] - compactHeight) <= 1, 'Closing Settings must shrink the window (allowing native pixel rounding)');
    const calls = { shows: 0, focuses: 0 };
    const show = panel.show.bind(panel), focus = panel.focus.bind(panel);
    panel.show = (...args) => { calls.shows++; return show(...args); };
    panel.focus = (...args) => { calls.focuses++; return focus(...args); };
    await widget.webContents.executeJavaScript('window.limits.open()');
    assert.equal(panel.isVisible(), true);
    const openings = { ...calls };
    const before = { widget: widget.getBounds(), panel: panel.getBounds() };
    const area = screen.getDisplayMatching(widget.getBounds()).workArea;
    let testCursor;
    const readCursor = screen.getCursorScreenPoint;
    screen.getCursorScreenPoint = () => testCursor;
    const pointIn = selector => widget.webContents.executeJavaScript(`(() => {
      if (${JSON.stringify(selector)} === 'body') return {x:2,y:2};
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return {x:Math.floor(rect.x + rect.width / 2),y:Math.floor(rect.y + rect.height / 2)};
    })()`);
    const drag = async (x, selector = '.account') => {
      const startX = widget.getBounds().x;
      const grab = await pointIn(selector);
      testCursor = { x: startX + grab.x, y: widget.getBounds().y + grab.y };
      widget.webContents.sendInputEvent({ type: 'mouseDown', ...grab, button: 'left', clickCount: 1 });
      await pause();
      const steps = Math.max(1, Math.ceil(Math.abs(x - startX) / 20));
      for (let step = 1; step <= steps; step++) {
        testCursor.x = startX + grab.x + Math.round((x - startX) * step / steps);
        widget.webContents.sendInputEvent({ type: 'mouseMove', x: grab.x + (step === 1 && x !== startX ? 5 : 0), y: grab.y });
        await pause(20);
      }
      widget.webContents.sendInputEvent({ type: 'mouseUp', ...grab, button: 'left', clickCount: 1 });
      await pause();
    };
    const expectedPosition = () => panelPosition({
      anchor: widget.getBounds(), area: screen.getDisplayMatching(widget.getBounds()).workArea, size: panel.getSize(),
    });
    const moves = [];
    const dragTargets = ['.account', '.period span', '#short-reset', '.quota:nth-child(2) > span', '#short-bar', '#weekly-bar', '#short-value', '#weekly-value', 'body'];
    for (const [index, selector] of dragTargets.entries()) {
      const x = Math.round(area.x + area.width * (index % 2 ? .9 : .12));
      const previousX = widget.getBounds().x;
      await drag(x, selector);
      assert.notEqual(widget.getBounds().x, previousX, `Dragging ${selector} must move the widget`);
      const expected = expectedPosition();
      assert.deepEqual(panel.getPosition(), [expected.x, expected.y]);
      assert.ok(panel.isVisible());
      assert.deepEqual(calls, openings, 'Following must not show or focus the panel again');
      moves.push({ selector, widget: widget.getBounds(), panel: panel.getBounds() });
    }
    // A stationary widget must not snap a manually moved details window back on polling.
    panel.setPosition(area.x + 40, area.y + 40);
    const manual = panel.getPosition();
    await drag(widget.getBounds().x);
    assert.deepEqual(panel.getPosition(), manual);
    panel.hide();
    await drag(Math.round(area.x + area.width * .2));
    assert.equal(panel.isVisible(), false);
    assert.deepEqual(panel.getPosition(), manual);
    assert.deepEqual(calls, openings);
    await widget.webContents.executeJavaScript('window.limits.open()');
    const expected = expectedPosition();
    assert.deepEqual(panel.getPosition(), [expected.x, expected.y]);
    fs.writeFileSync(path.join(artifactRoot, 'windows-panel-compact.png'), (await panel.webContents.capturePage()).toPNG());
    const clickTargets = dragTargets.filter(selector => !['.account', 'body'].includes(selector));
    for (const selector of clickTargets) {
      panel.hide();
      const bounds = widget.getBounds(), point = await pointIn(selector);
      testCursor = { x: bounds.x + point.x, y: bounds.y + point.y };
      widget.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
      widget.webContents.sendInputEvent({ type: 'mouseMove', x: point.x + 1, y: point.y });
      widget.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
      await pause();
      assert.ok(panel.isVisible(), `Clicking ${selector} must still open details`);
      assert.deepEqual(widget.getBounds(), bounds, 'A click with slight mouse jitter must not move the widget');
    }
    panel.hide();
    await widget.webContents.executeJavaScript("document.getElementById('details').click()");
    await pause();
    assert.ok(panel.isVisible(), 'Non-pointer activation must still open details');
    screen.getCursorScreenPoint = readCursor;
    const report = { compactHeight, settingsHeight, shrankAfterSettings: true, continuousCursorDrag: true, before, moves, clickTargets, nonPointerClickOpensDetails: true, manualPositionPreserved: true, hiddenPanelStayedHidden: true, reopenedAtWidget: true };
    fs.writeFileSync(path.join(artifactRoot, 'panel-follow-smoke.json'), JSON.stringify(report, null, 2));
    console.log('PANEL_FOLLOW_SMOKE_OK', JSON.stringify(report));
    app.exit(0);
  } catch (error) {
    console.error('PANEL_FOLLOW_SMOKE_FAILED:', error.message); app.exit(1);
  }
});
