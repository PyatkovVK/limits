'use strict';
// Check real native ordering before any click/raise of the Windows taskbar.
const { app, screen } = require('electron');
const { spawnSync } = require('node:child_process');
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
      bar: screen.screenToDipRect(null, lastMetrics.bar),
      tray: lastMetrics.tray ? screen.screenToDipRect(null, lastMetrics.tray) : null,
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
    const screenshot = path.join(artifactRoot, 'widget-startup.png');
    fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
    const report = { initial, restoredMode, restoredFullscreen, raises, unchangedPolls: 100, screenshot };
    fs.writeFileSync(path.join(artifactRoot, 'widget-startup-smoke.json'), JSON.stringify(report, null, 2));
    console.log('WIDGET_STARTUP_SMOKE_OK', JSON.stringify(report));
    app.quit();
  } catch (error) { console.error('WIDGET_STARTUP_SMOKE_FAILED', error); app.exit(1); }
});
