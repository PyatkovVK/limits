'use strict';
const path = require('node:path');
function configureSigning(config, target, env = process.env) {
  if (!['win', 'mac', 'linux'].includes(target)) throw new Error('Unknown signing target');
  const release = env.CODEX_LIMITS_RELEASE === '1';
  const allowUnsigned = env.CODEX_LIMITS_ALLOW_UNSIGNED === '1';
  if (target === 'win') {
    const certificate = env.WIN_CSC_LINK || env.CSC_LINK;
    if (release && !certificate && !allowUnsigned) throw new Error('Signed Windows releases require WIN_CSC_LINK (or CSC_LINK).');
    config.win.signExecutable = Boolean(certificate);
    config.win.forceCodeSigning = Boolean(certificate) || (release && !allowUnsigned);
    if (certificate) config.afterPack = path.join(__dirname, 'sign-windows-resources.cjs');
    return release && Boolean(certificate);
  }
  if (target === 'mac' && release) {
    if (!env.CSC_LINK && !env.CSC_NAME) {
      if (!allowUnsigned) throw new Error('Signed macOS releases require CSC_LINK or CSC_NAME.');
      config.mac.identity = '-';
      config.mac.forceCodeSigning = false;
      config.mac.hardenedRuntime = false;
      config.mac.notarize = false;
      return false;
    }
    if (config.mac.identity === '-' || config.mac.identity === null || env.CSC_NAME === '-') throw new Error('macOS releases require a Developer ID identity.');
    const notarization = [
      ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
      ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'],
      ['APPLE_KEYCHAIN', 'APPLE_KEYCHAIN_PROFILE']
    ].some(group => group.every(key => Boolean(env[key])));
    if (!notarization) throw new Error('macOS releases require complete Apple notarization credentials.');
    config.mac.forceCodeSigning = true;
    config.mac.hardenedRuntime = true;
    config.mac.notarize = true;
    config.mac.binaries = [...(config.mac.binaries || []), 'Contents/Resources/apple-screen-info'];
  }
  return release;
}
function signingEnvironment(env = process.env) {
  const result = { ...env };
  // The builder treats an empty certificate link as a path to the project directory.
  for (const key of ['CSC_LINK', 'WIN_CSC_LINK', 'CSC_INSTALLER_LINK']) {
    if (result[key] === '') delete result[key];
  }
  return result;
}
module.exports = { configureSigning, signingEnvironment };
