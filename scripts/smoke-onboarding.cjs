'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function run() {
  if (process.platform !== 'win32') throw new Error('Run the Windows onboarding check on Windows.');
  const electron = require('electron');
  const scenario = path.resolve(__dirname, '../test/smoke/windows-onboarding.cjs');
  const parent = path.resolve(__dirname, '../artifacts');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'onboarding-smoke-'));
  try {
    const child = spawn(electron, [scenario, `--onboarding-profile=${root}`, ...process.argv.slice(2)], { stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (status, signal) => {
        if (status === null) reject(new Error(`Electron exited with signal ${signal}`));
        else resolve(status);
      });
    });
    process.exitCode = code;
  } finally {
    // Chromium may still be writing profile files during Electron's will-quit event.
    const resolved = fs.realpathSync(root);
    if (path.dirname(resolved) !== fs.realpathSync(parent) || !path.basename(resolved).startsWith('onboarding-smoke-')) {
      throw new Error(`Unsafe smoke cleanup path: ${resolved}`);
    }
    await fs.promises.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

run().catch(error => {
  console.error('ONBOARDING_SMOKE_RUNNER_FAILED:', error);
  process.exitCode = 1;
});
