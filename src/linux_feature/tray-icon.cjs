'use strict';
const { encodePng, percentage } = require('../common/tray-image.cjs');

const glyphs = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  'h': ['100', '100', '110', '101', '101'], 'd': ['001', '001', '011', '101', '011'],
  '—': ['000', '000', '111', '000', '000']
};

// StatusNotifier hosts such as XFCE fit both dimensions into their icon size.
// Keep a square canvas and draw a separate, padded badge for each quota.
// Its own dark surface keeps text readable when the panel and GTK themes differ.
function bitmap({ remaining = null, kind = 'short', stale = false, size = 20 } = {}) {
  const pixels = Buffer.alloc(size * size * 4), scale = size / 20;
  const value = percentage(remaining), label = value === null ? '—' : String(value);
  const period = kind === 'weekly' ? '7d' : '5h';
  const muted = stale || value === null;
  const accent = kind === 'weekly' ? [205, 180, 255] : [122, 239, 208];
  const surface = muted ? [36, 41, 48] : kind === 'weekly' ? [54, 36, 77] : [19, 61, 54];
  const border = muted ? [101, 108, 119] : kind === 'weekly' ? [119, 87, 160] : [47, 126, 110];
  const color = muted ? [145, 151, 160] : value <= 10 ? [255, 134, 134] : accent;
  function rect(x, y, width, height, rgb) {
    for (let py = Math.max(0, Math.round(y * scale)); py < Math.min(size, Math.round((y + height) * scale)); py++) {
      for (let px = Math.max(0, Math.round(x * scale)); px < Math.min(size, Math.round((x + width) * scale)); px++) {
        pixels.set([...rgb, 255], (py * size + px) * 4);
      }
    }
  }
  function roundedSurface(rgb, inset) {
    rect(1 + inset, 2 + inset, 18 - inset * 2, 16 - inset * 2, rgb);
    rect(2 + inset, 1 + inset, 16 - inset * 2, 18 - inset * 2, rgb);
    rect(3 + inset, inset, 14 - inset * 2, 20 - inset * 2, rgb);
  }
  roundedSurface(border, 0);
  roundedSurface(surface, 1);
  function text(content, unit, top, rgb) {
    const left = (20 - (content.length * 4 - 1) * unit) / 2;
    for (let i = 0; i < content.length; i++) glyphs[content[i]].forEach((row, y) => [...row].forEach((bit, x) => {
      if (bit === '1') rect(left + (i * 4 + x) * unit, top + y * unit, unit, unit, rgb);
    }));
  }
  text(period, 1, 1, accent);
  const unit = label.length > 2 ? 1.5 : 2;
  text(label, unit, 7 + (10 - 5 * unit) / 2, muted ? [193, 198, 205] : [250, 252, 255]);
  rect(3, 18, 14, 1, [91, 102, 114]);
  if (value !== null && value > 0) rect(3, 18, Math.max(1, Math.round(14 * value / 100)), 1, color);
  return { pixels, size, value, label, period, color, surface };
}
function png(options) {
  const { pixels, size } = bitmap(options);
  return encodePng({ pixels, width: size, height: size });
}
function icon(nativeImage, options) {
  const image = nativeImage.createFromBuffer(png(options));
  for (const scaleFactor of [1.2, 1.6, 2, 2.4, 3]) image.addRepresentation({ scaleFactor, buffer: png({ ...options, size: Math.round(20 * scaleFactor) }) });
  return image;
}
module.exports = { bitmap, png, icon };
