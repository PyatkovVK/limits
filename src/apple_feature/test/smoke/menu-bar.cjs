'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hitBounds, contains } = require('../../notch/geometry.cjs');
const { verifyCompactAppearance } = require('./notch-appearance.cjs');

async function verifyMenuBarProtection({ appleNotch, target, artifactRoot }) {
  const read = appleNotch.readNativeScreens, getState = appleNotch.getState;
  const native = appleNotch.screenInfo, originalPhase = appleNotch.phase;
  const phases = ['closed', 'peek', 'expanded', 'notification'];
  const wide = { ...native, menuBarLeft: 0, menuBarRight: appleNotch.display.bounds.width };
  const cases = [
    { name: 'wide', metadata: wide, expected: 'full' },
    { name: 'values', metadata: { ...wide, menuBarLeft: native.notchX - 71 }, expected: 'values', side: 'left' },
    { name: 'tight', metadata: { ...wide, menuBarLeft: native.notchX - 36 }, expected: 'values', side: 'left', shrinksFont: true },
    { name: 'crowded-left', metadata: { ...wide, menuBarLeft: native.notchX - 8 }, expected: 'hidden', side: 'left' },
    { name: 'crowded-right', metadata: { ...wide, menuBarRight: native.notchX + native.notchWidth + 8 }, expected: 'hidden', side: 'right' },
    { name: 'unknown-left', metadata: { ...native, menuBarLeft: null, menuBarRight: native.notchX + native.notchWidth + 64 }, expected: 'values', side: 'right' },
    { name: 'unknown', metadata: { ...native, menuBarLeft: null, menuBarRight: null }, expected: 'full' }
  ];
  const checks = [];
  try {
    for (const scenario of cases) {
      appleNotch.getState = scenario.shrinksFont ? () => {
        const state = getState();
        const groups = state.groups.map(group => ({ ...group, metrics: group.metrics.map(metric =>
          metric.type === 'percentage' ? { ...metric, value: 100 } : metric) }));
        return { ...state, groups };
      } : getState;
      appleNotch.menuBar.info = null;
      appleNotch.readNativeScreens = async () => [scenario.metadata];
      await appleNotch.refreshMenuBar();
      let compact;
      for (const phase of phases) {
        appleNotch.setPhase(phase);
        await new Promise(resolve => setTimeout(resolve, 500));
        const layout = appleNotch.snapshot();
        if (layout.indicatorMode !== scenario.expected || layout.peekWidth !== layout.closedWidth || layout.capWidth > layout.menuBarWidth) throw new Error('Menu adaptation lost safe shared width: ' + JSON.stringify({ scenario: scenario.name, layout }));
        const x = scenario.side
          ? appleNotch.display.bounds.x + (scenario.side === 'left' ? scenario.metadata.menuBarLeft + 1 : scenario.metadata.menuBarRight - 1) - layout.bounds.x
          : layout.bounds.width / 2 + layout.capWidth / 2 + 4;
        const image = await target.webContents.capturePage();
        const size = image.getSize(), bitmap = image.toBitmap();
        const scale = size.width / layout.bounds.width;
        for (const y of [1, layout.capHeight / 2, layout.capHeight - 1, layout.capHeight - 0.25]) {
          if (contains(hitBounds(layout, phase), { x: layout.bounds.x + x, y: layout.bounds.y + y }, 6)) throw new Error('Neighbouring menu-bar controls intercept clicks: ' + scenario.name + '/' + phase);
          const pixel = (Math.floor(y * scale) * size.width + Math.floor(x * scale)) * 4;
          if (bitmap[pixel + 3] !== 0) throw new Error('Notch surface covers a neighbouring menu-bar control: ' + JSON.stringify({ scenario: scenario.name, phase, x, y, alpha: bitmap[pixel + 3] }));
        }
        const report = await target.webContents.executeJavaScript(`(() => {
          const shell = document.querySelector('.apple-shell').getBoundingClientRect();
          const header = document.querySelector('.apple-island-meters');
          const preview = document.querySelector('.apple-preview');
          const heading = preview.querySelector('.apple-preview-heading');
          const [short, weekly] = [...preview.querySelectorAll('.apple-preview-row')].map(row => row.getBoundingClientRect());
          const [shortBar, weeklyBar] = [...preview.querySelectorAll('.apple-preview-row progress')].map(bar => bar.getBoundingClientRect());
          const meters = [...header.querySelectorAll('.apple-island-meter:not([hidden])')].map((el, index) => {
            const label = el.querySelector('.apple-island-label');
            const value = el.querySelector('.apple-island-value');
            const dotRect = el.querySelector('.apple-island-dot').getBoundingClientRect();
            const rect = el.getBoundingClientRect(), labelRect = label.getBoundingClientRect(), valueRect = value.getBoundingClientRect();
            const [first, second] = el.firstElementChild === label ? [labelRect, valueRect] : [valueRect, labelRect];
            return { text: el.textContent, left: rect.left, right: rect.right, labelWidth: labelRect.width,
              labelFont: parseFloat(getComputedStyle(label).fontSize), font: parseFloat(getComputedStyle(value).fontSize),
              outerDot: dotRect.width > 0 && (index === 0 ? dotRect.right <= first.left : dotRect.left >= second.right),
              orderedInline: first.right <= second.left,
              orderedStacked: labelRect.bottom <= valueRect.top && Math.abs(index === 0
                ? labelRect.left - valueRect.left : labelRect.right - valueRect.right) < 0.1 };
          });
          return { left: shell.left, right: shell.right, width: shell.width, bottom: shell.bottom,
            headerHidden: header.hidden, meters,
            previewOverflow: preview.scrollWidth > preview.clientWidth + 1,
            fallback: heading.getClientRects().length > 0 && short.height > 0 && short.bottom <= weekly.top &&
              shortBar.width > 0 && shortBar.left === weeklyBar.left && shortBar.width === weeklyBar.width,
            values: ['short','weekly'].map(kind => document.getElementById('apple-' + kind + '-value').textContent) };
        })()`);
        if (report.headerHidden !== (scenario.expected === 'hidden')) throw new Error('Indicators did not adapt to menu space: ' + JSON.stringify(report));
        if (!report.headerHidden) {
          const center = layout.bounds.width / 2;
          const leftEdge = center - layout.capWidth / 2, rightEdge = center + layout.capWidth / 2;
          const notchLeft = center - layout.notchWidth / 2, notchRight = center + layout.notchWidth / 2;
          const [left, right] = report.meters;
          const expectedValues = scenario.shrinksFont ? '100%5h,7d100%' : '72%5h,7d46%';
          const fontLimit = scenario.expected === 'full' ? 12 : 11;
          const inset = scenario.expected === 'full' ? 18 : scenario.shrinksFont ? 4 : 10;
          if (report.meters.map(meter => meter.text).join(',') !== expectedValues ||
            Math.abs(left.left - leftEdge - inset) > 0.5 || left.right > notchLeft ||
            right.left < notchRight || Math.abs(rightEdge - right.right - inset) > 0.5 ||
            report.meters.some(meter => meter.labelWidth === 0 || (scenario.shrinksFont ? !meter.orderedStacked : !meter.orderedInline) ||
              meter.outerDot !== (scenario.expected === 'full') ||
              (scenario.shrinksFont ? meter.font >= fontLimit || meter.labelFont >= 9 : meter.font !== fontLimit))) {
            throw new Error('Quota values did not fit beside the notch: ' + JSON.stringify({ scenario: scenario.name, report }));
          }
        }
        if (phase === 'closed') {
          compact = report;
          const notchHeight = Math.ceil(native.top);
          const below = (Math.ceil(notchHeight * scale) * size.width + Math.floor(size.width / 2)) * 4;
          if (Math.abs(report.bottom - notchHeight) > 0.5 || bitmap[below + 3] !== 0) throw new Error('Collapsed panel extends below the notch: ' + JSON.stringify({ scenario: scenario.name, report }));
        }
        if (phase === 'peek') {
          if (Math.abs(compact.left - report.left) > 0.5 || Math.abs(compact.right - report.right) > 0.5 || report.previewOverflow || report.values.join(',') !== '72%,46%') throw new Error('Hover preview widened, overflowed or lost values: ' + JSON.stringify({ scenario: scenario.name, compact, hover: report }));
          if (report.fallback !== (scenario.expected === 'hidden') || (report.fallback && Math.abs(report.bottom - layout.contentTop - 116) > 0.5)) {
            throw new Error('Hover lost the full fallback when the side indicators do not fit: ' + JSON.stringify({ scenario: scenario.name, report }));
          }
          checks.push({ scenario: scenario.name, indicatorMode: layout.indicatorMode, compactWidth: compact.width, hoverWidth: report.width, alignedEdges: true });
        }
        if (phase === 'closed' || phase === 'peek') {
          await target.webContents.executeJavaScript("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
          try { fs.writeFileSync(path.join(artifactRoot, `apple-island-menu-${scenario.name}-${phase}.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: layout.bounds.width, height: (phase === 'closed' ? layout.closedHeight : layout.peekHeight) + 16 })).toPNG()); }
          finally { await target.webContents.executeJavaScript("document.documentElement.style.removeProperty('background')"); }
        }
      }
    }
    return { phases, cases: checks, transparent: true, clickThrough: true, alignedHover: true };
  } finally {
    appleNotch.getState = getState;
    appleNotch.readNativeScreens = read;
    await appleNotch.refreshMenuBar();
    appleNotch.setPhase(originalPhase);
  }
}

async function verifyLiveAppleIsland({ appleNotch, target, artifactRoot }) {
  const run = source => target.webContents.executeJavaScript(source);
  await appleNotch.refreshMenuBar();
  await new Promise(resolve => setTimeout(resolve, 1100));
  await appleNotch.refreshMenuBar();
  const layout = appleNotch.snapshot(), states = [];
  if (layout.menuBarWidth >= layout.notchWidth + 80 && layout.indicatorMode === 'hidden') throw new Error('Real free space incorrectly hid side indicators');
  for (const phase of ['closed', 'peek']) {
    appleNotch.setPhase(phase);
    await new Promise(resolve => setTimeout(resolve, 550));
    const report = await run(`(() => {
      const r = document.querySelector('.apple-shell').getBoundingClientRect();
      const header = document.querySelector('.apple-island-meters');
      return { phase: document.body.dataset.notchPhase, left: r.left, right: r.right, width: r.width,
        visibleValues: header.hidden ? [] : [...header.querySelectorAll('.apple-island-meter:not([hidden]) .apple-island-value')].filter(el => el.getBoundingClientRect().width > 0).map(el => el.textContent) };
    })()`);
    if (layout.indicatorMode !== 'hidden' && report.visibleValues.join(',') !== '72%,46%') throw new Error('Real menu space lost the side quotas: ' + JSON.stringify(report));
    states.push(report);
    await run("document.documentElement.style.background = '#dbe2ec'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    try { fs.writeFileSync(path.join(artifactRoot, `apple-island-live-${phase}.png`), (await target.webContents.capturePage({ x: 0, y: 0, width: layout.bounds.width, height: (phase === 'closed' ? layout.closedHeight : layout.peekHeight) + 16 })).toPNG()); }
    finally { await run("document.documentElement.style.removeProperty('background')"); }
  }
  if (states[0].left !== states[1].left || states[0].right !== states[1].right) throw new Error('Real hover preview changed side edges');
  const appearance = await verifyCompactAppearance({ appleNotch, target, artifactRoot });
  return { nativeMenuSpace: appleNotch.screenInfo, indicatorMode: layout.indicatorMode, states, appearance, realGeometry: true };
}

module.exports = { verifyMenuBarProtection, verifyLiveAppleIsland };
