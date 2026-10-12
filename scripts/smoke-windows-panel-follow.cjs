'use strict';
// Exercise the actual widget drag handler and panel controller using isolated demo data.
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { panelPosition } = require('../src/windows_feature/panel.cjs');
if (process.platform !== 'win32') throw new Error('Run the panel follow check on Windows.');

const artifactRoot = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(artifactRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifactRoot, 'panel-follow-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.disableHardwareAcceleration();

// Foreground apps must not affect this test's own widget visibility.
const widgetModule = require('../src/windows_feature/widget.cjs');
const NativeWidget = widgetModule.TaskbarWidget;
widgetModule.TaskbarWidget = class extends NativeWidget {
  emit(event, ...args) {
    if (event === 'metrics') args[0] = { ...args[0], fullscreen: false };
    return super.emit(event, ...args);
  }
};
process.argv.push('--demo', '--hidden');
require('../src/common/main.cjs');

const pause = () => new Promise(resolve => setTimeout(resolve, 100));
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
    const calls = { shows: 0, focuses: 0 };
    const show = panel.show.bind(panel), focus = panel.focus.bind(panel);
    panel.show = (...args) => { calls.shows++; return show(...args); };
    panel.focus = (...args) => { calls.focuses++; return focus(...args); };
    await widget.webContents.executeJavaScript('window.limits.open()');
    assert.equal(panel.isVisible(), true);
    const openings = { ...calls };
    const before = { widget: widget.getBounds(), panel: panel.getBounds() };
    const area = screen.getDisplayMatching(widget.getBounds()).workArea;
    const drag = async x => {
      let prevented = false;
      widget.emit('will-move', { preventDefault() { prevented = true; } }, { ...widget.getBounds(), x });
      assert.ok(prevented, 'Use the app drag handler rather than a native free move');
      await pause();
    };
    const expectedPosition = () => panelPosition({
      anchor: widget.getBounds(), area: screen.getDisplayMatching(widget.getBounds()).workArea, size: panel.getSize(),
    });
    const moves = [];
    for (const x of [Math.round(area.x + area.width * .12), Math.round(area.x + area.width * .55)]) {
      const previousX = widget.getBounds().x;
      await drag(x);
      assert.notEqual(widget.getBounds().x, previousX);
      const expected = expectedPosition();
      assert.deepEqual(panel.getPosition(), [expected.x, expected.y]);
      assert.ok(panel.isVisible());
      assert.deepEqual(calls, openings, 'Following must not show or focus the panel again');
      moves.push({ widget: widget.getBounds(), panel: panel.getBounds() });
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
    const report = { before, moves, manualPositionPreserved: true, hiddenPanelStayedHidden: true, reopenedAtWidget: true };
    fs.writeFileSync(path.join(artifactRoot, 'panel-follow-smoke.json'), JSON.stringify(report, null, 2));
    console.log('PANEL_FOLLOW_SMOKE_OK', JSON.stringify(report));
    app.exit(0);
  } catch (error) {
    console.error('PANEL_FOLLOW_SMOKE_FAILED:', error.message); app.exit(1);
  }
});
