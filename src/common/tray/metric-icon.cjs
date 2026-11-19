'use strict';
const { encodePng } = require('./tray-image.cjs');
// Small numeric readout; the tooltip retains the full localized value and unit.
const glyphs = {
  '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'], '2': ['111','001','111','100','111'],
  '3': ['111','001','111','001','111'], '4': ['101','101','111','001','001'], '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'], '7': ['111','001','010','010','010'], '8': ['111','101','111','101','111'],
  '9': ['111','101','111','001','111'], '.': ['000','000','000','000','010'], '-': ['000','000','111','000','000'],
  'K': ['101','101','110','101','101'], 'M': ['101','111','111','101','101'], 'B': ['110','101','110','101','110'],
  'T': ['111','010','010','010','010'], '?': ['111','001','011','000','010']
};
function png(metric, { dark = true, stale = false, size = 32 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const label = metric?.value == null ? '-' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(metric.value);
  const lines = label.length > 4 ? [label.slice(0, 4), label.slice(4, 8)] : [label];
  const color = stale || metric?.value == null ? 145 : dark ? 245 : 25;
  lines.forEach((line, row) => {
    const scale = 2, width = (line.length * 4 - 1) * scale;
    const top = lines.length === 1 ? 10 : 4 + row * 13;
    [...line].forEach((char, index) => (glyphs[char] || glyphs['?']).forEach((bits, y) => [...bits].forEach((bit, x) => {
      if (bit !== '1') return;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const px = Math.floor((size - width) / 2) + (index * 4 + x) * scale + dx, py = top + y * scale + dy;
        if (px < 0 || px >= size || py >= size) continue;
        const offset = (py * size + px) * 4; pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = color; pixels[offset + 3] = 255;
      }
    })));
  });
  return encodePng({ pixels, width: size, height: size });
}
function icon(nativeImage, metric, options) { return nativeImage.createFromBuffer(png(metric, options)); }
module.exports = { icon, png };
