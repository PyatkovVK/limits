'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assetUrl, checksumFor, download } = require('../../common/updates/update-download.cjs');
const { validateArchiveListing, verifyBundle } = require('./bundle.cjs');

const releaseApi = 'https://api.github.com/repos/PyatkovVK/limits/releases/tags/';
const maxArchiveBytes = 1024 * 1024 * 1024;

function checkTarget(target, applicationDirectories) {
  const parent = path.dirname(target);
  if (path.basename(target) !== 'Limits.app' || !applicationDirectories.includes(parent) ||
      fs.realpathSync(target) !== target) throw new Error('moveToApplications');
  fs.accessSync(parent, fs.constants.W_OK);
  fs.accessSync(target, fs.constants.W_OK);
}

async function releaseFiles(release, arch, { signal, fetchImpl }) {
  const metadata = await fetchImpl(`${releaseApi}${encodeURIComponent(release.tag)}`, {
    signal,
    redirect: 'error',
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Limits-mac-update' }
  });
  if (!metadata.ok) throw new Error('downloadFailed');
  const details = await metadata.json();
  if (details.tag_name !== release.tag || details.draft !== false || details.prerelease !== false ||
      !Array.isArray(details.assets)) throw new Error('invalidPackage');
  const name = `Limits-${release.version}-${arch}.zip`;
  const archives = details.assets.filter(asset => asset.name === name);
  const manifests = details.assets.filter(asset => asset.name === 'SHA256SUMS.txt');
  if (archives.length !== 1 || manifests.length !== 1) throw new Error('invalidPackage');
  const [zip] = archives;
  if (!Number.isSafeInteger(zip.size) || zip.size <= 0 || zip.size > maxArchiveBytes) throw new Error('invalidPackage');
  return { zip, checksumManifest: manifests[0] };
}

async function preparePackage(release, {
  cache, target, applicationDirectories, arch, fetchImpl, runCommand, signal, onProgress, onVerify
}) {
  checkTarget(target, applicationDirectories);
  const { zip, checksumManifest } = await releaseFiles(release, arch, { signal, fetchImpl });
  fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
  const job = fs.mkdtempSync(path.join(cache, 'download-'));
  try {
    const manifest = path.join(job, 'SHA256SUMS.txt');
    await download(assetUrl(checksumManifest, release), manifest, { signal, fetchImpl, maxBytes: 1024 * 1024 });
    const expected = checksumFor(fs.readFileSync(manifest, 'utf8'), zip.name);
    const archive = path.join(job, zip.name);
    let progress = -1;
    const downloaded = await download(assetUrl(zip, release), archive, {
      signal, fetchImpl, maxBytes: zip.size,
      onProgress(value) {
        if (value === progress || signal.aborted) return;
        progress = value;
        onProgress(value);
      }
    });
    if (downloaded.hash !== expected || downloaded.size !== zip.size) throw new Error('invalidPackage');
    onVerify();

    const commandOptions = { signal, timeout: 120000, maxBuffer: 32 * 1024 * 1024 };
    const run = (command, args) => runCommand(command, args, commandOptions);
    const listing = await run('/usr/bin/unzip', ['-Z1', archive]);
    validateArchiveListing(listing.stdout);
    const stage = path.join(job, 'unpacked');
    fs.mkdirSync(stage);
    await run('/usr/bin/ditto', ['-x', '-k', archive, stage]);
    const bundle = path.join(stage, 'Limits.app');
    await verifyBundle(bundle, { version: release.version, arch, currentApp: target, runCommand: run });
    signal.throwIfAborted();

    fs.writeFileSync(path.join(job, 'install.sh'), fs.readFileSync(path.join(__dirname, 'install-update.sh')), { mode: 0o700 });
    return { job, bundle };
  } catch (error) {
    await fs.promises.rm(job, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { preparePackage };
