'use strict';

const fs = require('node:fs');

async function verifyAppImage(file, arch) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const data = Buffer.alloc(64); const { bytesRead } = await handle.read(data, 0, 64, 0);
    if (bytesRead !== 64 || data.toString('hex', 0, 4) !== '7f454c46' || data[4] !== 2 || data[5] !== 1 ||
        data.toString('hex', 8, 11) !== '414902' || data.readUInt16LE(18) !== (arch === 'arm64' ? 183 : 62)) throw new Error('invalidPackage');
  } finally { await handle.close(); }
}

module.exports = { verifyAppImage };
