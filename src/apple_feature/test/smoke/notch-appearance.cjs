'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { verifyCompactMacPanel } = require('./panel.cjs');

async function verifyNotchHover({ appleNotch, target, preview }) {
  const run = source => target.webContents.executeJavaScript(source);
  const settle = () => new Promise(resolve => setTimeout(resolve, 500));
  const mode = appleNotch.mode;
  const indicators = `[...document.querySelectorAll('.apple-island-meter:not([hidden])')].filter(node => node.getClientRects().length).map(node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { text: node.textContent, x, y, width, height };
  })`;
  appleNotch.setPhase('closed');
  await settle();
  const closed = await run(indicators);
  for (const style of ['informative', 'minimal']) {
    appleNotch.setPhase('expanded');
    await settle();
    await run(`(() => {
      document.getElementById('settings-button').click();
      const select = document.getElementById('island-hover-style');
      if (!select.getClientRects().length || select.disabled) throw new Error('Hover style selector is unavailable');
      select.value = ${JSON.stringify(style)};
      select.dispatchEvent(new Event('change'));
    })()`);
    await settle();
    if (appleNotch.snapshot().hoverStyle !== style) throw new Error('Hover style was not applied: ' + style);
    await run('window.limitsSettings.dialog.close()');
    appleNotch.setPhase('peek');
    await settle();
    const report = await run(`(() => {
      const meters = [...document.querySelectorAll('.apple-preview progress:not([hidden])')].map(node => {
        const { top, width, bottom } = node.getBoundingClientRect();
        return { top, bottom, width, value: node.value };
      });
      return {
        indicators: ${indicators}, meters,
        reset: Boolean(document.querySelector('.apple-preview-reset').getClientRects().length),
        values: Boolean(document.getElementById('apple-short-value').getClientRects().length),
        border: getComputedStyle(document.querySelector('.apple-surface-outline')).display !== 'none',
      };
    })()`);
    const layout = appleNotch.snapshot();
    if (closed.length !== (mode === 'island' ? 2 : 0) || JSON.stringify(report.indicators) !== JSON.stringify(closed) ||
        report.meters.map(meter => meter.value).join(',') !== '72,46' ||
        report.meters.some(meter => !meter.width || meter.top < layout.capHeight || meter.bottom > layout.peekHeight) ||
        report.reset !== (style === 'informative') || report.values !== (mode === 'notch' && style === 'informative') || !report.border) {
      throw new Error('Hover changed the top indicators or lost the preview below them: ' + JSON.stringify({ style, closed, report }));
    }
    await preview(`apple-${mode}-hover-${style}.png`, layout.peekHeight + 12);
    await run("document.getElementById('apple-trigger').click()");
    await settle();
    if (appleNotch.phase !== 'expanded') throw new Error('Hover click did not open the compact subscription preview');
    await verifyCompactMacPanel(target);
  }
  await preview(`apple-${mode}-subscription-preview.png`, appleNotch.snapshot().fullHeight + 12);
  return { minimal: true, informative: true, unchangedIndicators: true, clickOpensPreview: true };
}

