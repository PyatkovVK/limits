'use strict';
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const artifacts = path.resolve(__dirname, '../../../artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'linux-widget-smoke-'));
const setPath = app.setPath.bind(app); app.setPath = (name, value) => setPath(name, name === 'userData' ? root : value);
app.getVersion = () => require('../../../package.json').version; app.disableHardwareAcceleration();
global.fetch = async () => assert.fail('No network in demo');
process.argv.push('--demo', '--hidden'); require('../../common/main.cjs');
app.whenReady().then(async () => {
  try {
    let panel, widget;
    for (let attempt = 0; attempt < 100; attempt++) {
      const windows = BrowserWindow.getAllWindows();
      panel = windows.find(win => win.webContents.getURL().endsWith('/index.html'));
      widget = windows.find(win => win.webContents.getURL().endsWith('/linux_feature/renderer/widget.html'));
      if (panel && widget && !widget.webContents.isLoading()) break;
      await delay(100);
    }
    assert.ok(widget); assert.ok(panel);
    await widget.webContents.executeJavaScript('window.renderReady');
    const run = source => widget.webContents.executeJavaScript(source);
    await run("window.limits.displayMode('widget')"); await delay(150); assert.equal(widget.isVisible(), true);
    for (const language of ['ru', 'en']) for (const width of [240, 280, 320, 400]) {
      await run(`window.limits.language('${language}'); window.limits.preference('width', ${width})`); await delay(100);
      const value = await run(`({ values: [...document.querySelectorAll('.percentage')].map(el => el.textContent), bars: document.querySelectorAll('progress').length, overflow: document.body.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight, isolated: typeof require === 'undefined' })`);
      assert.deepEqual(value.values, ['72%', '46%']); assert.equal(value.bars, 2); assert.equal(value.overflow, false); assert.equal(value.isolated, true);
    }
    await run("window.limits.preference('width', 280); document.getElementById('details').click()"); await delay(150);
    assert.equal(panel.isVisible(), true);
    await run("window.limits.accountAction('select', '00000000-0000-4000-8000-000000000001')"); await delay(100);
    assert.equal(await run("document.getElementById('short-value').textContent"), '38');
    const area = screen.getDisplayMatching(widget.getBounds()).workArea;
    widget.setPosition(area.x + 80, area.y + 80); await delay(350);
    const moved = widget.getBounds();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'linux-widget-position.json'))), { x: moved.x, y: moved.y });
    await run("window.limits.preference('visible', false)"); assert.equal(widget.isVisible(), false);
    await run("window.limits.preference('visible', true)"); assert.equal(widget.isVisible(), true);
    await run("window.limits.displayMode('tray')"); assert.equal(widget.isVisible(), false);
    await run("window.limits.displayMode('widget')"); assert.equal(widget.getBounds().x, moved.x);
    await delay(300); assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'widget-settings.json'))).displayMode, 'widget');
    fs.writeFileSync(path.join(artifacts, 'linux-widget.png'), (await widget.webContents.capturePage()).toPNG());
    console.log('LINUX_WIDGET_SMOKE_OK: two bars, RU/EN, four widths, account switching, details, persistence, tray switching, visibility'); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
