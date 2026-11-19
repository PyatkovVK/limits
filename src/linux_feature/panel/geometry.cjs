'use strict';

const PANEL_WIDTH = 528;
const PANEL_ZOOM = 1.2;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 720;
const margin = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function panelEdge(display, anchor) {
  const area = display.workArea, bounds = display.bounds || area;
  if (anchor) return anchor.y + anchor.height / 2 < bounds.y + bounds.height / 2 ? 'top' : 'bottom';
  // Opening without a click (for example at startup) follows the reserved panel.
  const top = area.y - bounds.y;
  const bottom = bounds.y + bounds.height - area.y - area.height;
  return top > bottom ? 'top' : 'bottom';
}

function panelBounds({ area, contentHeight, width = PANEL_WIDTH, anchor, edge = 'bottom', position }) {
  const panelWidth = Math.min(width, Math.max(1, area.width - margin * 2));
  const height = Math.min(Math.max(MIN_HEIGHT, Math.ceil(contentHeight)), MAX_HEIGHT, Math.max(1, area.height - margin * 2));
  const x = position ? position.x : anchor ? anchor.x + anchor.width / 2 - panelWidth / 2 : area.x + area.width - panelWidth - 16;
  const y = position ? (edge === 'top' ? position.y : position.y + position.height - height) : edge === 'top'
    ? Math.max(area.y, anchor ? anchor.y + anchor.height : area.y) + margin
    : Math.min(area.y + area.height, anchor ? anchor.y : area.y + area.height) - margin - height;
  return {
    x: Math.round(clamp(x, area.x + margin, area.x + area.width - panelWidth - margin)),
    y: Math.round(clamp(y, area.y + margin, area.y + area.height - height - margin)),
    width: panelWidth, height
  };
}

module.exports = { PANEL_WIDTH, PANEL_ZOOM, MAX_HEIGHT, panelBounds, panelEdge };
