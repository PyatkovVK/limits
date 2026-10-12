const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { AppearanceStore, encodeBackground, MAX_BYTES } = require('../src/common/appearance.cjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VEkAAAAASUVORK5CYII=', 'base64');
const decoder = { createFromBuffer: () => ({ isEmpty: () => false, getSize: () => ({ width: 1, height: 1 }), toPNG: () => png }) };
function store(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-appearance-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('limits-appearance-')); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, value: new AppearanceStore(root) };
}
test('background color persists independently of widget preferences and default can be restored', t => {
  const { root, value } = store(t);
  value.set({ mode: 'color', color: '#AACCEE' });
  assert.equal(new AppearanceStore(root).state().color, '#aaccee');
  assert.equal(new AppearanceStore(root).state().mode, 'color');
  value.set({ mode: 'default' }); assert.equal(value.state().mode, 'default');
  for (const invalid of [{ mode: 'remote' }, { mode: 'color', color: 'url(file:///x)' }, { mode: 'image' }]) assert.throws(() => value.set(invalid));
});
test('selected images use an app-owned copy and remain usable after the original is moved', t => {
  const { root, value } = store(t); const source = path.join(root, 'original.png'); fs.writeFileSync(source, png);
  value.importImage(source, decoder); fs.unlinkSync(source);
  const restored = new AppearanceStore(root);
  assert.equal(restored.state().mode, 'image'); assert.equal(restored.state().hasImage, true);
  assert.equal(restored.imageData(), `data:image/png;base64,${png.toString('base64')}`);
  restored.set({ mode: 'default' }); assert.equal(restored.state().hasImage, true);
});
test('invalid files and excessive images fail before being stored', () => {
  assert.throws(() => encodeBackground(Buffer.from('<svg>unsafe</svg>'), decoder), /invalidImage/);
  assert.throws(() => encodeBackground(Buffer.alloc(MAX_BYTES + 1), decoder), /invalidImage/);
  assert.throws(() => encodeBackground(png, { createFromBuffer: () => ({ isEmpty: () => true }) }), /invalidImage/);
  assert.throws(() => encodeBackground(png, { createFromBuffer: () => ({ isEmpty: () => false, getSize: () => ({ width: 10000, height: 10000 }) }) }), /imageTooLarge/);
});
test('saved paths are never trusted and missing images return to the platform default', t => {
  const { root } = store(t); const folder = path.join(root, 'appearance'); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'settings.json'), JSON.stringify({ mode: 'image', color: 'red', imageId: '../../private' }));
  const restored = new AppearanceStore(root);
  assert.equal(restored.state().mode, 'default'); assert.equal(restored.imageData(), null);
});
