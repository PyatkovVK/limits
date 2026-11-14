'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
// Native X11 window sizes may round a CSS/zoom conversion by one DIP.
const near = (left, right) => Math.abs(left - right) <= 1;

async function verifyPanel({ window, trayPresentation, artifactRoot }) {
  const { screen } = require('electron');
  await window.webContents.executeJavaScript('window.limitsViewPanelReady');
  const gutter = await window.webContents.executeJavaScript("getComputedStyle(document.querySelector('main')).scrollbarGutter");
  if (gutter !== 'stable') throw new Error('Linux panel stylesheet was not loaded');
  const display = screen.getDisplayMatching(window.getBounds());
  const area = display.workArea;
  if (window.webContents.getZoomFactor() !== 1.2) throw new Error('Linux panel zoom was not applied');
  const tray = trayPresentation.entries[0].tray;
  const original = Object.getOwnPropertyDescriptor(tray, 'getBounds');
  const placements = [];
  try {
    // Exercise the real tray-click wiring with deterministic top/bottom geometry.
    // The desktop panel itself is not moved by the smoke test.
    for (const edge of ['top', 'bottom']) {
      const anchor = { x: area.x + Math.floor(area.width / 2), y: edge === 'top' ? display.bounds.y : display.bounds.y + display.bounds.height - 24, width: 24, height: 24 };
      Object.defineProperty(tray, 'getBounds', { configurable: true, value: () => anchor });
      window.hide(); tray.emit('click');
      await delay(150);
      const bounds = window.getBounds();
      if (bounds.width !== Math.min(528, area.width - 16)) throw new Error('Linux panel width was not enlarged');
      const expectedY = edge === 'top'
        ? Math.max(area.y + 8, Math.min(area.y + area.height - bounds.height - 8, Math.max(area.y, anchor.y + anchor.height) + 8))
        : Math.max(area.y + 8, Math.min(area.y + area.height, anchor.y) - 8 - bounds.height);
      if (!near(bounds.y, expectedY)) throw new Error(`Linux panel did not open at the ${edge} tray`);
      // Grow intrinsic content beyond the height cap, then remove it to check shrinking.
      await window.webContents.executeJavaScript(`(() => {
        const spacer = document.createElement('div'); spacer.id = 'linux-smoke-spacer'; spacer.style.height = '900px';
        document.querySelector('.panel-content').append(spacer);
      })()`);
      await delay(150);
      const expanded = window.getBounds();
      if (!near(expanded.height, Math.min(720, area.height - 16))) throw new Error('Linux panel did not grow to its height cap');
      if (edge === 'top' ? !near(expanded.y, bounds.y) : !near(expanded.y + expanded.height, bounds.y + bounds.height)) throw new Error('Linux resizing moved the attached edge');
      await window.webContents.executeJavaScript("document.getElementById('linux-smoke-spacer').remove()");
      await delay(150);
      const collapsed = window.getBounds();
      if (!near(collapsed.height, bounds.height) || !near(collapsed.y, bounds.y)) throw new Error('Linux panel did not shrink back to its content');
      const filename = `linux-panel-${edge}.png`;
      fs.writeFileSync(path.join(artifactRoot, filename), (await window.webContents.capturePage()).toPNG());
      placements.push({ edge, bounds: collapsed, screenshot: filename });
    }
    const compact = await window.webContents.executeJavaScript(`(() => {
      const content = document.querySelector('.panel-content');
      window.linuxSmokeChildren = [...content.childNodes];
      content.replaceChildren();
      return window.limitsViewPanel.report();
    })()`);
    await delay(150);
    const compactHeight = window.getBounds().height;
    if (compactHeight >= 480) throw new Error('Short Linux content retained the old height floor');
    await window.webContents.executeJavaScript(`document.querySelector('.panel-content').append(...window.linuxSmokeChildren); delete window.linuxSmokeChildren`);
    await delay(150);
    return { zoom: 1.2, simulatedTrayPlacements: placements, growsAndShrinks: true, compactHeight };
  } finally {
    if (original) Object.defineProperty(tray, 'getBounds', original);
    else delete tray.getBounds;
  }
}

module.exports = { verifyPanel };