async function verifyNotchSurface({ appleNotch, target, artifactRoot }) {
  const original = appleNotch.phase;
  const checks = [];
  let compactRect;
  try {
    for (const phase of ['closed', 'peek', 'expanded']) {
      appleNotch.setPhase(phase);
      await new Promise(resolve => setTimeout(resolve, 550));
      const rect = await target.webContents.executeJavaScript(`(() => {
        const rect = document.querySelector('.apple-shell').getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()`);
      if (phase === 'closed') compactRect = rect;
      if (phase === 'peek' && appleNotch.mode === 'island' &&
          (Math.abs(rect.x - compactRect.x) > 0.5 || Math.abs(rect.width - compactRect.width) > 0.5)) {
        throw new Error('Hover preview changed the compact side margins: ' + JSON.stringify({ compact: compactRect, hover: rect }));
      }
      const image = await target.webContents.capturePage();
      const size = image.getSize(), bitmap = image.toBitmap();
      // capturePage reports physical pixels; DOM geometry is in CSS points.
      const scale = size.width / appleNotch.layout.bounds.width;
      const alpha = (x, y) => bitmap[(Math.floor(y * scale) * size.width + Math.floor(x * scale)) * 4 + 3];
      const cap = appleNotch.layout.capHeight;
      const neckLeft = rect.x + (rect.width - appleNotch.layout.capWidth) / 2;
      const straightSides = Math.abs(rect.width - appleNotch.layout.capWidth) < 0.5;
      // A preview matching the compact width has straight sides and rounded bottom corners.
      const cornerAlpha = alpha(rect.x + (straightSides ? 1 : 0), straightSides ? rect.height - 1 : cap);
      const joinAlpha = alpha(straightSides ? rect.x + 2 : neckLeft, straightSides ? cap / 2 : cap - 2);
      if (straightSides) {
        for (const x of [rect.x + 2, rect.x + rect.width - 3]) {
          const pixel = (Math.floor(cap / 2 * scale) * size.width + Math.floor(x * scale)) * 4;
          if (bitmap[pixel + 3] < 250 || bitmap[pixel] + bitmap[pixel + 1] + bitmap[pixel + 2] > 8) throw new Error('Compact notch has transparent or light side margins');
        }
      }
      fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${phase}-alpha.png`), image.toPNG());
      await target.webContents.executeJavaScript("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${phase}-surface.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height: Math.ceil(rect.height + 16) })).toPNG());
      } finally { await target.webContents.executeJavaScript("document.documentElement.style.removeProperty('background')"); }
      if (cornerAlpha > 8 || joinAlpha < 240) throw new Error('Notch has square shoulders or a disconnected neck: ' + JSON.stringify({ mode: appleNotch.mode, phase, cornerAlpha, joinAlpha, rect, cap, neckLeft, size, bitmapLength: bitmap.length, scale }));
      checks.push({ phase, left: rect.x, right: rect.x + rect.width, width: rect.width,
        ...(straightSides ? { blackSideMargins: true, roundedBottom: true } : { roundedShoulders: true }), connectedNeck: true });
    }
    return checks;
  } finally { appleNotch.setPhase(original); }
}

async function verifyCompactAppearance({ appleNotch, target, artifactRoot }) {
  const { dialog, nativeImage } = require('electron');
  const run = source => target.webContents.executeJavaScript(source);
  const original = await run('window.limits.appearance()');
  const phase = appleNotch.phase;
  const chooser = dialog.showOpenDialog;
  const fixture = path.join(artifactRoot, 'notch-background-smoke.png');
  fs.writeFileSync(fixture, nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 }).toPNG());
  const checks = [];
  try {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fixture] });
    for (const mode of ['color', 'image']) {
      await run(mode === 'image' ? 'window.limits.chooseBackground()' : "window.limits.setAppearance({ mode: 'color', color: '#ffffff' })");
      for (const nextPhase of ['closed', 'peek', 'expanded']) {
        appleNotch.setPhase(nextPhase);
        await new Promise(resolve => setTimeout(resolve, 550));
        const report = await run(`(() => {
          const shell = getComputedStyle(document.querySelector('.apple-shell'));
          const content = getComputedStyle(document.querySelector('.apple-content'));
          return { shellColor: shell.backgroundColor, shellImage: shell.backgroundImage,
            contentColor: content.backgroundColor, contentImage: content.backgroundImage,
            contentVisible: content.opacity === '1' };
        })()`);
        if (report.shellImage !== 'none' || (nextPhase !== 'expanded' && report.shellColor !== 'rgb(0, 0, 0)')) throw new Error('Custom background painted compact notch chrome: ' + JSON.stringify(report));
        if (report.contentVisible !== (nextPhase === 'expanded') || (mode === 'image' ? !report.contentImage.includes('data:image/png') : report.contentColor !== 'rgb(255, 255, 255)')) throw new Error('Expanded notch lost its custom background: ' + JSON.stringify(report));
        checks.push({ mode, phase: nextPhase, blackChrome: nextPhase !== 'expanded', backgroundInDetails: true });
        if (nextPhase === 'closed') fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${mode}-closed.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: appleNotch.layout.bounds.width, height: appleNotch.layout.closedHeight + 16 })).toPNG());
        if (nextPhase === 'expanded') {
          await run('window.limitsSettings.open()');
          await new Promise(resolve => setTimeout(resolve, 600));
          const gap = await run("document.getElementById('settings-dialog').getBoundingClientRect().top - parseFloat(getComputedStyle(document.body).getPropertyValue('--cap-height')) - 12");
          if (gap < 12) throw new Error('Custom-background Settings lost its top inset: ' + gap);
          const preview = await run(`(() => {
            const sample = document.getElementById('background-preview-window');
            const style = getComputedStyle(sample);
            const preview = sample.closest('.background-preview');
            const wings = [...preview.querySelectorAll('.background-preview-wing')].map(wing => wing.textContent);
            return { color: style.backgroundColor, image: style.backgroundImage, wings,
              mode: preview.dataset.presentation,
              values: [...sample.querySelectorAll('.background-preview-value')].map(node => node.textContent) };
          })()`);
          if (preview.mode !== appleNotch.mode || preview.values.join(',') !== '67%,23%' ||
              (preview.mode === 'island' && preview.wings.join(',') !== '67%5h,7d28%') ||
              (mode === 'image' ? !preview.image.includes('data:image/png') : preview.color !== 'rgb(255, 255, 255)')) {
            throw new Error('Settings background preview does not match the expanded notch: ' + JSON.stringify(preview));
          }
          fs.writeFileSync(path.join(artifactRoot, `apple-${appleNotch.mode}-${mode}-settings.png`), (await target.webContents.capturePage()).toPNG());
          await run('window.limitsSettings.dialog.close()');
        }
      }
    }
    return checks;
  } finally {
    dialog.showOpenDialog = chooser;
    await run(`window.limits.setAppearance(${JSON.stringify({ mode: original.mode, color: original.color })})`);
    appleNotch.setPhase(phase);
  }
}

module.exports = { verifyNotchHover, verifyNotchSurface, verifyCompactAppearance };
