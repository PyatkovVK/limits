'use strict';
const { encodePng, percentage } = require('../common/tray-image.cjs');

const glyphs = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  '—': ['000', '000', '111', '000', '000'],
  'h': ['100', '100', '110', '101', '101'], 'd': ['001', '001', '011', '101', '011'],
  '%': ['101', '001', '010', '100', '101'], ' ': ['000', '000', '000', '000', '000']
};

function menuBitmap({ remaining = null, kind = 'short', stale = false, dark = true, size = 16 } = {}) {
  const scale = size / 16, width = Math.round(64 * scale), height = Math.round(18 * scale);
  const pixels = Buffer.alloc(width * height * 4), value = percentage(remaining);
  const label = `${kind === 'weekly' ? '7d' : '5h'} ${value === null ? '—' : `${value}%`}`;
  const text = dark ? [250, 250, 250] : [25, 28, 34];
  const color = stale || value === null ? [145, 145, 155] : value <= 10 ? [233, 85, 99] : kind === 'weekly' ? (dark ? [189, 168, 255] : [114, 73, 212]) : (dark ? [108, 236, 201] : [0, 137, 110]);
  function rect(x, y, w, h, rgb, alpha = 255) {
    for (let py = Math.round(y * scale); py < Math.min(height, Math.round((y + h) * scale)); py++) {
      for (let px = Math.round(x * scale); px < Math.min(width, Math.round((x + w) * scale)); px++) {
        const offset = (py * width + px) * 4;
        pixels.set([...rgb, alpha], offset);
      }
    }
  }
  const unit = 2, textWidth = (label.length * 4 - 1) * unit;
  for (let i = 0; i < label.length; i++) glyphs[label[i]].forEach((row, y) => [...row].forEach((bit, x) => {
    if (bit === '1') rect((64 - textWidth) / 2 + (i * 4 + x) * unit, 1 + y * unit, unit, unit, text, stale ? 155 : 255);
  }));
  rect(2, 12, 60, 4, text, 45);
  if (value !== null && value > 0) rect(2, 12, Math.max(1, 60 * value / 100), 4, color);
  // Transparent corners keep the menu-bar tracks softly rounded at Retina scales.
  for (const x of [2, 61]) for (const y of [12, 15]) rect(x, y, 1, 1, text, 0);
  return { pixels, width, height, value, label, color };
}
function png(options) { return encodePng(menuBitmap(options)); }
function icon(nativeImage, options) {
  const image = nativeImage.createFromBuffer(png(options));
  for (const scaleFactor of [2, 3]) image.addRepresentation({ scaleFactor, buffer: png({ ...options, size: 16 * scaleFactor }) });
  return image;
}
module.exports = { menuBitmap, png, icon };
