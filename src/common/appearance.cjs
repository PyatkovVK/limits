'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const MODES = ['default', 'color', 'image'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_STORED = 3 * 1024 * 1024;
function validColor(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
function imageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
function encodeBackground(bytes, nativeImage) {
  if (!imageFormat(bytes) || bytes.length > MAX_BYTES) throw new Error('invalidImage');
  let image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw new Error('invalidImage');
  const size = image.getSize();
  if (size.width * size.height > 32 * 1024 * 1024) throw new Error('imageTooLarge');
  const scale = Math.min(1, 1280 / Math.max(size.width, size.height));
  if (scale < 1) image = image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)), quality: 'best' });
  let output = image.toPNG();
  if (output.length > MAX_STORED) {
    const current = image.getSize();
    const smaller = Math.min(1, 960 / Math.max(current.width, current.height));
    output = image.resize({ width: Math.max(1, Math.round(current.width * smaller)), height: Math.max(1, Math.round(current.height * smaller)), quality: 'best' }).toPNG();
  }
  if (output.length > MAX_STORED) throw new Error('imageTooLarge');
  return output;
}
class AppearanceStore {
  constructor(root) {
    this.root = path.join(root, 'appearance');
    this.file = path.join(this.root, 'settings.json');
    this.value = { mode: 'default', color: '#202632', imageId: '' };
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (MODES.includes(saved.mode)) this.value.mode = saved.mode;
      if (validColor(saved.color)) this.value.color = saved.color;
      if (typeof saved.imageId === 'string' && /^[a-f0-9-]{36}$/.test(saved.imageId)) this.value.imageId = saved.imageId;
    } catch { /* Use the platform default for absent or invalid saved preferences. */ }
    if (!this.hasImage() && this.value.mode === 'image') this.value.mode = 'default';
  }
  imagePath(id = this.value.imageId) { return path.join(this.root, `${id}.png`); }
  hasImage() {
    if (!this.value.imageId) return false;
    try { const file = fs.statSync(this.imagePath()); return file.isFile() && file.size > 0 && file.size <= MAX_STORED; } catch { return false; }
  }
  state() { return { mode: this.value.mode, color: this.value.color, hasImage: this.hasImage(), imageId: this.value.imageId }; }
  save(next) {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(next));
    this.value = next;
    return this.state();
  }
  set({ mode, color } = {}) {
    if (!MODES.includes(mode) || (color !== undefined && !validColor(color)) || (mode === 'image' && !this.hasImage())) throw new Error('invalidAppearance');
    return this.save({ ...this.value, mode, ...(color === undefined ? {} : { color: color.toLowerCase() }) });
  }
  importImage(filename, nativeImage) {
    const stat = fs.statSync(filename);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('imageTooLarge');
    const output = encodeBackground(fs.readFileSync(filename), nativeImage);
    const id = randomUUID();
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(this.imagePath(id), output);
    const old = this.value.imageId;
    const state = this.save({ ...this.value, mode: 'image', imageId: id });
    if (old) { try { fs.unlinkSync(this.imagePath(old)); } catch { /* A stale local copy does not affect the current background. */ } }
    return state;
  }
  imageData() {
    if (!this.hasImage()) return null;
    if (this.cachedId !== this.value.imageId) {
      const bytes = fs.readFileSync(this.imagePath());
      if (imageFormat(bytes) !== 'png') return null;
      this.cachedId = this.value.imageId;
      this.cachedData = `data:image/png;base64,${bytes.toString('base64')}`;
    }
    return this.cachedData;
  }
}
module.exports = { AppearanceStore, validColor, encodeBackground, imageFormat, MAX_BYTES };
