'use strict';

const { setTimeout: delay } = require('node:timers/promises');

async function preparePanel(webContents) {
  return webContents.executeJavaScript(`(async () => {
    await window.limitsViewPanelReady;
    document.body.classList.remove('linux-panel-enter');
    document.body.classList.add('linux-panel-preparing');
    // Hidden windows can throttle animation frames. Measure layout directly
    // after applying the native width instead of waiting for ResizeObserver.
    const height = window.limitsViewPanel.measure();
    // Flush earlier ResizeObserver reports on the same IPC channel before
    // exposing the window; an older queued height must not resize it later.
    await window.limits.panelSize(height);
    return height;
  })()`);
}

async function revealPanel(webContents) {
  await webContents.executeJavaScript(`document.body.classList.replace('linux-panel-preparing', 'linux-panel-enter')`);
}

async function paintPanel(webContents) {
  const timer = new AbortController();
  try {
    // An unmapped or occluded surface may never get a frame from the compositor.
    await Promise.race([
      webContents.executeJavaScript(`new Promise(resolve => {
        const fallback = setTimeout(resolve, 180);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          clearTimeout(fallback);
          resolve();
        }));
      })`),
      delay(220, undefined, { signal: timer.signal }),
    ]);
  } finally {
    timer.abort();
  }
}

module.exports = { preparePanel, paintPanel, revealPanel };
