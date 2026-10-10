'use strict';
const zlib = require('node:zlib');

const glyphs = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  '—': ['000', '000', '111', '000', '000']
};

function percentage(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : null;
}
function bitmap({ remaining = null, kind = 'short', stale = false, dark = true, size = 16 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const value = percentage(remaining);
  const label = value === null ? '—' : String(value);
  const scale = size / 16;
  const unit = label.length > 2 ? 1 : 2;
  const textWidth = (label.length * 4 - 1) * unit;
  const text = stale || value === null ? [145, 145, 145] : dark ? [245, 245, 245] : [25, 25, 25];
  const color = stale || value === null ? [145, 145, 145] : value <= 10 ? [255, 134, 134] : kind === 'weekly' ? [177, 162, 255] : [111, 234, 203];
  function rect(x, y, width, height, rgb) {
    for (let py = Math.round(y * scale); py < Math.min(size, Math.round((y + height) * scale)); py++) {
      for (let px = Math.round(x * scale); px < Math.min(size, Math.round((x + width) * scale)); px++) {
        const offset = (py * size + px) * 4;
        pixels[offset] = rgb[0]; pixels[offset + 1] = rgb[1]; pixels[offset + 2] = rgb[2]; pixels[offset + 3] = 255;
      }
    }
  }
  for (let i = 0; i < label.length; i++) {
    glyphs[label[i]].forEach((row, y) => [...row].forEach((bit, x) => {
      if (bit === '1') rect((16 - textWidth) / 2 + (i * 4 + x) * unit, 1 + (10 - 5 * unit) / 2 + y * unit, unit, unit, text);
    }));
  }
  rect(1, 13, 14, 2, dark ? [75, 75, 75] : [160, 160, 160]);
  if (value !== null && value > 0) rect(1, 13, Math.max(1, Math.round(14 * value / 100)), 2, color);
  return { pixels, size, value, label, color };
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
function png(options) {
  const { pixels, size } = bitmap(options);
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function icon(nativeImage, options) {
  const image = nativeImage.createFromBuffer(png(options));
  for (const scaleFactor of [1.25, 1.5, 2, 2.5, 3]) image.addRepresentation({ scaleFactor, buffer: png({ ...options, size: Math.round(16 * scaleFactor) }) });
  return image;
}
module.exports = { percentage, bitmap, png, icon };
