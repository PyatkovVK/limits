'use strict';
const { encodePng } = require('../../common/tray/tray-image.cjs');
const { menuBitmapWithCountdown: menuBitmap } = require('./bitmap.cjs');

function png(options) {
  return encodePng(menuBitmap(options));
}

function icon(nativeImage, options) {
  const image = nativeImage.createFromBuffer(png(options));
  for (const scaleFactor of [2, 3]) image.addRepresentation({ scaleFactor, buffer: png({ ...options, size: 16 * scaleFactor }) });
  return image;
}

module.exports = { menuBitmap, png, icon };
