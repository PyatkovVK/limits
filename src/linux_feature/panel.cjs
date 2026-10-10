'use strict';

function panelBounds({ area, contentHeight, width = 440, anchor }) {
  const margin = 8;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const availableWidth = Math.max(1, area.width - margin * 2);
  const availableHeight = Math.max(1, area.height - margin * 2);
  const panelWidth = Math.min(width, availableWidth);
  const height = Math.min(Math.max(80, Math.ceil(contentHeight)), 590, availableHeight);
  const right = anchor?.right ?? area.x + area.width - 16;
  const bottom = anchor?.bottom ?? area.y + area.height - margin;
  return {
    x: Math.round(clamp(right - panelWidth, area.x + margin, area.x + area.width - panelWidth - margin)),
    y: Math.round(clamp(bottom - height, area.y + margin, area.y + area.height - height - margin)),
    width: panelWidth, height
  };
}

function createPanelController({ window, screen }) {
  let contentHeight = 590;
  function place(preservePosition = false) {
    if (window.isDestroyed()) return false;
    const current = window.getBounds();
    const visible = window.isVisible();
    const display = visible ? screen.getDisplayMatching(current) : screen.getPrimaryDisplay();
    const anchor = preservePosition && visible ? { right: current.x + current.width, bottom: current.y + current.height } : null;
    const bounds = panelBounds({ area: display.workArea, contentHeight, width: current.width, anchor });
    if (['x', 'y', 'width', 'height'].some(key => current[key] !== bounds[key])) window.setBounds(bounds, false);
    return true;
  }
  function resize(height) {
    if (!Number.isFinite(height) || height <= 0) return false;
    contentHeight = height;
    return place(true);
  }
  function show() {
    if (!place()) return false;
    window.show(); window.focus();
    return true;
  }
  const onDisplayChange = () => place(true);
  const dispose = () => screen.removeListener('display-metrics-changed', onDisplayChange);
  screen.on('display-metrics-changed', onDisplayChange);
  window.once('closed', dispose);
  return { resize, show, dispose };
}

module.exports = { panelBounds, createPanelController };
