'use strict';
const { percentage } = require('../../common/tray/tray-image.cjs');
const { format } = require('../../common/renderer/countdown.js');

const glyphs = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ':': ['000', '010', '000', '010', '000'],
  '—': ['000', '000', '111', '000', '000'],
  h: ['100', '100', '110', '101', '101'],
  d: ['001', '001', '011', '101', '011'],
  '%': ['101', '001', '010', '100', '101'],
  ' ': ['000', '000', '000', '000', '000']
};

const quotaWidth = 64;
const countdownWidth = 40;
const glyphPixel = 2;
const glyphAdvance = 8;

function createBitmap(width, height, scale) {
  const pixels = Buffer.alloc(width * height * 4);
  function rect(x, y, w, h, rgb, alpha = 255) {
    const right = Math.min(width, Math.round((x + w) * scale));
    const bottom = Math.min(height, Math.round((y + h) * scale));
    const color = [...rgb, alpha];
    for (let py = Math.round(y * scale); py < bottom; py++) {
      for (let px = Math.round(x * scale); px < right; px++) {
        pixels.set(color, (py * width + px) * 4);
      }
    }
  }
  return { pixels, width, height, rect };
}

function drawLabel(rect, label, center, top, color, alpha) {
  const left = center - (label.length * glyphAdvance - glyphPixel) / 2;
  Array.from(label).forEach((character, index) => {
    glyphs[character].forEach((row, y) => {
      Array.from(row).forEach((bit, x) => {
        if (bit === '1') rect(left + index * glyphAdvance + x * glyphPixel, top + y * glyphPixel, glyphPixel, glyphPixel, color, alpha);
      });
    });
  });
}

function quotaColor(value, kind, stale, dark) {
  if (stale || value === null) return [145, 145, 155];
  if (value <= 10) return [233, 85, 99];
  if (kind === 'weekly') return dark ? [189, 168, 255] : [114, 73, 212];
  return dark ? [108, 236, 201] : [0, 137, 110];
}

function menuBitmap({ remaining = null, kind = 'short', stale = false, dark = true, size = 16 } = {}) {
  const scale = size / 16;
  const { pixels, width, height, rect } = createBitmap(Math.round(quotaWidth * scale), Math.round(18 * scale), scale);
  const value = percentage(remaining);
  const label = `${kind === 'weekly' ? '7d' : '5h'} ${value === null ? '—' : `${value}%`}`;
  const text = dark ? [250, 250, 250] : [25, 28, 34];
  const color = quotaColor(value, kind, stale, dark);
  drawLabel(rect, label, quotaWidth / 2, 1, text, stale ? 155 : 255);
  rect(2, 12, 60, 4, text, 45);
  if (value !== null && value > 0) rect(2, 12, Math.max(1, 60 * value / 100), 4, color);
  // Transparent corners keep the menu-bar tracks softly rounded at Retina scales.
  for (const x of [2, 61]) for (const y of [12, 15]) rect(x, y, 1, 1, text, 0);
  return { pixels, width, height, value, label, color };
}

function menuBitmapWithCountdown(options = {}) {
  const quota = menuBitmap(options);
  if (options.kind === 'weekly') return quota;
  const scale = (options.size || 16) / 16;
  const { pixels, width, rect } = createBitmap(Math.round((quotaWidth + countdownWidth) * scale), quota.height, scale);
  for (let y = 0; y < quota.height; y++) {
    quota.pixels.copy(pixels, y * width * 4, y * quota.width * 4, (y + 1) * quota.width * 4);
  }
  const formatted = format(options.resetsAt, options.now);
  const countdown = formatted.length <= 5 ? formatted : '—';
  const text = options.dark === false ? [55, 60, 70] : [210, 212, 220];
  drawLabel(rect, countdown, quotaWidth + countdownWidth / 2, 4, text, options.stale ? 130 : 230);
  return { ...quota, pixels, width, countdown };
}

module.exports = { menuBitmap, menuBitmapWithCountdown };
