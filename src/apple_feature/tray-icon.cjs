'use strict';
const mac = require('./menu-image.cjs');
const { encodePng } = require('../common/tray-image.cjs');
const { format } = require('../common/renderer/countdown.js');

const glyphs = {
  '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'], '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'], '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'], '7': ['111','001','010','010','010'],
  '8': ['111','101','111','101','111'], '9': ['111','101','111','001','111'],
  ':': ['000','010','000','010','000'], '—': ['000','000','111','000','000']
};
function menuBitmap(options = {}) {
  const original = mac.menuBitmap(options);
  if (options.kind === 'weekly') return original;
  const scale = (options.size || 16) / 16;
  const width = Math.round(104 * scale), height = original.height;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) original.pixels.copy(pixels, y * width * 4, y * original.width * 4, (y + 1) * original.width * 4);
  const formatted = format(options.resetsAt, options.now);
  const countdown = formatted.length <= 5 ? formatted : '—';
  const rgb = options.dark === false ? [55,60,70] : [210,212,220];
  const start = 64 + (40 - (countdown.length * 4 - 1) * 2) / 2;
  for (let i = 0; i < countdown.length; i++) glyphs[countdown[i]].forEach((row, y) => [...row].forEach((bit, x) => {
    if (bit !== '1') return;
    for (let py = Math.round((4 + y * 2) * scale); py < Math.round((6 + y * 2) * scale); py++) {
      for (let px = Math.round((start + (i * 4 + x) * 2) * scale); px < Math.round((start + (i * 4 + x) * 2 + 2) * scale); px++) pixels.set([...rgb, options.stale ? 130 : 230], (py * width + px) * 4);
    }
  }));
  return { ...original, pixels, width, countdown };
}
function png(options) { return encodePng(menuBitmap(options)); }
function icon(nativeImage, options) {
  const image = nativeImage.createFromBuffer(png(options));
  for (const scaleFactor of [2, 3]) image.addRepresentation({ scaleFactor, buffer: png({ ...options, size: 16 * scaleFactor }) });
  return image;
}
module.exports = { menuBitmap, png, icon };
