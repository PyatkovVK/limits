'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { normalizeVersion } = require('../updates/updates.cjs');

const release = '2.0.0';
const marker = 'welcome-2.0-shown';
const previousProfileFiles = [
  'widget-settings.json',
  'accounts.json',
  'update-settings.json',
  'reset-notifications.json',
  path.join('appearance', 'settings.json'),
];

function welcomeMode(root, version) {
  if (normalizeVersion(version) !== release || fs.existsSync(path.join(root, marker))) return null;
  return previousProfileFiles.some(file => fs.existsSync(path.join(root, file))) ? 'update' : 'install';
}

function markWelcomeShown(root) {
  fs.mkdirSync(root, { recursive: true });
  try {
    // Exclusive creation makes checking and claiming this one-time UI atomic.
    fs.writeFileSync(path.join(root, marker), '', { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

module.exports = { welcomeMode, markWelcomeShown };
