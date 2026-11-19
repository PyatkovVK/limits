'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { compareVersions } = require('../../common/updates/updates.cjs');

function validateArchiveListing(list) {
  const names = list.trim().split(/\r?\n/);
  if (!names.length || !names.some(name => name.startsWith('Limits.app/'))) throw new Error('invalidPackage');
  for (const name of names) {
    if ((!name.startsWith('Limits.app/') && !name.startsWith('__MACOSX/')) || name.includes('\\') ||
        name.split('/').some(part => part === '..') || /[\x00-\x1f\x7f]/.test(name)) throw new Error('invalidPackage');
  }
}
async function verifyBundle(bundle, { version, arch, currentApp, runCommand = promisify(execFile) }) {
  const plist = path.join(bundle, 'Contents', 'Info.plist');
  const read = async key => (await runCommand('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist])).stdout.trim();
  if (await read('CFBundleIdentifier') !== 'dev.codexlimits.desktop' || compareVersions(await read('CFBundleShortVersionString'), version) !== 0 ||
      await read('CFBundleExecutable') !== 'Limits' || fs.lstatSync(bundle).isSymbolicLink()) throw new Error('invalidPackage');
  await runCommand('/usr/bin/lipo', ['-verify_arch', arch === 'arm64' ? 'arm64' : 'x86_64', path.join(bundle, 'Contents/MacOS/Limits')]);
  await runCommand('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
  const team = async app => /(?:^|\n)TeamIdentifier=([^\s]+)/.exec((await runCommand('/usr/bin/codesign', ['-dv', '--verbose=4', app])).stderr)?.[1];
  const existingTeam = await team(currentApp);
  if (existingTeam && existingTeam !== 'not' && existingTeam !== await team(bundle)) throw new Error('invalidPackage');
}

module.exports = { validateArchiveListing, verifyBundle };
