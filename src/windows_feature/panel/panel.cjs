'use strict';
const { createPositionStore } = require('./position-store.cjs');
const { installWindowsBridge } = require('../ipc/main.cjs');
const { dismissTrayOverflow, disablePanelTransitions } = require('../taskbar/helper.cjs');

const animationDuration = 180;
const revealDuration = 220;
const frameInterval = 1000 / 60;
const sameBounds = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

function panelPosition({ anchor, area, size }) {
  if (!anchor?.width) anchor = null;
  const [width, height] = size;
  const center = anchor ? anchor.x + anchor.width / 2 : area.x + area.width - width / 2 - 16;
  return {
    x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, center - width / 2))),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height,
      anchor && anchor.y < area.y + area.height / 2 ? area.y + 8 : area.y + area.height - height - 8))),
  };
}

function createPanelController({ window, screen, getAnchorBounds, ipcMain, getWidgetHost, root, resourcesPath, reducedMotion = () => false }) {
  // DWM can show the last frame of this transparent window before starting its fade.
  disablePanelTransitions(window, resourcesPath);
  let contentHeight = window.getSize()[1], lastAnchor = null;
  const positionStore = createPositionStore(root);
  let savedPosition = positionStore.load(), expectedPosition = null, animation = null, applyingBounds = false;
  let revealTimer;
  const cancelReveal = () => clearTimeout(revealTimer);
  const onMoved = () => {
    if (applyingBounds || window.isDestroyed() || !window.isVisible()) return;
    const [x, y] = window.getPosition();
    if (expectedPosition?.x === x && expectedPosition?.y === y) return;
    savedPosition = expectedPosition = { x, y };
    positionStore.save(savedPosition);
  };
  const onWillMove = () => {
    if (!animation) return;
    const bounds = animation.target;
    cancelAnimation();
    applyBounds(bounds);
  };
  window.on('moved', onMoved);
  window.on('will-move', onWillMove);
  window.on('hide', cancelAnimation);
  window.on('hide', cancelReveal);
  let modalOperations = 0;
  const onBlur = () => {
    if (!modalOperations && !window.isDestroyed() && window.isVisible()) window.hide();
  };
  window.on('blur', onBlur);
  const onDisplayChanged = () => { if (!window.isDestroyed() && window.isVisible()) place(lastAnchor); };
  screen.on?.('display-metrics-changed', onDisplayChanged);
  screen.on?.('display-removed', onDisplayChanged);
  window.once('closed', () => {
    cancelAnimation();
    cancelReveal();
    window.removeListener('blur', onBlur); window.removeListener('moved', onMoved);
    window.removeListener('will-move', onWillMove); window.removeListener('hide', cancelAnimation);
    window.removeListener('hide', cancelReveal);
    screen.removeListener?.('display-metrics-changed', onDisplayChanged);
    screen.removeListener?.('display-removed', onDisplayChanged);
  });
  async function withModal(operation) {
    modalOperations++;
    try { return await operation(); } finally { modalOperations--; }
  }
  function placement(anchor) {
    const [width] = window.getSize();
    const display = savedPosition ? screen.getDisplayMatching({ ...savedPosition, width, height: contentHeight }) :
      anchor?.width ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
    const area = display.workArea;
    const height = Math.min(Math.max(80, Math.ceil(contentHeight)), Math.max(1, area.height - 16));
    const position = savedPosition ? {
      x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, savedPosition.x))),
      y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height, savedPosition.y))),
    } : panelPosition({ anchor, area, size: [width, height] });
    return { ...position, width, height };
  }
  function applyBounds(bounds) {
    const current = window.getBounds();
    if (sameBounds(current, bounds)) return;
    const { width, height } = bounds;
    const resizing = height !== current.height;
    applyingBounds = true;
    try {
      // The fixed-size window needs its constraints widened before a resize.
      if (resizing) {
        window.setMinimumSize(width, Math.min(current.height, height));
        window.setMaximumSize(width, Math.max(current.height, height));
      }
      // Apply height and position together to keep the edge beside the taskbar still.
      window.setBounds(bounds);
      if (resizing) {
        window.setMinimumSize(width, height);
        window.setMaximumSize(width, height);
      }
      const [x, y] = window.getPosition();
      expectedPosition = { x, y };
    } finally {
      applyingBounds = false;
    }
  }
  function cancelAnimation() {
    clearTimeout(animation?.timer);
    animation = null;
  }
  function moveTo(target, animate) {
    const from = window.getBounds();
    if (!animate || reducedMotion() || from.height === target.height) {
      cancelAnimation();
      applyBounds(target);
      return;
    }
    if (animation && sameBounds(animation.target, target)) return;
    cancelAnimation();
    const started = performance.now();
    const motion = { target, timer: null };
    const frame = () => {
      if (window.isDestroyed() || !window.isVisible()) return cancelAnimation();
      const elapsed = (performance.now() - started) / animationDuration;
      if (elapsed >= 1 || reducedMotion()) {
        cancelAnimation();
        applyBounds(target);
        return;
      }
      const progress = 1 - (1 - elapsed) ** 3;
      const interpolate = key => Math.round(from[key] + (target[key] - from[key]) * progress);
      const bounds = { x: interpolate('x'), y: interpolate('y'), width: target.width, height: interpolate('height') };
      if (sameBounds(bounds, target)) cancelAnimation();
      applyBounds(bounds);
      if (animation === motion) motion.timer = setTimeout(frame, frameInterval);
    };
    animation = motion;
    motion.timer = setTimeout(frame, frameInterval);
  }
  function place(anchor, animate = false) {
    if (window.isDestroyed()) return false;
    lastAnchor = anchor;
    moveTo(placement(anchor), animate && window.isVisible());
    return true;
  }
  function reveal() {
    const started = performance.now();
    const frame = () => {
      if (window.isDestroyed() || !window.isVisible()) return;
      const progress = Math.min(1, (performance.now() - started) / revealDuration);
      const complete = progress === 1 || reducedMotion();
      window.setOpacity(complete ? 1 : progress * progress * (3 - 2 * progress));
      if (!complete) revealTimer = setTimeout(frame, frameInterval);
    };
    revealTimer = setTimeout(frame, frameInterval);
  }
  function show(clickedAnchor) {
    if (window.isDestroyed()) return false;
    const anchor = clickedAnchor?.getBounds?.() || getAnchorBounds?.() || null;
    const opening = !window.isVisible();
    place(anchor, !opening);
    if (clickedAnchor?.getBounds) dismissTrayOverflow(resourcesPath);
    if (opening) {
      const animateReveal = !reducedMotion();
      window.setOpacity(animateReveal ? 0 : 1);
      window.show();
      if (animateReveal) reveal();
    }
    window.focus();
    return true;
  }
  function follow(widget) {
    if (savedPosition) return false;
    if (window.isDestroyed() || !window.isVisible() || !widget || widget.isDestroyed() || !widget.isVisible()) return false;
    return place(widget.getBounds());
  }
  function resize(height) {
    if (!Number.isFinite(height) || height <= 0 || window.isDestroyed()) return false;
    contentHeight = height;
    return place(lastAnchor || getAnchorBounds?.() || null, true);
  }
  const controller = { show, follow, resize, withModal };
  if (ipcMain) installWindowsBridge({ window, screen, ipcMain, getWidgetHost, resizePanel: resize });
  return controller;
}

module.exports = { panelPosition, createPanelController };
