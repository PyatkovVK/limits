'use strict';
const { createPanelPosition } = require('../common/panel-position.cjs');

// Native backdrop blur sits behind the transparent, platform-scoped renderer.
function panelOptions() {
  return { backgroundColor: '#00000000', transparent: true, vibrancy: 'under-window', visualEffectState: 'active', roundedCorners: true, hasShadow: true };
}

function validAnchor(bounds) {
  return bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) && bounds.width > 0 && bounds.height > 0;
}

function isMenuBarAnchor(anchor, display) {
  if (!validAnchor(anchor)) return false;
  const bounds = display.bounds;
  // A newly created status item can have a non-empty frame at the bottom of
  // the display before AppKit finishes converting/placing its coordinates.
  const bottom = Math.max(display.workArea.y, bounds.y + 64);
  return anchor.y >= bounds.y && anchor.y + anchor.height <= bottom && anchor.x >= bounds.x && anchor.x + anchor.width <= bounds.x + bounds.width;
}

function panelBounds({ anchor, display, size }) {
  const area = display.workArea, margin = 8;
  const width = Math.min(size[0], Math.max(1, area.width - margin * 2));
  const height = Math.min(size[1], Math.max(1, area.height - margin * 2));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const center = anchor ? anchor.x + anchor.width / 2 : area.x + area.width - width / 2 - margin;
  return {
    x: Math.round(clamp(center - width / 2, area.x + margin, area.x + area.width - width - margin)),
    y: Math.round(clamp(Math.max(area.y, anchor ? anchor.y + anchor.height : area.y) + margin, area.y + margin, area.y + area.height - height - margin)),
    width, height
  };
}

function createPanelController({ window, screen, getTrayBounds, root, reducedMotion = () => false, wait = () => new Promise(resolve => setTimeout(resolve, 20)), attempts = 25 }) {
  const size = window.getSize();
  const remembered = createPanelPosition({ window, root, name: 'mac' });
  function placement(anchor) {
    const display = remembered.point ? screen.getDisplayMatching({ ...remembered.point, width: size[0], height: size[1] }) : anchor ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
    const bounds = remembered.bounds(display.workArea, size) || panelBounds({ anchor, display, size });
    remembered.expect(bounds);
    return { display, bounds };
  }
  let generation = 0, lastPlacement = null;
  const cancel = () => { generation++; };
  window.on('hide', cancel);
  window.on('closed', cancel);

  function resize(height) {
    if (!Number.isFinite(height) || height <= 0 || window.isDestroyed()) return false;
    size[1] = Math.max(80, Math.ceil(height));
    const anchor = lastPlacement?.anchor || readAnchor();
    const { display, bounds } = placement(anchor);
    const current = window.getBounds();
    if (['x', 'y', 'width', 'height'].some(key => current[key] !== bounds[key])) {
      window.setBounds(bounds, window.isVisible() && !reducedMotion());
    }
    if (lastPlacement) lastPlacement = { ...lastPlacement, bounds };
    return true;
  }

  function readAnchor(clickedTray) {
    const usable = bounds => validAnchor(bounds) && isMenuBarAnchor(bounds, screen.getDisplayMatching(bounds));
    try {
      const bounds = clickedTray?.getBounds?.();
      if (usable(bounds)) return bounds;
    } catch { /* The clicked status item may have been removed. */ }
    return getTrayBounds().find(usable) || null;
  }

  async function show(clickedTray) {
    const request = ++generation;
    let anchor = null, tries = 0;
    // macOS lays out new status items after their creation. Keep the panel hidden
    // until its anchor is available instead of flashing at a fallback position.
    for (; !remembered.point && tries < attempts; tries++) {
      if (request !== generation || window.isDestroyed()) return false;
      anchor = readAnchor(clickedTray);
      if (anchor) break;
      await wait();
    }
    if (request !== generation || window.isDestroyed()) return false;
    const { display, bounds } = placement(anchor);
    window.setBounds(bounds, false);
    lastPlacement = { bounds, anchor, display: { bounds: display.bounds, workArea: display.workArea }, attempts: Math.min(tries + 1, attempts), fallback: !anchor };
    window.show(); window.focus();
    return true;
  }
  const onDisplayChange = () => { if (window.isVisible() && !window.isDestroyed()) resize(size[1]); };
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on?.(event, onDisplayChange);
  window.once('closed', () => { for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.removeListener?.(event, onDisplayChange); });
  return { show, resize, cancel, snapshot: () => lastPlacement };
}

module.exports = { panelOptions, panelBounds, createPanelController, isMenuBarAnchor };
