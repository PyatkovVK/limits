'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { Updates } = require('../../common/updates/updates.cjs');
const { preparePackage } = require('./package.cjs');

const run = promisify(execFile);

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
      try {
        if (this.job) { await fs.promises.rm(this.job, { recursive: true, force: true }); this.job = null; }
        if (this.demo) { this.installState({ status: 'ready', progress: 100 }); return; }
        const { job, bundle } = await preparePackage(release, {
          cache: this.cache,
          target: this.target,
          applicationDirectories: this.applicationDirectories,
          arch: this.arch,
          fetchImpl: this.fetchImpl,
          runCommand: (command, args, options) => this.runCommand(command, args, options),
          signal: controller.signal,
          onProgress: progress => this.installState({ progress }),
          onVerify: () => this.installState({ status: 'verifying', progress: 100 })
        });
        if (controller.signal.aborted || this.stopped) {
          await fs.promises.rm(job, { recursive: true, force: true });
          controller.signal.throwIfAborted();
          return;
        }
        this.job = job;
        this.bundle = bundle;
        this.installState({ status: 'ready', error: null });
      } catch (error) {
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

module.exports = { AppleUpdates };
