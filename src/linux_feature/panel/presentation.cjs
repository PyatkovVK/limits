'use strict';

async function preparePanel(webContents) {
  return webContents.executeJavaScript(`(async () => {
    await window.limitsViewPanelReady;
    await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(link =>
      link.sheet ? undefined : new Promise(resolve => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      })));
    await document.fonts.ready;
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
  await webContents.executeJavaScript(`new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
}

module.exports = { preparePanel, paintPanel, revealPanel };
