'use strict';
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { contractError } = require('../../common/ai-connects/contracts.cjs');

class KeychainAccess {
  constructor(root, safeStorage) {
    this.root = root;
    this.safeStorage = safeStorage;
    this.approvalFile = path.join(root, 'keychain-approved');
    this.granted = existsSync(this.approvalFile);
  }

  check() {
    if (!this.granted) throw contractError('credentialStoragePermissionRequired');
  }

  request() {
    if (this.granted) return true;
    try {
      if (!this.safeStorage.isEncryptionAvailable()) return false;
      // Verify that encryption works before recording approval, without using a provider key.
      this.safeStorage.encryptString('Limits Keychain check');
      mkdirSync(this.root, { recursive: true });
      writeFileSync(this.approvalFile, '', { mode: 0o600 });
      this.granted = true;
      return true;
    } catch { return false; }
  }
}

const keychainApps = [
  '/System/Library/CoreServices/Applications/Keychain Access.app',
  '/System/Applications/Utilities/Keychain Access.app'
];

async function openKeychain() {
  const { shell } = require('electron');
  const application = keychainApps.find(existsSync);
  return Boolean(application && (await shell.openPath(application)) === '');
}

module.exports = { KeychainAccess, openKeychain };
