'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Accounts } = require('../../core/accounts.cjs');
const { externalOptions, fileAuthArgs } = require('./options.cjs');

class Subscriptions extends Accounts {
  constructor({ root, createMonitor, env = process.env, initialProfiles, demo = false, isolateDefault = false, allowRemoveDefault = false, sourcesName = 'subscriptions.json', registry, controllerContext = () => ({}) }) {
    let defaultHome = path.resolve(isolateDefault ? path.join(root, 'codex-source') : env.CODEX_HOME || path.join(env.HOME || os.homedir(), '.codex'));
    if (isolateDefault) fs.mkdirSync(defaultHome, { recursive: true });
    try { defaultHome = fs.realpathSync(defaultHome); } catch { /* Codex may not have created its home yet. */ }
    let saved;
    try { if (!demo) saved = JSON.parse(fs.readFileSync(path.join(root, sourcesName), 'utf8')); } catch { /* First launch. */ }
    const defaultSource = { sourceHome: defaultHome, ...(isolateDefault ? { args: fileAuthArgs } : {}) };
    super({ root, initialProfiles, createMonitor, registry, allowRemoveDefault, controllerContext: profile => ({ env, ...controllerContext(profile),
      ...(profile.providerId === 'codex' && profile.id === 'default' ? defaultSource : {}) }) });
    this.demo = demo;
    this.mode = ['all', 'connected', 'active'].includes(saved?.mode) ? saved.mode : 'all';
    this.sourcesFile = path.join(root, sourcesName);
    if (this.monitors.has(saved?.selectedProfileId)) this.selectedProfileId = saved.selectedProfileId;
  }
  isExternal(id) { return id === 'default' && this.profiles.some(profile => profile.id === id && profile.providerId === 'codex'); }
  snapshot() {
    const next = super.snapshot();
    const profiles = next.profiles.map(profile => {
      const external = this.isExternal(profile.id);
      return { ...profile, source: external ? 'active' : 'connected', readOnly: external,
        sourceLabel: external ? 'Codex / VS Code' : 'Limits', removable: profile.id !== 'default' || this.allowRemoveDefault };
    });
    const selected = profiles.find(profile => profile.id === next.selectedProfileId);
    return { ...next, ...selected, profiles, subscriptions: { mode: this.mode || 'all', connected: profiles.filter(profile => profile.source === 'connected').length,
      active: profiles.filter(profile => profile.source === 'active').length } };
  }
  persist({ writeSourcePreferences = true } = {}) {
    if (this.demo) return;
    super.persist();
    if (writeSourcePreferences && this.sourcesFile) {
      fs.writeFileSync(`${this.sourcesFile}.tmp`, JSON.stringify({ version: 1, mode: this.mode, selectedProfileId: this.selectedProfileId }));
      fs.renameSync(`${this.sourcesFile}.tmp`, this.sourcesFile);
    }
  }
  setMode(mode) {
    if (!['all', 'connected', 'active'].includes(mode)) throw new Error('Unknown mode');
    this.mode = mode; this.persist(); this.publish(); return this.snapshot();
  }
  login(id = this.selectedProfileId) {
    if (this.isExternal(id)) return Promise.reject(new Error('Sign in to this profile in Codex or VS Code'));
    return super.login(id);
  }
}

module.exports = { Subscriptions, externalOptions };
