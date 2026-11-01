'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function packageNames(version) {
  return [
    `Limits-${version}-portable.exe`,
    `Limits-Setup-${version}.exe`,
    `Limits-${version}-arm64.dmg`,
    `Limits-${version}-arm64.zip`,
    `Limits-${version}-x64.dmg`,
    `Limits-${version}-x64.zip`,
    `Limits-${version}-x86_64.AppImage`,
    `Limits-${version}-amd64.deb`,
  ];
}

async function verifyPackages(directory, version) {
  const names = packageNames(version);
  for (const name of names) {
    const stat = fs.statSync(path.join(directory, name), { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size === 0) throw new Error(`Missing or empty package: ${name}`);
  }
  const checksums = [];
  for (const name of names) {
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(path.join(directory, name))) hash.update(chunk);
    checksums.push(`${hash.digest('hex')}  ${name}\n`);
  }
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), checksums.join(''));
}

if (require.main === module) {
  const version = process.env.RELEASE_VERSION || require('../../package.json').version;
  verifyPackages(path.resolve('release'), version).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { packageNames, verifyPackages };
