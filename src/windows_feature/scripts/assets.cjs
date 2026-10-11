'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name); const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([len, type, data, crc]);
}
function makePng(size) {
const rows = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const index = y * (size * 4 + 1) + 1 + x * 4;
  const px = x * 256 / size, py = y * 256 / size;
  const corner = Math.hypot(Math.max(0, Math.abs(px - 127.5) - 81), Math.max(0, Math.abs(py - 127.5) - 81)) < 45;
  const mint = py >= 71 && py <= 105 && px >= 48 && px <= 184;
  const violet = py >= 144 && py <= 178 && px >= 48 && px <= 142;
  const track = ((py >= 71 && py <= 105) || (py >= 144 && py <= 178)) && px >= 48 && px <= 207;
  const rgb = mint ? [111, 234, 203] : violet ? [177, 162, 255] : track ? [47, 57, 75] : [15, 22, 34];
  rows[index] = rgb[0]; rows[index + 1] = rgb[1]; rows[index + 2] = rgb[2]; rows[index + 3] = corner ? 255 : 0;
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const png = makePng(256);
const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
const dir = path.resolve(__dirname, '../../../assets'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'app.ico'), Buffer.concat([header, png]));
fs.writeFileSync(path.join(dir, 'app.png'), makePng(512));
console.log('Created app.ico and app.png');
