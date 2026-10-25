'use strict';
const fs = require('node:fs');
const path = require('node:path');

function createPanelPosition({ window, root, name }) {
  const file = root && path.join(root, `${name}-panel-position.json`);
  let point = null, expected = null, timer;
  const valid = value => value && Number.isSafeInteger(value.x) && Number.isSafeInteger(value.y);
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); if (valid(value)) point = { x: value.x, y: value.y }; } catch { /* First launch. */ }
  function flush() {
    clearTimeout(timer); timer = null;
    if (window.isDestroyed()) return;
    const bounds = window.getBounds();
    if (!valid(bounds) || (expected && Math.abs(bounds.x - expected.x) <= 1 && Math.abs(bounds.y - expected.y) <= 1)) return;
    point = expected = { x: bounds.x, y: bounds.y };
    if (file) try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(point)); fs.renameSync(`${file}.tmp`, file);
    } catch { /* Retain the position in memory if storage is unavailable. */ }
  }
  const onMove = () => {
    if (window.isDestroyed() || !window.isVisible()) return;
    clearTimeout(timer); timer = setTimeout(flush, 200); timer.unref?.();
  };
  function dispose() { if (timer) flush(); clearTimeout(timer); window.removeListener('move', onMove); window.removeListener('moved', onMove); }
  window.on('move', onMove); window.on('moved', onMove); window.once('closed', dispose);
  return { get point() { return point; }, expect(bounds) { expected = { x: bounds.x, y: bounds.y }; }, flush, dispose,
    bounds(area, size) {
      if (!point) return null;
      const width = Math.min(size[0], Math.max(1, area.width - 16));
      const height = Math.min(size[1], Math.max(1, area.height - 16));
      return { x: Math.round(Math.max(area.x + 8, Math.min(area.x + area.width - width - 8, point.x))),
        y: Math.round(Math.max(area.y + 8, Math.min(area.y + area.height - height - 8, point.y))), width, height };
    }
  };
}
module.exports = { createPanelPosition };
