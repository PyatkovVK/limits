'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function buildHelper() {
  if (process.platform !== 'darwin') return;
  const root = path.resolve(__dirname, '../../..');
  const source = path.join(__dirname, '../native/screen-info.m');
  const target = path.join(root, 'build/apple-screen-info');
  if (fs.existsSync(target) && fs.statSync(target).mtimeMs > fs.statSync(source).mtimeMs) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Universal helper: both Mac targets can use the same AppKit screen probe.
  const result = spawnSync('xcrun', ['clang', source, '-o', target, '-arch', 'arm64', '-arch', 'x86_64', '-mmacosx-version-min=11.0', '-framework', 'AppKit', '-framework', 'CoreGraphics', '-O2'], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Cannot build Apple screen helper. Install Xcode Command Line Tools (xcode-select --install).');
}
if (require.main === module) buildHelper();
module.exports = { buildHelper };
