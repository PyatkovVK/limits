'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Updates, validatedReleaseUrl } = require('../../common/updates/updates.cjs');
const { assetUrl, checksumFor, download } = require('../../common/updates/update-download.cjs');
const { copyInstallerScript, verifyWindowsPackage, launchInstaller } = require('./installer.cjs');

class WindowsUpdates extends Updates {
  constructor({ app, env = process.env, arch = process.arch, spawnProcess = spawn, verifyPackage, ...options }) {
    super(options);
    Object.assign(this, { app, spawnProcess, arch });
    this.target = app?.isPackaged ? path.resolve(env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')) : null;
    this.portable = Boolean(env.PORTABLE_EXECUTABLE_FILE);
    this.cache = path.join(options.root, 'windows-updates');
    this.resultFile = path.join(options.root, 'windows-update-result.json');
    this.verifyPackage = verifyPackage || ((file, version) => verifyWindowsPackage(file, version, this.target));
    this.installation = { enabled: Boolean(options.demo || (this.target && arch === 'x64')), status: 'idle', progress: null, error: null, version: null };
    try {
      if (JSON.parse(fs.readFileSync(this.resultFile, 'utf8').replace(/^\uFEFF/, '')).status === 'failed') this.installation = { ...this.installation, status: 'error', error: 'installFailed' };
      fs.rmSync(this.resultFile, { force: true });
    } catch { /* No previous installation result. */ }
  }
  snapshot() { return { ...super.snapshot(), installation: this.installation && { ...this.installation } }; }
  installState(patch) { Object.assign(this.installation, patch); this.emit('state', this.snapshot()); }
  publish(patch) {
    if (patch.status === 'current' && this.installation && this.installation.status !== 'installing') {
      this.downloadController?.abort();
      this.installation = { ...this.installation, status: 'idle', progress: null, error: null, version: null };
      if (this.job) { fs.rmSync(this.job, { recursive: true, force: true }); this.job = null; }
    }
    super.publish(patch);
  }
  prepare(release) {
    if (this.stopped || !release || !this.installation.enabled || this.installation.status === 'installing') return Promise.resolve();
    if (this.downloadTask && this.downloadVersion === release.version) return this.downloadTask;
    if (this.installation.version === release.version && this.installation.status === 'ready') return Promise.resolve();
    this.downloadController?.abort();
    const controller = new AbortController(), previous = this.downloadTask;
    this.downloadController = controller; this.downloadVersion = release.version;
    const timer = setTimeout(() => controller.abort(), 15 * 60 * 1000); timer.unref?.();
    const task = Promise.resolve().then(async () => {
      await previous?.catch(() => {});
      if (controller.signal.aborted || this.stopped) return;
      this.installState({ status: 'downloading', version: release.version, error: null, progress: null });
      let job;
      try {
        if (this.job) { await fs.promises.rm(this.job, { recursive: true, force: true }); this.job = null; }
        if (this.demo) { this.installState({ status: 'ready', progress: 100 }); return; }
        validatedReleaseUrl(release.url, release.tag);
        fs.accessSync(path.dirname(this.target), fs.constants.W_OK);
        const response = await this.fetchImpl(`https://api.github.com/repos/PyatkovVK/limits/releases/tags/${encodeURIComponent(release.tag)}`,
          { signal: controller.signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Limits-Windows-update' } });
        if (!response.ok) throw new Error('downloadFailed');
        const metadata = await response.json();
        if (metadata.tag_name !== release.tag || metadata.draft !== false || metadata.prerelease !== false || !Array.isArray(metadata.assets)) throw new Error('invalidPackage');
        const name = this.portable ? `Limits-${release.version}-portable.exe` : `Limits-Setup-${release.version}.exe`;
        const packages = metadata.assets.filter(asset => asset.name === name), manifests = metadata.assets.filter(asset => asset.name === 'SHA256SUMS.txt');
        if (packages.length !== 1 || manifests.length !== 1 || !Number.isSafeInteger(packages[0].size) || packages[0].size <= 0 || packages[0].size > 1024 ** 3) throw new Error('invalidPackage');
        fs.mkdirSync(this.cache, { recursive: true });
        job = fs.mkdtempSync(path.join(this.cache, 'download-'));
        const manifest = path.join(job, 'SHA256SUMS.txt');
        await download(assetUrl(manifests[0], release), manifest, { signal: controller.signal, fetchImpl: this.fetchImpl, maxBytes: 1024 * 1024 });
        const expected = checksumFor(fs.readFileSync(manifest, 'utf8'), name), file = path.join(job, name);
        let progress;
        const downloaded = await download(assetUrl(packages[0], release), file, { signal: controller.signal, fetchImpl: this.fetchImpl, maxBytes: packages[0].size,
          onProgress: value => { if (value !== progress && !controller.signal.aborted) { progress = value; this.installState({ progress: value }); } } });
        if (downloaded.hash !== expected || downloaded.size !== packages[0].size) throw new Error('invalidPackage');
        this.installState({ status: 'verifying', progress: 100 });
        copyInstallerScript(job);
        try { await this.verifyPackage(file, release.version); } catch { throw new Error('invalidPackage'); }
        controller.signal.throwIfAborted();
        this.job = job; this.packageFile = file; this.packageHash = expected;
        this.installState({ status: 'ready', error: null });
      } catch (error) {
        if (job) await fs.promises.rm(job, { recursive: true, force: true });
        if (!controller.signal.aborted && !this.stopped) this.installState({ status: 'error', error: error.message === 'invalidPackage' ? 'invalidPackage' : 'downloadFailed' });
      }
    }).finally(() => { clearTimeout(timer); if (this.downloadTask === task) this.downloadTask = null; });
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
    try {
      this.installState({ status: 'installing' });
      await launchInstaller({
        job: this.job, target: this.target, packageFile: this.packageFile, packageHash: this.packageHash,
        version: this.state.release.version, portable: this.portable, resultFile: this.resultFile,
        pid: process.pid, spawnProcess: (...args) => this.spawnProcess(...args),
      });
      this.handedOff = true;
      this.app.quit();
      return { installing: true };
    } catch { this.installState({ status: 'error', error: 'installFailed' }); return { error: 'installFailed' }; }
  }
  stop() {
    super.stop(); this.downloadController?.abort();
    if (this.job && !this.handedOff) fs.rmSync(this.job, { recursive: true, force: true });
  }
}
module.exports = { WindowsUpdates };
