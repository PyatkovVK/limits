'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { systemEnvironment } = require('../core/environment.cjs');

async function launchInstaller({ file, job, resultFile, pid, kind, target, env, spawnProcess }) {
  // The shell needs a real filesystem path when the source is packaged in app.asar.
  const script = path.join(job, 'install.sh');
  fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'install-update.sh')), { mode: 0o700 });
  const child = spawnProcess('/bin/sh', [script, String(pid), kind, file, target, job, resultFile], {
    detached: true, stdio: 'ignore', env: systemEnvironment(env)
  });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
}

module.exports = { launchInstaller };
