'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { KeychainAccess } = require('../ai-connects/keychain.cjs');
const { keyConnectionOptions } = require('../../common/ai-connects/api-key-credentials.cjs');
const { DeepSeekController } = require('../../common/ai-connects/deepseek/controller.cjs');

test('saved API keys wait for explicit Keychain approval and work after a restart', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-keychain-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stored = Buffer.from('encrypted-key-fixture');
  let available = false, encryptionDenied = true, checks = 0;
  const safeStorage = {
    isEncryptionAvailable() { checks++; return available; },
    encryptString() {
      if (encryptionDenied) throw new Error('Keychain access denied');
      return stored;
    },
    decryptString(bytes) { assert.deepEqual(bytes, stored); return 'sk-fixture'; }
  };
  const profile = { id: 'existing' };
  const access = new KeychainAccess(root, safeStorage);
  const options = gate => keyConnectionOptions({ root, profile, safeStorage, checkCredentialAccess: () => gate.check() }, 'deepseek');
  const { credentials } = options(access);
  assert.equal(credentials.read(), null);
  assert.throws(() => credentials.write('sk-fixture'), { code: 'credentialStoragePermissionRequired' });
  fs.mkdirSync(path.dirname(credentials.file), { recursive: true });
  fs.writeFileSync(credentials.file, stored);

  const client = { async balance(key) {
    assert.equal(key, 'sk-fixture');
    return { is_available: true, balance_infos: [{ currency: 'USD', total_balance: '1' }] };
  } };
  const controller = new DeepSeekController({ ...options(access), client });
  assert.equal((await controller.refresh()).error, 'credentialStoragePermissionRequired');
  assert.equal(checks, 0, 'background refresh must not probe Keychain');
  assert.equal(access.request(), false);
  assert.equal(new KeychainAccess(root, safeStorage).granted, false);
  assert.equal((await controller.refresh()).error, 'credentialStoragePermissionRequired');
  assert.equal(checks, 1, 'background refresh must not retry a denied request');

  available = true;
  assert.equal(access.request(), false);
  assert.equal(new KeychainAccess(root, safeStorage).granted, false);
  encryptionDenied = false;
  assert.equal(access.request(), true);
  assert.equal((await controller.refresh()).status, 'ready');
  const restored = new KeychainAccess(root, safeStorage);
  assert.equal(restored.granted, true);
  const before = checks;
  assert.equal(restored.request(), true);
  assert.equal(checks, before, 'a saved approval skips the permission request');
  const reopened = new DeepSeekController({ ...options(restored), client });
  assert.equal((await reopened.refresh()).status, 'ready');
});
