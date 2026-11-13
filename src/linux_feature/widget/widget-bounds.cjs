'use strict';

const { WIDTHS } = require('../../common/core/preferences.cjs');
function widgetBounds(area, width, position) {
  width = Math.min(WIDTHS.includes(width) ? width : 280, Math.max(1, area.width - 16));
  const height = Math.min(56, Math.max(1, area.height - 16));
  return { x: Math.round(Math.max(area.x + 8, Math.min(area.x + area.width - width - 8, position?.x ?? area.x + area.width - width - 16))),
    y: Math.round(Math.max(area.y + 8, Math.min(area.y + area.height - height - 8, position?.y ?? area.y + area.height - height - 8))), width, height };
}

module.exports = { widgetBounds };
