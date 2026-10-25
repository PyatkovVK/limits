'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { verifyPE, windowsAdapter } = require('../updates.cjs');
test('Windows package verification rejects non-PE files and foreign publishers', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-win-package-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'fixture.exe'), bytes = Buffer.alloc(128); bytes.write('MZ'); bytes.writeUInt32LE(64, 60); bytes.write('PE', 64); bytes.writeUInt16LE(0x14c, 68);
  fs.writeFileSync(file, bytes); await verifyPE(file);
  const adapter = windowsAdapter({ arch: 'x64', app: { isPackaged: true, getPath: () => file }, env: {}, runCommand: async (_command, _args, options) => {
    assert.deepEqual(JSON.parse(options.env.LIMITS_UPDATE_SIGNATURE_FILES), [file, file]); throw new Error('Publisher mismatch');
  } });
  await assert.rejects(adapter.validate(file), /invalidPackage/);
  bytes.writeUInt32LE(4000, 60); fs.writeFileSync(file, bytes); await assert.rejects(verifyPE(file));
});
test('the real Windows helper replaces a portable executable and restores it after a failed launch', { skip: process.platform !== 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-win-helper-')); t.after(async () => { await new Promise(resolve => setTimeout(resolve, 3500)); fs.rmSync(root, { recursive: true, force: true }); });
  const system = process.env.SystemRoot || 'C:\\Windows';
  const compiler = path.join(system, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  const powershell = path.join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  for (const fail of [false, true]) {
    const dir = path.join(root, String(fail)); fs.mkdirSync(dir); const job = path.join(dir, 'job'); fs.mkdirSync(job);
    const target = path.join(dir, "Limits user's file.exe"), source = path.join(job, 'next.exe'), resultFile = path.join(dir, 'result.json');
    const compile = (output, failing) => {
      const code = path.join(dir, path.basename(output) + '.cs');
      fs.writeFileSync(code, `class Program { static void Main() { ${failing ? 'System.Environment.Exit(13);' : 'System.Threading.Thread.Sleep(3000);'} } }`);
      const result = spawnSync(compiler, ['/nologo', '/target:exe', `/out:${output}`, code], { encoding: 'utf8', windowsHide: true });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    compile(target, false); compile(source, fail); const old = fs.readFileSync(target), next = fs.readFileSync(source);
    const config = path.join(job, 'install.json'); fs.writeFileSync(config, JSON.stringify({ pid: 999999999, portable: true, source, target, job, resultFile }));
    const output = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '../install-update.ps1'), '-ConfigFile', config], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    assert.equal(output.status, fail ? 1 : 0, output.stderr);
    assert.equal(JSON.parse(fs.readFileSync(resultFile)).status, fail ? 'failed' : 'installed');
    assert.deepEqual(fs.readFileSync(target), fail ? old : next);
  }
});
