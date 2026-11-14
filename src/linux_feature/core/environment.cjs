'use strict';

function systemEnvironment(env = process.env) {
  const clean = { ...env };
  if (!env.APPDIR) return clean;
  const inside = value => value === env.APPDIR || value.startsWith(`${env.APPDIR}/`);
  // AppImage libraries and helpers belong to Limits, not external system processes.
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

module.exports = { systemEnvironment };
