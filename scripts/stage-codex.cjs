'use strict';
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build this Windows x64 release on Windows x64.');
const base = path.dirname(require.resolve('@openai/codex-win32-x64/package.json'));
const source = path.join(base, 'vendor', 'x86_64-pc-windows-msvc', 'bin');
if (!fs.existsSync(path.join(source, 'codex.exe'))) throw new Error('Missing bundled Codex binary. Run npm install.');
if (!fs.existsSync(path.resolve(__dirname, '../licenses/Apache-2.0.txt'))) throw new Error('Missing Codex license.');
console.log('Bundled Codex CLI:', require('@openai/codex/package.json').version);
