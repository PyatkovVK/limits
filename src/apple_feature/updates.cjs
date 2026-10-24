'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { Updates, validatedReleaseUrl, compareVersions } = require('../common/updates.cjs');
const run = promisify(execFile);
const API = 'https://api.github.com/repos/PyatkovVK/limits/releases/tags/';
const DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com']);
const MAX_ARCHIVE = 1024 * 1024 * 1024;

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
function validateArchiveListing(list) {
  const names = list.trim().split(/\r?\n/);
  if (!names.length || !names.some(name => name.startsWith('Limits.app/'))) throw new Error('invalidPackage');
  for (const name of names) {
    if ((!name.startsWith('Limits.app/') && !name.startsWith('__MACOSX/')) || name.includes('\\') ||
        name.split('/').some(part => part === '..') || /[\x00-\x1f\x7f]/.test(name)) throw new Error('invalidPackage');
  }
}
async function responseFor(url, { signal, fetchImpl }) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || !DOWNLOAD_HOSTS.has(parsed.hostname)) throw new Error('invalidPackage');
    const response = await fetchImpl(url, { signal, redirect: 'manual', credentials: 'omit', headers: { 'User-Agent': 'Limits-mac-update' } });
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
async function verifyBundle(bundle, { version, arch, currentApp, runCommand = run }) {
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

class AppleUpdates extends Updates {
  constructor({ app, arch = process.arch, runCommand = run, spawnProcess = spawn,
    applicationDirectories = ['/Applications', path.join(os.homedir(), 'Applications')], ...options }) {
    super(options);
    Object.assign(this, { app, arch, runCommand, spawnProcess, applicationDirectories });
    this.cache = path.join(options.root, 'mac-updates');
    this.target = app?.isPackaged ? path.resolve(app.getPath('exe'), '../../..') : null;
    this.resultFile = path.join(options.root, 'mac-update-result.json');
    this.installation = { enabled: Boolean(options.demo || this.target), status: 'idle', progress: null, error: null, version: null };
    try {
      if (JSON.parse(fs.readFileSync(this.resultFile)).status === 'failed') this.installation = { ...this.installation, status: 'error', error: 'installFailed' };
      fs.rmSync(this.resultFile, { force: true });
    } catch { /* No previous installation result. */ }
  }
  snapshot() { return { ...super.snapshot(), installation: this.installation && { ...this.installation } }; }
  publish(patch) {
    if (patch.status === 'current' && this.installation) {
      this.downloadController?.abort();
      this.installation = { ...this.installation, status: 'idle', progress: null, error: null, version: null };
      if (this.job) { fs.rmSync(this.job, { recursive: true, force: true }); this.job = null; }
    }
    super.publish(patch);
    if (patch.status === 'available' && this.installation?.enabled) void this.prepare(this.state.release);
  }
  installState(patch) { Object.assign(this.installation, patch); this.emit('state', this.snapshot()); }
  prepare(release) {
    if (this.stopped || !release || !this.installation.enabled || this.installation.status === 'installing') return Promise.resolve();
    if (this.downloadTask && this.downloadVersion === release.version) return this.downloadTask;
    if (this.installation.version === release.version && this.installation.status === 'ready') return Promise.resolve();
    this.downloadController?.abort();
    const controller = new AbortController();
    this.downloadController = controller;
    this.downloadVersion = release.version;
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000); timeout.unref?.();
    const previous = this.downloadTask;
    const task = Promise.resolve().then(async () => {
      await previous?.catch(() => {});
      if (controller.signal.aborted || this.stopped) return;
      this.installState({ status: 'downloading', progress: null, version: release.version, error: null });
      let job;
      try {
        if (this.job) { await fs.promises.rm(this.job, { recursive: true, force: true }); this.job = null; }
        if (this.demo) { this.installState({ status: 'ready', progress: 100 }); return; }
        const parent = path.dirname(this.target);
        if (path.basename(this.target) !== 'Limits.app' || !this.applicationDirectories.includes(parent) ||
            fs.realpathSync(this.target) !== this.target) throw new Error('moveToApplications');
        fs.accessSync(parent, fs.constants.W_OK);
        fs.accessSync(this.target, fs.constants.W_OK);
        const metadata = await this.fetchImpl(`${API}${encodeURIComponent(release.tag)}`, { signal: controller.signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Limits-mac-update' } });
        if (!metadata.ok) throw new Error('downloadFailed');
        const details = await metadata.json();
        if (details.tag_name !== release.tag || details.draft !== false || details.prerelease !== false || !Array.isArray(details.assets)) throw new Error('invalidPackage');
        const name = `Limits-${release.version}-${this.arch}.zip`;
        const zip = details.assets.filter(asset => asset.name === name);
        const sums = details.assets.filter(asset => asset.name === 'SHA256SUMS.txt');
        if (zip.length !== 1 || sums.length !== 1 || !Number.isSafeInteger(zip[0].size) || zip[0].size <= 0 || zip[0].size > MAX_ARCHIVE) throw new Error('invalidPackage');
        fs.mkdirSync(this.cache, { recursive: true, mode: 0o700 });
        job = fs.mkdtempSync(path.join(this.cache, 'download-'));
        const manifest = path.join(job, 'SHA256SUMS.txt');
        await download(assetUrl(sums[0], release), manifest, { signal: controller.signal, fetchImpl: this.fetchImpl, maxBytes: 1024 * 1024 });
        const expected = checksumFor(fs.readFileSync(manifest, 'utf8'), name);
        const archive = path.join(job, name);
        let progress = -1;
        const downloaded = await download(assetUrl(zip[0], release), archive, { signal: controller.signal, fetchImpl: this.fetchImpl, maxBytes: zip[0].size,
          onProgress: value => { if (value !== progress && !controller.signal.aborted) { progress = value; this.installState({ progress: value }); } } });
        if (downloaded.hash !== expected || downloaded.size !== zip[0].size) throw new Error('invalidPackage');
        this.installState({ status: 'verifying', progress: 100 });
        const commandOptions = { signal: controller.signal, timeout: 120000, maxBuffer: 32 * 1024 * 1024 };
        const listing = await this.runCommand('/usr/bin/unzip', ['-Z1', archive], commandOptions);
        validateArchiveListing(listing.stdout);
        const stage = path.join(job, 'unpacked'); fs.mkdirSync(stage);
        await this.runCommand('/usr/bin/ditto', ['-x', '-k', archive, stage], commandOptions);
        const bundle = path.join(stage, 'Limits.app');
        await verifyBundle(bundle, { version: release.version, arch: this.arch, currentApp: this.target,
          runCommand: (command, args) => this.runCommand(command, args, commandOptions) });
        controller.signal.throwIfAborted();
        fs.writeFileSync(path.join(job, 'install.sh'), fs.readFileSync(path.join(__dirname, 'install-update.sh')), { mode: 0o700 });
        this.job = job; this.bundle = bundle;
        this.installState({ status: 'ready', error: null });
      } catch (error) {
        if (job) await fs.promises.rm(job, { recursive: true, force: true });
        if (!controller.signal.aborted && !this.stopped) this.installState({ status: 'error', error: ['invalidPackage', 'moveToApplications'].includes(error.message) ? error.message : 'downloadFailed' });
        else if (!this.stopped && this.downloadController === controller) this.installState({ status: 'error', error: 'downloadFailed' });
      }
    }).finally(() => { clearTimeout(timeout); if (this.downloadTask === task) this.downloadTask = null; });
    this.downloadTask = task;
    return task;
  }
  async openRelease() {
    if (!this.installation.enabled) return super.openRelease();
    if (!this.state.release || this.stopped || this.installation.status === 'installing') return { error: 'unavailable' };
    if (this.installation.status !== 'ready' || this.installation.version !== this.state.release.version) {
      await this.prepare(this.state.release);
      return this.installation.status === 'ready' ? { downloaded: true } : { error: this.installation.error || 'unavailable' };
    }
    if (this.demo) { this.dismiss(this.state.release.version); return { simulated: true }; }
    try {
      this.installState({ status: 'installing' });
      const child = this.spawnProcess('/bin/sh', [path.join(this.job, 'install.sh'), String(process.pid), this.bundle, this.target, this.job, this.resultFile],
        { detached: true, stdio: 'ignore', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' } });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref(); this.handedOff = true;
      this.app.quit();
      return { installing: true };
    } catch { this.installState({ status: 'error', error: 'installFailed' }); return { error: 'installFailed' }; }
  }
  stop() {
    super.stop(); this.downloadController?.abort();
    if (this.job && !this.handedOff) fs.rmSync(this.job, { recursive: true, force: true });
  }
}

module.exports = { AppleUpdates, assetUrl, checksumFor, validateArchiveListing, responseFor, download, verifyBundle };
