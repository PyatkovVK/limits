'use strict';
const { execFile } = require('node:child_process');

const { systemEnvironment } = require('./environment.cjs');

async function openBrowser(url, { env = process.env, execute = execFile } = {}) {
  const options = { env: systemEnvironment(env), timeout: 15000, windowsHide: true };
  const run = (file, args) => new Promise((resolve, reject) => {
    execute(file, args, options, error => error ? reject(new Error('Browser launcher failed')) : resolve());
  });
  try { await run('xdg-open', [url]); }
  catch { await run('gio', ['open', url]); }
}

module.exports = { openBrowser };
