'use strict';
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { Updates } = require('./updates.cjs');
const { assetUrl, checksumFor, download } = require('./update-download.cjs');
const MAX_PACKAGE = 1024 * 1024 * 1024;
async function fileHash(file) {
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('invalidPackage');
  const hash = createHash('sha256'); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest('hex');
}
class PackageUpdates extends Updates {
  constructor({ app, adapter, ...options }) {
    super(options); Object.assign(this, { app, adapter });
    this.cache = path.join(options.root, 'package-updates');
    this.resultFile = path.join(options.root, 'package-update-result.json');
    this.installation = { enabled: Boolean(options.demo || adapter.enabled), status: 'idle', progress: null, error: null, version: null };
    try {
      if (JSON.parse(fs.readFileSync(this.resultFile)).status === 'failed') this.installation = { ...this.installation, status: 'error', error: 'installFailed' };
      fs.rmSync(this.resultFile, { force: true });
    } catch { /* No previous installation. */ }
  }
  snapshot() { return { ...super.snapshot(), installation: this.installation && { ...this.installation } }; }
  installState(patch) { Object.assign(this.installation, patch); this.emit('state', this.snapshot()); }
  clearJob() { if (this.job) { try { fs.rmSync(this.job, { recursive: true, force: true }); } catch {} this.job = null; } }
  publish(patch) {
    if (patch.status === 'current' && this.installation && this.installation.status !== 'installing') {
      this.downloadController?.abort(); this.clearJob();
      this.installation = { ...this.installation, status: 'idle', progress: null, error: null, version: null };
    }
    super.publish(patch);
    if (patch.status === 'available' && this.installation?.enabled) void this.prepare(this.state.release);
  }
  prepare(release) {
    if (this.stopped || !release || !this.installation.enabled || this.installation.status === 'installing') return Promise.resolve();
    if (this.downloadTask && this.downloadVersion === release.version) return this.downloadTask;
    if (this.installation.status === 'ready' && this.installation.version === release.version) return Promise.resolve();
    this.downloadController?.abort();
    const controller = new AbortController(); this.downloadController = controller; this.downloadVersion = release.version;
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000); timeout.unref?.();
    const previous = this.downloadTask;
    const task = Promise.resolve().then(async () => {
      await previous?.catch(() => {});
      if (this.stopped || controller.signal.aborted) return;
      this.clearJob(); this.installState({ status: 'downloading', progress: null, version: release.version, error: null });
      let job;
      try {
        if (this.demo) { this.installState({ status: 'ready', progress: 100 }); return; }
        await this.adapter.checkTarget();
        const response = await this.fetchImpl(`https://api.github.com/repos/PyatkovVK/limits/releases/tags/${encodeURIComponent(release.tag)}`, {
          signal: controller.signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Limits-update' } });
        if (!response.ok) throw new Error('downloadFailed');
        const metadata = await response.json();
        if (metadata.tag_name !== release.tag || metadata.draft !== false || metadata.prerelease !== false || !Array.isArray(metadata.assets)) throw new Error('invalidPackage');
        const name = this.adapter.assetName(release);
        const packages = metadata.assets.filter(asset => asset.name === name), manifests = metadata.assets.filter(asset => asset.name === 'SHA256SUMS.txt');
        if (packages.length !== 1 || manifests.length !== 1 || !Number.isSafeInteger(packages[0].size) || packages[0].size <= 0 || packages[0].size > MAX_PACKAGE) throw new Error('invalidPackage');
        fs.mkdirSync(this.cache, { recursive: true, mode: 0o700 }); job = fs.mkdtempSync(path.join(this.cache, 'download-'));
        const manifest = path.join(job, 'SHA256SUMS.txt');
        await download(assetUrl(manifests[0], release), manifest, { signal: controller.signal, fetchImpl: this.fetchImpl, maxBytes: 1024 * 1024 });
        const expected = checksumFor(fs.readFileSync(manifest, 'utf8'), name), file = path.join(job, name);
        let progress = -1;
        const value = await download(assetUrl(packages[0], release), file, { signal: controller.signal, fetchImpl: this.fetchImpl, maxBytes: packages[0].size,
          onProgress: next => { if (next !== progress && !controller.signal.aborted) { progress = next; this.installState({ progress: next }); } } });
        if (value.hash !== expected || value.size !== packages[0].size) throw new Error('invalidPackage');
        this.installState({ status: 'verifying', progress: 100 });
        await this.adapter.validate(file, release, controller.signal); controller.signal.throwIfAborted();
        this.job = job; this.packageFile = file; this.digest = expected;
        this.installState({ status: 'ready', error: null });
      } catch (error) {
        if (job) await fs.promises.rm(job, { recursive: true, force: true }).catch(() => {});
        if (!controller.signal.aborted && !this.stopped) this.installState({ status: 'error', error: ['invalidPackage', 'installLocation', 'packageManagerMissing'].includes(error.message) ? error.message : 'downloadFailed' });
      }
    }).finally(() => { clearTimeout(timeout); if (this.downloadTask === task) this.downloadTask = null; });
    this.downloadTask = task; return task;
  }
  async openRelease() {
    if (!this.installation.enabled) return super.openRelease();
    if (this.stopped || !this.state.release || this.installation.status === 'installing') return { error: 'unavailable' };
    if (this.installation.status !== 'ready' || this.installation.version !== this.state.release.version) {
      await this.prepare(this.state.release);
      return this.installation.status === 'ready' ? { downloaded: true } : { error: this.installation.error || 'unavailable' };
    }
    if (this.demo) { this.dismiss(this.state.release.version); return { simulated: true }; }
    this.installState({ status: 'installing' });
    try {
      if (await fileHash(this.packageFile) !== this.digest) throw new Error('invalidPackage');
      if (this.stopped) return { error: 'unavailable' };
      await this.adapter.checkTarget();
      if (this.stopped) return { error: 'unavailable' };
      await this.adapter.install({ file: this.packageFile, job: this.job, resultFile: this.resultFile, pid: process.pid });
      this.handedOff = true; this.app.quit(); return { installing: true };
    } catch (error) {
      this.installState({ status: 'error', error: error.message === 'invalidPackage' ? 'invalidPackage' : 'installFailed' });
      return { error: this.installation.error };
    }
  }
  stop() { super.stop(); this.downloadController?.abort(); if (!this.handedOff) this.clearJob(); }
}
module.exports = { PackageUpdates, fileHash };
