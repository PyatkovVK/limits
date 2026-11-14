'use strict';
const { existsSync } = require('node:fs');
const { shell } = require('electron');

const keychainApps = [
  '/System/Library/CoreServices/Applications/Keychain Access.app',
  '/System/Applications/Utilities/Keychain Access.app'
];

async function openKeychain() {
  const application = keychainApps.find(path => existsSync(path));
  return Boolean(application && (await shell.openPath(application)) === '');
}

module.exports = { openKeychain };
