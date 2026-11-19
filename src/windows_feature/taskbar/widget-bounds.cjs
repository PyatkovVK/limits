'use strict';

function widgetBounds(metrics, { width = 280, xRatio = null } = {}) {
  if (!metrics?.available || !metrics.visible || (metrics.fullscreen && !metrics.shellFlyout)) return null;
  const bar = metrics.bar;
  const monitor = metrics.monitor;
  if (!bar) return null;
  if (bar.height > bar.width || bar.height < 30) return null;
  const left = bar.x + 56; // Leave the Start button accessible.
  const trayLeft = metrics.tray?.x > left ? metrics.tray.x : bar.x + bar.width - 300;
  const right = Math.min(bar.x + bar.width, trayLeft) - 8;
  // Accessibility rectangles cover centered app buttons and the left Widgets button.
  // Subtract them before choosing a position, including when the user drags the widget.
  const occupied = (Array.isArray(metrics.occupied) ? metrics.occupied : [])
    .filter(rect => rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key])) &&
      rect.width > 0 && rect.height > 0 && rect.y < bar.y + bar.height && rect.y + rect.height > bar.y)
    .map(rect => ({ left: Math.max(left, Math.floor(rect.x - 8)), right: Math.min(right, Math.ceil(rect.x + rect.width + 8)) }))
    .filter(rect => rect.right > rect.left)
    .sort((a, b) => a.left - b.left);
  const gaps = [];
  let cursor = left;
  for (const rect of occupied) {
    if (rect.left > cursor) gaps.push({ left: cursor, right: rect.left });
    cursor = Math.max(cursor, rect.right);
  }
  if (right > cursor) gaps.push({ left: cursor, right });
  const candidates = gaps.filter(gap => gap.right - gap.left >= 200);
  const preferredWidth = Math.max(200, Number.isFinite(width) ? width : 280);
  const desiredX = Number.isFinite(xRatio) ? Math.round(bar.x + xRatio * bar.width) : null;
  const height = Math.min(34, bar.height - 2);
  if (!candidates.length) {
    // A busy taskbar must not make the bar disappear or cover shell buttons.
    // Use a row immediately beside the taskbar until a readable gap returns.
    const fittedWidth = Math.min(preferredWidth, bar.width - 16);
    const x = Math.min(bar.x + bar.width - fittedWidth - 8, Math.max(bar.x + 8, desiredX ?? right - fittedWidth));
    const top = monitor ? bar.y < monitor.y + monitor.height / 2 : bar.y <= 0;
    return { x: Math.round(x), y: Math.round(top ? bar.y + bar.height + 8 : bar.y - height - 8), width: Math.round(fittedWidth), height: Math.round(height) };
  }
  const boundsInGap = gap => {
    const fittedWidth = Math.min(preferredWidth, gap.right - gap.left);
    const x = desiredX === null ? gap.right - fittedWidth : Math.min(gap.right - fittedWidth, Math.max(gap.left, desiredX));
    return { x, width: fittedWidth };
  };
  // Prefer the tray side, shrinking there first. If it cannot fit 200 DIP, move left.
  let fitted = boundsInGap(candidates[candidates.length - 1]);
  if (desiredX !== null) {
    for (const gap of candidates) {
      const candidate = boundsInGap(gap);
      if (Math.abs(candidate.x - desiredX) < Math.abs(fitted.x - desiredX)) fitted = candidate;
    }
  }
  return { x: Math.round(fitted.x), y: bar.y + Math.floor((bar.height - height) / 2), width: Math.round(fitted.width), height: Math.round(height) };
}

module.exports = { widgetBounds };
