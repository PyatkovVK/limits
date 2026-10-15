'use strict';
const { execFile } = require('node:child_process');

function browserEnvironment(env = process.env) {
  const clean = { ...env };
  if (!env.APPDIR) return clean;
  const inside = value => value === env.APPDIR || value.startsWith(`${env.APPDIR}/`);
  // AppImage libraries and helpers belong to Limits, not the user's browser.
  for (const key of ['PATH', 'LD_LIBRARY_PATH', 'LD_PRELOAD']) {
    if (env[`${key}_ORIG`] !== undefined) clean[key] = env[`${key}_ORIG`];
    else if (env[key]) {
      const separator = key === 'LD_PRELOAD' ? /[:\s]+/ : ':';
      clean[key] = env[key].split(separator).filter(value => value && !inside(value)).join(':');
      if (!clean[key]) delete clean[key];
    }
  }
  for (const key of ['APPDIR', 'APPIMAGE', 'ARGV0']) delete clean[key];
  return clean;
}

async function openBrowser(url, { env = process.env, execute = execFile } = {}) {
  const options = { env: browserEnvironment(env), timeout: 15000, windowsHide: true };
  const run = (file, args) => new Promise((resolve, reject) => {
    execute(file, args, options, error => error ? reject(new Error('Browser launcher failed')) : resolve());
  });
  try { await run('xdg-open', [url]); }
  catch { await run('gio', ['open', url]); }
}

module.exports = { browserEnvironment, openBrowser };
