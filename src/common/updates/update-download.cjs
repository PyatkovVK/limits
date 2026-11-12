'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { validatedReleaseUrl } = require('./updates.cjs');
const DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com']);
function assetUrl(asset, release) {
  validatedReleaseUrl(release.url, release.tag);
  const url = new URL(asset?.browser_download_url);
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash ||
      url.pathname !== `/PyatkovVK/limits/releases/download/${release.tag}/${asset.name}`) throw new Error('invalidPackage');
  return url.href;
}
function checksumFor(text, name) {
  const matches = text.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64}) [ *](.+)$/.exec(line)).filter(match => match?.[2] === name);
  if (matches.length !== 1) throw new Error('invalidPackage');
  return matches[0][1].toLowerCase();
}
async function responseFor(url, { signal, fetchImpl }) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || !DOWNLOAD_HOSTS.has(parsed.hostname)) throw new Error('invalidPackage');
    const response = await fetchImpl(url, { signal, redirect: 'manual', credentials: 'omit', headers: { 'User-Agent': 'Limits-update' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('downloadFailed');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) throw new Error('downloadFailed');
    return response;
  }
  throw new Error('downloadFailed');
}
async function download(url, file, { signal, fetchImpl, maxBytes, onProgress = () => {} }) {
  const response = await responseFor(url, { signal, fetchImpl });
  const total = Number(response.headers.get('content-length')) || 0;
  if (total > maxBytes || !response.body) { await response.body?.cancel(); throw new Error('invalidPackage'); }
  const hash = createHash('sha256');
  const output = await fs.promises.open(file, 'wx', 0o600);
  let size = 0;
  try {
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      size += chunk.length;
      if (size > maxBytes) throw new Error('invalidPackage');
      hash.update(chunk);
      await output.writeFile(chunk);
      onProgress(total ? Math.min(100, Math.floor(size * 100 / total)) : null);
    }
  } finally { await output.close(); }
  if (!size || (total && total !== size)) throw new Error('downloadFailed');
  return { hash: hash.digest('hex'), size };
}

module.exports = { assetUrl, checksumFor, responseFor, download };
