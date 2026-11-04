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
  { encoding: 'utf8', windowsHide: true, timeout: 5000 }, (error, stdout) => {
    if (error) return reject(error);
    try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); }
  }));
async function inspect(window) {
  const handle = window.getNativeWindowHandle();
  const id = handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
  return runHelper(['--test-widget-order', String(process.pid), id]);
}
async function checkOrder(before, window) {
  const after = await inspect(window);
  assert.equal(after.visible, true, 'Widget must be visible without clicking the taskbar');
  assert.equal(after.inputEnabled, true, 'Native widget must accept mouse input');
  assert.equal(after.receivesInput, true, 'Real Windows hit testing must reach the widget: ' + JSON.stringify(after));
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
async function click(target, selector, delta, fast = false) {
  const point = await target.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing click target');
    const r = node.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (target.webContents.getURL().endsWith('/widget.html')) {
    const handle = target.getNativeWindowHandle();
    const id = handle.length === 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
    const bounds = target.getBounds();
    const native = screen.dipToScreenPoint({ x: bounds.x + point.x, y: bounds.y + point.y });
    await runHelper([delta ? fast ? '--test-widget-drag-fast' : '--test-widget-drag' : '--test-widget-click', String(process.pid), id, String(native.x), String(native.y), ...(delta ? [String(delta)] : [])]);
  } else {
    target.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
    target.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
  }
  await pause();
}
app.whenReady().then(async () => {
  try {
    const deadline = Date.now() + 10000;
    while (!host && Date.now() < deadline) await pause();
    assert.ok(host, 'Widget must start with a fresh profile');
    assert.equal(raises, 0, 'An embedded widget must not fight Explorer with top-level raises');
    clearInterval(host.probe.timer); // Keep the native input bridge alive while freezing geometry.
    const window = host.window;
    await window.webContents.executeJavaScript('window.renderReady');
    await click(window, '#short-value');
    assert.equal(BrowserWindow.getAllWindows().find(target => target.webContents.getURL().endsWith('/index.html')).isVisible(), true, 'Freshly attached widget must accept a real click');
    const dragBefore = window.getBounds();
    await click(window, '.account', -40);
    assert.ok(window.getBounds().x < dragBefore.x - 20, 'A real held-button gesture must move the widget');
    const fastBefore = window.getBounds();
    await click(window, '#short-bar', -100, true);
    assert.ok(window.getBounds().x < fastBefore.x - 80, 'A quick real drag must retain the original press position');
    BrowserWindow.getAllWindows().find(target => target.webContents.getURL().endsWith('/index.html')).hide();
    await pause(); const before = await inspect(window);
    await window.webContents.executeJavaScript("window.limits.displayMode('tray')");
    assert.equal((await inspect(window)).visible, false);
    await window.webContents.executeJavaScript("window.limits.displayMode('widget')");
    const restoredMode = await checkOrder(before, window);
    assert.equal(raises, 0, 'Restoring an embedded widget needs no top-level raise');

    const metrics = { ...lastMetrics,
      // Geometry simulations below start from the current native order, not
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
    assert.equal(raises, 0, 'Leaving fullscreen keeps the widget on the taskbar surface');
    const raisesBeforePolling = raises;
    const changes = { ...host.placement.changes };
    for (let i = 0; i < 100; i++) host.placement.apply(metrics, settings);
    assert.deepEqual(host.placement.changes, changes, 'Unchanged polls must not show/resize the widget');
    assert.equal(raises, raisesBeforePolling, 'Unchanged polls must not raise the widget');
    host.placement.apply({ available: false }, settings);
    assert.equal((await inspect(window)).visible, true, 'Helper outages must not hide a placed bar');
    host.placement.apply({ ...metrics, visible: false }, settings);
    assert.equal((await inspect(window)).visible, false, 'Taskbar auto-hide still suppresses the bar');
    host.placement.apply({ available: false }, settings);
    assert.equal((await inspect(window)).visible, false, 'An outage must preserve intentional hiding');
    metricsOverride = { occupied: [lastMetrics.bar] };
    host.probe.child.stdin.write('query\n');
    await until(() => lastMetrics.parented === false && window.getBounds().y < metrics.bar.y);
    const fallback = window.getBounds();
    assert.equal((await inspect(window)).visible, true, 'A crowded taskbar uses a separate row');
    const top = metrics.bar.y < metrics.monitor.y + metrics.monitor.height / 2;
    assert.ok(top ? fallback.y >= metrics.bar.y + metrics.bar.height : fallback.y + fallback.height <= metrics.bar.y,
      'The Windows-accepted height must not overlap shell buttons');
    metricsOverride = null;
    host.probe.child.stdin.write('query\n');
    await until(() => lastMetrics.attached === true && window.getBounds().y >= metrics.bar.y);
    clearInterval(host.probe.timer);
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
    const panelTrace = [];
    for (const event of ['show', 'hide', 'focus', 'blur']) panel.on(event, () => panelTrace.push({ event, at: Date.now() }));
    await window.webContents.executeJavaScript(`globalThis.inputTrace = []; for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'pointercancel']) document.addEventListener(type, event => inputTrace.push({ type, target: event.target.id || event.target.className, x: event.clientX, y: event.clientY }), true);`);
    const clicks = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const selector of ['#short-reset', '#short-bar', '#short-value', '#weekly-reset', '#weekly-bar', '#weekly-value']) {
        panel.hide();
        await click(window, selector);
        if (!panel.isVisible()) console.log('NATIVE_INPUT_TRACE', JSON.stringify({ panelTrace, dragResult: await window.webContents.executeJavaScript('lastDragResult'), events: await window.webContents.executeJavaScript('inputTrace'), native: await inspect(window) }));
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
    const { DeepSeekController } = require('../../common/ai-connects/deepseek/controller.cjs');
    const controller = new DeepSeekController({ credentials: { read: () => 'smoke-fixture' }, client: { balance: async () => ({ is_available: true,
      balance_infos: [{ currency: 'USD', total_balance: '0', granted_balance: '0', topped_up_balance: '0' }] }) } });
    await controller.refresh();
    const baseState = await window.webContents.executeJavaScript('window.limits.get()');
    const monetaryClicks = [];
    for (const language of ['ru', 'en']) {
      const state = { ...baseState, ...controller.state, displayName: 'DeepSeek', language };
      await window.webContents.executeJavaScript(`render(${JSON.stringify(state)})`);
      for (const selector of ['[data-metric-id="total_balance"] .metric-label', '[data-metric-id="total_balance"] .metric-value',
        '[data-metric-id="granted_balance"] .metric-label', '[data-metric-id="granted_balance"] .metric-value']) {
        panel.hide(); await click(window, selector);
        assert.ok(panel.isVisible(), 'Real clicks on balance text must open details');
        monetaryClicks.push({ language, selector });
      }
      const bounds = window.getBounds();
      panel.hide(); await click(window, '.metric-compact-row .metric-label', -40);
      assert.ok(window.getBounds().x < bounds.x - 20, 'Real dragging on balance text must move the widget');
      assert.equal(panel.isVisible(), false, 'Dragging balance text must not also open details');
    }
    controller.disconnect();
    const screenshot = path.join(artifactRoot, 'widget-startup.png');
    fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
    const report = { initial, restoredMode, restoredFullscreen, restoredParent, fallback, shellChecks, clicks, monetaryClicks, nativeDragging: true, fastDragging: true, cursorMovement: true, panelClicks: 9, raises, unchangedPolls: 100, screenshot };
    fs.writeFileSync(path.join(artifactRoot, 'widget-startup-smoke.json'), JSON.stringify(report, null, 2));
    console.log('WIDGET_STARTUP_SMOKE_OK', JSON.stringify(report));
    app.quit();
  } catch (error) { console.error('WIDGET_STARTUP_SMOKE_FAILED', error); app.exit(1); }
});
