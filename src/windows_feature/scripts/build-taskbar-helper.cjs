'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (process.platform === 'win32') {
  const source = path.resolve(__dirname, '../native/TaskbarProbe.cs');
  const output = path.resolve(__dirname, '../../../build/taskbar-helper.exe');
  const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  if (!fs.existsSync(compiler)) throw new Error('Windows .NET Framework C# compiler is missing.');
  if (!fs.existsSync(output) || fs.statSync(source).mtimeMs > fs.statSync(output).mtimeMs) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const result = spawnSync(compiler, ['/nologo', '/target:exe', '/platform:x64', `/out:${output}`, source], { stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('Could not compile taskbar geometry helper.');
    console.log('Compiled taskbar geometry helper.');
  }
}
