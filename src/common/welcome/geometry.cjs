'use strict';

function welcomeBounds({ display, anchor, edge }) {
  const area = display.workArea;
  const gap = 8;
  const width = Math.min(522, Math.max(1, area.width - gap * 2));
  const height = Math.min(504, Math.max(1, area.height - gap * 2));
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  const horizontal = edge === 'left' || edge === 'right';
  const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(max, value)));
  let x = anchor ? anchor.x + (anchor.width - width) / 2 : right - width - gap;
  let y = edge === 'top'
    ? Math.max(area.y, anchor ? anchor.y + anchor.height : area.y) + gap
    : Math.min(bottom, anchor?.y ?? bottom) - height - gap;
  if (horizontal) {
    x = edge === 'left'
      ? Math.max(area.x, anchor ? anchor.x + anchor.width : area.x) + gap
      : Math.min(right, anchor?.x ?? right) - width - gap;
    y = anchor ? anchor.y + (anchor.height - height) / 2 : bottom - height - gap;
  }
  return {
    x: clamp(x, area.x + gap, right - width - gap),
    y: clamp(y, area.y + gap, bottom - height - gap),
    width, height,
  };
}

module.exports = { welcomeBounds };
