'use strict';
// Check real native ordering before any click/raise of the Windows taskbar.
const { app, screen, BrowserWindow } = require('electron');
const { execFile } = require('node:child_process');
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

const runHelper = args => new Promise((resolve, reject) => execFile(taskbarHelperPath(), args,
  { encoding: 'utf8', windowsHide: true, timeout: 5000 }, (error, stdout) => error ? reject(error) : resolve(JSON.parse(stdout.trim()))));
async function inspect(window) {
  const handle = window.getNativeWindowHandle();
  const id = handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
  return runHelper(['--test-widget-order', String(process.pid), id]);
}
async function checkOrder(before, window) {
  const after = await inspect(window);
  assert.equal(after.visible, true, 'Widget must be visible without clicking the taskbar');
  assert.equal(after.attached, true, 'Widget must be owned by the real taskbar');
  assert.equal(after.aboveTaskbar, true, 'Widget must already be above the taskbar');
  assert.equal(after.topmost, true, 'Widget must retain its native topmost style');
  assert.equal(after.foreground, before.foreground, 'Showing the widget must preserve foreground focus');
  return after;
}

let host, initial, raises = 0, lastMetrics, metricsOverride;
const widgetModule = require('../widget.cjs');
const NativeWidget = widgetModule.TaskbarWidget;
widgetModule.TaskbarWidget = class extends NativeWidget {
  emit(event, ...args) {
    // Keep the UI test inspectable independently of other foreground apps.
    if (event === 'metrics') lastMetrics = args[0] = { ...args[0], fullscreen: false, ...metricsOverride };
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
    initial = await checkOrder(await before, this.window);
    host = this;
  }
};
process.argv.push('--demo', '--hidden');
require('../../common/main.cjs');

const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await pause();
  assert.ok(check(), 'Native parent/placement transition must complete');
}
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
    assert.equal(raises, 0, 'A taskbar child needs no top-level z-order repair');
    host.probe.stop();
    const window = host.window;
    await window.webContents.executeJavaScript('window.renderReady');
    const before = await inspect(window);
    await window.webContents.executeJavaScript("window.limits.displayMode('tray')");
    assert.equal((await inspect(window)).visible, false);
    await window.webContents.executeJavaScript("window.limits.displayMode('widget')");
    const restoredMode = await checkOrder(before, window);
    assert.equal(raises, 0);

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
    assert.equal((await inspect(window)).visible, false);
    host.placement.apply(metrics, settings);
    const restoredFullscreen = await checkOrder(before, window);
    assert.equal(raises, 0);
    const changes = { ...host.placement.changes };
    for (let i = 0; i < 100; i++) host.placement.apply(metrics, settings);
    assert.deepEqual(host.placement.changes, changes, 'Unchanged polls must not show/resize the widget');
    assert.equal(raises, 0, 'Unchanged polls must not raise the widget');
    host.placement.apply({ available: false }, settings);
    assert.equal((await inspect(window)).visible, true, 'Helper outages must not hide a placed bar');
    host.placement.apply({ ...metrics, visible: false }, settings);
    assert.equal((await inspect(window)).visible, false, 'Taskbar auto-hide still suppresses the bar');
    host.placement.apply({ available: false }, settings);
    assert.equal((await inspect(window)).visible, false, 'An outage must preserve intentional hiding');
    metricsOverride = { occupied: [lastMetrics.bar] };
    await host.probe.start();
    await until(() => lastMetrics.parented === false && window.getBounds().y < metrics.bar.y);
    const fallback = window.getBounds();
    assert.equal((await inspect(window)).visible, true, 'A crowded taskbar uses a separate row');
    const top = metrics.bar.y < metrics.monitor.y + metrics.monitor.height / 2;
    assert.ok(top ? fallback.y >= metrics.bar.y + metrics.bar.height : fallback.y + fallback.height <= metrics.bar.y,
      'The Windows-accepted height must not overlap shell buttons');
    metricsOverride = null;
    host.probe.child.stdin.write('query\n');
    await until(() => lastMetrics.parented === true && window.getBounds().y >= metrics.bar.y);
    host.probe.stop();
    const restoredParent = await checkOrder(before, window);

    const shellChecks = [];
    for (const [cls, processName, shell, flyout] of [
      ['ControlCenterWindow', 'ShellHost', true, true], ['Windows.UI.Core.CoreWindow', 'ShellExperienceHost', true, true],
      ['CabinetWClass', 'explorer', true, false], ['Shell_TrayWnd', 'explorer', true, false],
      ['SDL_app', 'game', false, false], ['ApplicationFrameWindow', 'ApplicationFrameHost', false, false]]) {
      assert.deepEqual(await runHelper(['--test-shell-window', cls, processName]), { shell, flyout });
      shellChecks.push({ cls, processName, shell, flyout });
    }

    const panel = BrowserWindow.getAllWindows().find(target => target.webContents.getURL().endsWith('/index.html'));
    assert.ok(panel);
    await panel.webContents.executeJavaScript('window.renderReady');
    const clicks = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const selector of ['#short-reset', '#short-bar', '#short-value', '#weekly-reset', '#weekly-bar', '#weekly-value']) {
        panel.hide();
        await click(window, selector);
        assert.equal(panel.isVisible(), true, selector + ' must open details');
        const order = await inspect(window);
        assert.ok(order.visible && order.topmost && order.aboveTaskbar, selector + ' must keep the bar above Explorer');
        clicks.push(selector);
      }
      await click(panel, '#settings-button');
      assert.equal(await panel.webContents.executeJavaScript('window.limitsSettings.dialog.open'), true);
      await click(panel, '.settings-close');
      assert.equal(await panel.webContents.executeJavaScript('window.limitsSettings.dialog.open'), false);
      await click(panel, '#hide');
      assert.equal(panel.isVisible(), false);
      assert.equal((await inspect(window)).visible, true, 'Closing details must keep the bar visible');
    }
    const screenshot = path.join(artifactRoot, 'widget-startup.png');
    fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
    const report = { initial, restoredMode, restoredFullscreen, restoredParent, fallback, shellChecks, clicks, panelClicks: 9, raises, unchangedPolls: 100, screenshot };
    fs.writeFileSync(path.join(artifactRoot, 'widget-startup-smoke.json'), JSON.stringify(report, null, 2));
    console.log('WIDGET_STARTUP_SMOKE_OK', JSON.stringify(report));
    app.quit();
  } catch (error) { console.error('WIDGET_STARTUP_SMOKE_FAILED', error); app.exit(1); }
});
