'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { contractError } = require('./contracts.cjs');

class CredentialStore {
  constructor(file, safeStorage) { Object.assign(this, { file, safeStorage }); }
  available() {
    if (!this.safeStorage?.isEncryptionAvailable() || this.safeStorage.getSelectedStorageBackend?.() === 'basic_text') throw contractError('credentialStorageUnavailable');
  }
  read() {
    try {
      if (!fs.existsSync(this.file)) return null;
      this.available();
      return this.safeStorage.decryptString(fs.readFileSync(this.file));
    } catch { throw contractError('credentialStorageUnavailable'); }
  }
  write(key) {
    try {
      this.available();
      const encrypted = this.safeStorage.encryptString(key);
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, encrypted, { mode: 0o600 });
      fs.renameSync(`${this.file}.tmp`, this.file);
    } catch {
      try { fs.unlinkSync(`${this.file}.tmp`); } catch { /* No temporary file. */ }
      throw contractError('credentialStorageUnavailable');
    }
  }
  clear() {
    try { fs.unlinkSync(this.file); } catch (error) { if (error.code !== 'ENOENT') throw contractError('credentialStorageUnavailable'); }
  }
}
function apiKey(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192 || /[\x00-\x20\x7f]/.test(value.trim())) throw contractError('invalidApiKey');
  return value.trim();
}
function keyConnectionOptions({ root, profile, safeStorage, ...options }, providerId) {
  const file = path.join(root, 'accounts', profile.id, `${providerId}-key.bin`);
  return { ...options, credentials: new CredentialStore(file, safeStorage) };
}
module.exports = { CredentialStore, keyConnectionOptions, apiKey };
