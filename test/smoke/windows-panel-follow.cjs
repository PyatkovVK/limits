'use strict';
// Exercise the actual widget drag handler and panel controller using isolated demo data.
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { panelPosition } = require('../../src/windows_feature/panel/panel.cjs');
if (process.platform !== 'win32') throw new Error('Run the panel follow check on Windows.');

const artifactRoot = path.resolve(__dirname, '../../artifacts');
fs.mkdirSync(artifactRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifactRoot, 'panel-follow-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.disableHardwareAcceleration();

// Foreground apps must not affect this test's own widget visibility.
const widgetModule = require('../../src/windows_feature/widget/host.cjs');
const NativeWidget = widgetModule.TaskbarWidget;
widgetModule.TaskbarWidget = class extends NativeWidget {
  emit(event, ...args) {
    if (event === 'metrics') args[0] = { ...args[0], fullscreen: false };
    return super.emit(event, ...args);
  }
};
const panelModule = require('../../src/windows_feature/panel/panel.cjs');
const createPanel = panelModule.createPanelController;
let reducedMotion = false;
panelModule.createPanelController = options => createPanel({ ...options, reducedMotion: () => reducedMotion });
process.argv.push('--demo', '--hidden');
require('../../src/main.cjs');

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
    await panel.webContents.executeJavaScript('window.limitsViewPanelReady');
    await pause();
    const compactHeight = panel.getSize()[1];
    assert.ok(compactHeight < 400, 'Details must fit their content instead of the old 590 px window: ' + JSON.stringify(await panel.webContents.executeJavaScript('({height:innerHeight, measured:window.limitsViewPanel?.measure(), platform:document.body.dataset.platform})')));
    await panel.webContents.executeJavaScript('window.limitsSettings.open(); window.limitsViewPanel.report()');
    await pause();
    const settingsHeight = panel.getSize()[1];
    assert.ok(settingsHeight > compactHeight, 'Settings must grow the window');
    await panel.webContents.executeJavaScript('window.limitsSettings.dialog.close(); window.limitsViewPanel.report()');
    await pause();
    assert.ok(Math.abs(panel.getSize()[1] - compactHeight) <= 1, 'Closing Settings must shrink the window (allowing native pixel rounding)');
    const calls = { shows: 0, focuses: 0 };
    const show = panel.show.bind(panel), focus = panel.focus.bind(panel);
    panel.show = (...args) => { calls.shows++; return show(...args); };
    panel.focus = (...args) => { calls.focuses++; return focus(...args); };
    const open = () => widget.webContents.executeJavaScript('window.limits.open()');
    async function observeReveal() {
      const frames = [];
      const record = () => { if (panel.isVisible()) frames.push({ opacity: panel.getOpacity(), bounds: panel.getBounds() }); };
      const timer = setInterval(record, 8);
      panel.once('show', record);
      try {
        await open();
        const deadline = Date.now() + 1500;
        while (panel.getOpacity() < 1 && Date.now() < deadline) await pause(15);
        record();
        assert.ok(panel.isVisible());
        assert.equal(panel.getOpacity(), 1, 'The panel must reach full opacity');
        return frames;
      } finally {
        clearInterval(timer);
        panel.removeListener('show', record);
      }
    }
    async function observeResize(action, expectedHeight) {
      const frames = [];
      const record = () => { if (panel.isVisible()) frames.push(panel.getBounds()); };
      panel.on('resize', record);
      panel.on('show', record);
      try {
        await action();
        const deadline = Date.now() + 1500;
        while (Math.abs(panel.getSize()[1] - expectedHeight) > 1 && Date.now() < deadline) await pause(15);
        record();
        assert.ok(panel.isVisible());
        assert.ok(Math.abs(panel.getSize()[1] - expectedHeight) <= 1, 'The panel must settle at the measured height');
        return frames;
      } finally {
        panel.removeListener('resize', record);
        panel.removeListener('show', record);
      }
    }
    const openSettings = () => panel.webContents.executeJavaScript('window.limitsSettings.open(); window.limitsViewPanel.report()');
    const closeSettings = () => panel.webContents.executeJavaScript('window.limitsSettings.dialog.close(); window.limitsViewPanel.report()');
    // First open and reopen both start transparent at the final size.
    const reveal = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const frames = await observeReveal();
      assert.equal(frames[0].opacity, 0, 'The first visible frame must be transparent');
      assert.ok(frames.filter(frame => frame.opacity > 0 && frame.opacity < 1).length >= 3);
      for (const [index, frame] of frames.entries()) {
        assert.deepEqual(frame.bounds, frames[0].bounds, 'Opening must not resize or move the native surface');
        assert.ok(index === 0 || frames[index - 1].opacity <= frame.opacity, 'Reveal must never flash back to a lower opacity');
      }
      assert.ok(Math.abs(frames[0].bounds.height - compactHeight) <= 1);
      reveal.push(frames.map(frame => frame.opacity));
      if (attempt === 0) panel.hide();
    }
    const grow = await observeResize(openSettings, settingsHeight);
    const shrink = await observeResize(closeSettings, compactHeight);
    const area = screen.getDisplayMatching(widget.getBounds()).workArea;
    const anchoredAtTop = widget.getBounds().y < area.y + area.height / 2;
    const anchorEdge = bounds => anchoredAtTop ? bounds.y : bounds.y + bounds.height;
    for (const [name, frames] of Object.entries({ grow, shrink })) {
      assert.ok(new Set(frames.map(frame => frame.height)).size >= 3, `${name} must use intermediate native heights`);
      const edges = frames.map(anchorEdge);
      assert.ok(Math.max(...edges) - Math.min(...edges) <= 1, `${name} must keep the taskbar-facing edge fixed`);
    }
    panel.hide();
    reducedMotion = true;
    const instant = await observeReveal();
    assert.ok(instant.every(frame => frame.opacity === 1 && Math.abs(frame.bounds.height - compactHeight) <= 1), 'Reduced motion must show a complete panel immediately');
    reducedMotion = false;
    const openings = { ...calls };
    const before = { widget: widget.getBounds(), panel: panel.getBounds() };
    let testCursor;
    const readCursor = screen.getCursorScreenPoint;
    screen.getCursorScreenPoint = () => testCursor;
    const pointIn = selector => widget.webContents.executeJavaScript(`(() => {
      if (${JSON.stringify(selector)} === 'body') return {x:2,y:2};
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      if (!rect.width || !rect.height) throw new Error('Drag target must have a visible rectangle');
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
    const dragTargets = ['.account', '.period span', '#short-reset', '[data-i18n="weeklyCompact"]', '#short-bar', '#weekly-bar', '#short-value', '#weekly-value', 'body'];
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
    await pause();
    panel.emit('moved');
    const manual = panel.getPosition();
    await pause(1100);
    assert.deepEqual(panel.getPosition(), manual);
    panel.hide();
    await drag(Math.round(area.x + area.width * .2));
    assert.equal(panel.isVisible(), false);
    assert.deepEqual(panel.getPosition(), manual);
    assert.deepEqual(calls, openings);
    await widget.webContents.executeJavaScript('window.limits.open()');
    await pause(230);
    assert.deepEqual(panel.getPosition(), manual);
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'windows-panel-position.json'), 'utf8'));
    assert.deepEqual(saved, { x: manual[0], y: manual[1] });
    await openSettings();
    await pause(230);
    assert.deepEqual(panel.getPosition(), [manual[0], Math.max(area.y, Math.min(manual[1], area.y + area.height - panel.getSize()[1]))], 'Settings must preserve placement unless the work area requires clamping');
    await closeSettings();
    await pause(230);
    assert.deepEqual(panel.getPosition(), manual, 'Shrinking content restores the preferred position');
    const restoredWindow = new BrowserWindow({ width: 440, height: compactHeight, show: false });
    const restored = createPanel({ window: restoredWindow, screen, root: profile, reducedMotion: () => true });
    restored.show(); await pause();
    assert.deepEqual(restoredWindow.getPosition(), manual, 'A new controller must restore the persisted position');
    restoredWindow.destroy(); panel.show();
    fs.writeFileSync(path.join(artifactRoot, 'windows-panel-compact.png'), (await panel.webContents.capturePage()).toPNG());
    const clickTargets = dragTargets;
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
    const report = { compactHeight, settingsHeight, reveal, grow, shrink, reducedMotion: true, continuousCursorDrag: true, before, moves, clickTargets, nonPointerClickOpensDetails: true, manualPositionPreserved: true, hiddenPanelStayedHidden: true, restoredSavedPosition: true };
    fs.writeFileSync(path.join(artifactRoot, 'panel-follow-smoke.json'), JSON.stringify(report, null, 2));
    console.log('PANEL_FOLLOW_SMOKE_OK', JSON.stringify(report));
    app.exit(0);
  } catch (error) {
    console.error('PANEL_FOLLOW_SMOKE_FAILED:', error.stack); app.exit(1);
  }
});
