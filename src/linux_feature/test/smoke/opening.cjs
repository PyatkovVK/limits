'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function verifyOpening({ window, artifactRoot }) {
  const artifacts = path.join(artifactRoot, 'linux-panel-opening');
  fs.mkdirSync(artifacts, { recursive: true });
  const reduced = await window.webContents.executeJavaScript('document.body.classList.contains("reduced-motion")');
  try {
    const run = expression => window.webContents.executeJavaScript(expression);
    const reports = [];
    for (const reducedMotion of [false, true]) {
      window.hide();
      // Force a stale viewport and grow content while hidden. Opening must
      // measure at the final width before exposing any native window frame.
      window.setBounds({ ...window.getBounds(), width: 340, height: 90 });
      await run(`(() => {
        document.body.classList.toggle('reduced-motion', ${reducedMotion});
        document.getElementById('opening-spacer')?.remove();
        const spacer = document.createElement('div'); spacer.id = 'opening-spacer';
        spacer.style.height = '75px'; document.querySelector('.panel-content').append(spacer);
      })()`);
      const visibleBounds = [];
      const record = () => { if (window.isVisible()) visibleBounds.push(window.getBounds()); };
      window.on('show', record); window.on('resize', record); window.on('move', record);
      try {
        await run('window.limits.open()');
        const opened = window.getBounds();
        const first = await run(`({ opacity: Number(getComputedStyle(document.body).opacity), animation: getComputedStyle(document.body).animationName, height: window.limitsViewPanel.measure() })`);
        assert.equal(opened.width, 528);
        assert.ok(Math.abs(opened.height - Math.min(720, Math.ceil(first.height * 1.2))) <= 1);
        assert.ok(visibleBounds.length > 0);
        // Mapping may be constrained by the window manager while opacity is
        // still zero. Only the revealed surface must remain stationary.
        const transparentMapping = visibleBounds.splice(0);
        visibleBounds.push(opened);
        assert.equal(first.animation, reducedMotion ? 'none' : 'linux-panel-enter');
        if (reducedMotion) assert.equal(first.opacity, 1);
        else assert.ok(first.opacity < 1, 'Opening should fade in');
        const frames = await run(`(async () => {
          const frames = [], end = performance.now() + 240;
          do {
            const rect = document.body.getBoundingClientRect();
            frames.push({ time: performance.now(), x: rect.x, y: rect.y, width: rect.width, height: rect.height,
              viewportWidth: innerWidth, viewportHeight: innerHeight, opacity: Number(getComputedStyle(document.body).opacity) });
            await new Promise(requestAnimationFrame);
          } while (performance.now() < end);
          return frames;
        })()`);
        assert.ok(frames.length >= 3, 'Opening must be inspected across multiple painted frames');
        assert.ok(frames.every(frame => Math.abs(frame.x) <= .1 && Math.abs(frame.width - frame.viewportWidth) <= 1),
          'Visible panel edges shifted horizontally: ' + JSON.stringify(frames));
        assert.ok(frames.every(frame => Math.abs(frame.y) <= .1 && Math.abs(frame.height - frame.viewportHeight) <= 1),
          'Visible panel edges shifted vertically: ' + JSON.stringify(frames));
        const completed = await run(`({ opacity: Number(getComputedStyle(document.body).opacity), transform: getComputedStyle(document.body).transform, hidden: document.hidden, classes: document.body.className, animations: document.body.getAnimations().map(a => ({time: a.currentTime, state: a.playState})) })`);
        assert.equal(completed.opacity, 1);
        assert.equal(completed.transform, 'none');
        assert.ok(visibleBounds.every(bounds => JSON.stringify(bounds) === JSON.stringify(opened)), 'Native panel bounds changed after appearing: ' + JSON.stringify({ opened, visibleBounds, frames }));
        fs.writeFileSync(path.join(artifacts, reducedMotion ? 'reduced-motion.png' : 'opened.png'), (await window.webContents.capturePage()).toPNG());
        reports.push({ reducedMotion, first, completed, frames, transparentMapping, bounds: opened, nativeBoundsStable: true, visibleEdgesStable: true });
      } finally {
        window.removeListener('show', record); window.removeListener('resize', record); window.removeListener('move', record);
      }
    }
    fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(reports, null, 2));
    return reports;
  } finally {
    await window.webContents.executeJavaScript(`document.body.classList.toggle('reduced-motion', ${reduced}); document.getElementById('opening-spacer')?.remove(); window.limitsViewPanel.report()`);
  }
}

module.exports = { verifyOpening };
