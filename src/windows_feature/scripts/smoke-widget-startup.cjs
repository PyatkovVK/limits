'use strict';
// Check real native ordering before any click/raise of the Windows taskbar.
const { app, screen, BrowserWindow } = require('electron');
const { spawnSync, execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { taskbarHelperPath } = require('../widget.cjs');
if (process.platform !== 'win32') throw new Error('Run the widget startup check on Windows.');

const artifactRoot = path.resolve(__dirname, '../../../artifacts');
fs.mkdirSync(artifactRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifactRoot, 'widget-startup-smoke-'));
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? profile : value);
app.disableHardwareAcceleration();

function inspect(window) {
  const handle = window.getNativeWindowHandle();
  const id = handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
  const result = spawnSync(taskbarHelperPath(), ['--test-widget-order', String(process.pid), id],
    { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return JSON.parse(result.stdout.trim());
}
function checkOrder(before, window) {
  const after = inspect(window);
  assert.equal(after.visible, true, 'Widget must be visible without clicking the taskbar');
  assert.equal(after.attached, true, 'Widget must be owned by the real taskbar');
  assert.equal(after.aboveTaskbar, true, 'Widget must already be above the taskbar');
  assert.equal(after.topmost, true, 'Widget must retain its native topmost style');
  assert.equal(after.foreground, before.foreground, 'Showing the widget must preserve foreground focus');
  return after;
}

let host, initial, raises = 0, lastMetrics;
const widgetModule = require('../widget.cjs');
const NativeWidget = widgetModule.TaskbarWidget;
widgetModule.TaskbarWidget = class extends NativeWidget {
  emit(event, ...args) {
    // Keep the UI test inspectable independently of other foreground apps.
    if (event === 'metrics') lastMetrics = args[0] = { ...args[0], fullscreen: false };
    if (event === 'window' && args[0]) {
      const moveTop = args[0].moveTop.bind(args[0]);
      args[0].moveTop = () => { raises++; moveTop(); };
    }
    return super.emit(event, ...args);
  }
  async start() {
    let before;
    this.once('window', window => { before = inspect(window); });
    await super.start();
    initial = checkOrder(before, this.window);
    host = this;
  }
};
process.argv.push('--demo', '--hidden');
require('../../common/main.cjs');

const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function click(target, selector) {
  const point = await target.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing click target');
    const r = node.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  target.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
  target.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
  await pause();
}
app.whenReady().then(async () => {
  try {
    const deadline = Date.now() + 10000;
    while (!host && Date.now() < deadline) await pause();
    assert.ok(host, 'Widget must start with a fresh profile');
    assert.equal(raises, 1, 'First display raises the widget once');
    host.probe.stop();
    const window = host.window;
    await window.webContents.executeJavaScript('window.renderReady');
    const before = inspect(window);
    await window.webContents.executeJavaScript("window.limits.displayMode('tray')");
    assert.equal(inspect(window).visible, false);
    await window.webContents.executeJavaScript("window.limits.displayMode('widget')");
    const restoredMode = checkOrder(before, window);
    assert.equal(raises, 2);

    const metrics = { ...lastMetrics,
      // Geometry simulations below start from the repaired native order, not
      // the helper's observation taken before the first show.
      topmost: restoredMode.topmost, aboveTaskbar: restoredMode.aboveTaskbar, widgetVisible: true,
      bar: screen.screenToDipRect(null, lastMetrics.bar),
      tray: lastMetrics.tray ? screen.screenToDipRect(null, lastMetrics.tray) : null,
      monitor: screen.screenToDipRect(null, lastMetrics.monitor),
      occupied: lastMetrics.occupied?.map(rect => screen.screenToDipRect(null, rect)),
    };
    const settings = { visible: true, width: 280 };
    host.placement.apply({ ...metrics, fullscreen: true }, settings);
    assert.equal(inspect(window).visible, false);
    host.placement.apply(metrics, settings);
    const restoredFullscreen = checkOrder(before, window);
    assert.equal(raises, 3);
    const changes = { ...host.placement.changes };
    for (let i = 0; i < 100; i++) host.placement.apply(metrics, settings);
    assert.deepEqual(host.placement.changes, changes, 'Unchanged polls must not show/resize the widget');
    assert.equal(raises, 3, 'Unchanged polls must not raise the widget');
    const simulatedOwner = new BrowserWindow({ width: 100, height: 40, show: false, frame: false, focusable: false, alwaysOnTop: true });
    simulatedOwner.showInactive();
    const id = target => target.getNativeWindowHandle().readBigInt64LE().toString();
    const loss = await new Promise((resolve, reject) => execFile(taskbarHelperPath(),
      ['--test-owner-demote', String(process.pid), id(window), id(simulatedOwner)],
      { windowsHide: true, timeout: 5000 }, (error, stdout) => error ? reject(error) : resolve(JSON.parse(stdout))));
    assert.equal(loss.topmost, false, 'Reproduce Windows demoting an owned widget');
    const foreground = inspect(window).foreground;
    host.placement.apply({ ...metrics, topmost: false }, settings);
    const repaired = inspect(window);
    assert.equal(repaired.topmost, true, 'Repair the native style even if Electron cached alwaysOnTop');
    assert.equal(repaired.visible, true);
    assert.equal(repaired.foreground, foreground, 'Repair must not take focus');
    await host.probe.start(); // Reattach to Explorer before disposing our simulated owner.
    host.probe.stop();
    assert.equal(inspect(window).attached, true);
    simulatedOwner.destroy();
    host.placement.apply({ available: false }, settings);
    assert.equal(inspect(window).visible, true, 'Helper outages must not hide a placed bar');
    host.placement.apply({ ...metrics, visible: false }, settings);
    assert.equal(inspect(window).visible, false, 'Taskbar auto-hide still suppresses the bar');
    host.placement.apply({ available: false }, settings);
    assert.equal(inspect(window).visible, false, 'An outage must preserve intentional hiding');
    const crowded = { ...metrics, occupied: [metrics.bar] };
    host.placement.apply(crowded, settings);
    const fallback = window.getBounds();
    assert.equal(inspect(window).visible, true, 'A crowded taskbar uses a separate row');
    const top = metrics.bar.y < metrics.monitor.y + metrics.monitor.height / 2;
    assert.ok(top ? fallback.y >= metrics.bar.y + metrics.bar.height : fallback.y + fallback.height <= metrics.bar.y,
      'The Windows-accepted height must not overlap shell buttons');
    host.placement.apply(metrics, settings);

    const panel = BrowserWindow.getAllWindows().find(target => target.webContents.getURL().endsWith('/index.html'));
    assert.ok(panel);
    await panel.webContents.executeJavaScript('window.renderReady');
    const clicks = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const selector of ['#short-reset', '#short-bar', '#short-value', '#weekly-reset', '#weekly-bar', '#weekly-value']) {
        panel.hide();
        await click(window, selector);
        assert.equal(panel.isVisible(), true, selector + ' must open details');
        const order = inspect(window);
        assert.ok(order.visible && order.topmost && order.aboveTaskbar, selector + ' must keep the bar above Explorer');
        clicks.push(selector);
      }
      await click(panel, '#settings-button');
      assert.equal(await panel.webContents.executeJavaScript('window.limitsSettings.dialog.open'), true);
      await click(panel, '.settings-close');
      assert.equal(await panel.webContents.executeJavaScript('window.limitsSettings.dialog.open'), false);
      await click(panel, '#hide');
      assert.equal(panel.isVisible(), false);
      assert.equal(inspect(window).visible, true, 'Closing details must keep the bar visible');
    }
    const screenshot = path.join(artifactRoot, 'widget-startup.png');
    fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
    const report = { initial, restoredMode, restoredFullscreen, repaired, fallback, clicks, panelClicks: 9, raises, unchangedPolls: 100, screenshot };
    fs.writeFileSync(path.join(artifactRoot, 'widget-startup-smoke.json'), JSON.stringify(report, null, 2));
    console.log('WIDGET_STARTUP_SMOKE_OK', JSON.stringify(report));
    app.quit();
  } catch (error) { console.error('WIDGET_STARTUP_SMOKE_FAILED', error); app.exit(1); }
});
