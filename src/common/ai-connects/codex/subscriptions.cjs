'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Accounts } = require('../../core/accounts.cjs');
const { externalOptions } = require('./options.cjs');

class Subscriptions extends Accounts {
  constructor({ root, createMonitor, env = process.env, initialProfiles, demo = false, sourcesName = 'subscriptions.json', registry, controllerContext = () => ({}) }) {
    let defaultHome = path.resolve(env.CODEX_HOME || path.join(env.HOME || os.homedir(), '.codex'));
    try { defaultHome = fs.realpathSync(defaultHome); } catch { /* Codex may not have created its home yet. */ }
    let saved;
    try { if (!demo) saved = JSON.parse(fs.readFileSync(path.join(root, sourcesName), 'utf8')); } catch { /* First launch. */ }
    super({ root, initialProfiles, createMonitor, registry, controllerContext: profile => ({ env, ...controllerContext(profile), ...(profile.providerId === 'codex' && profile.id === 'default' ? { sourceHome: defaultHome } : {}) }) });
    this.demo = demo;
    this.mode = ['all', 'connected', 'active'].includes(saved?.mode) ? saved.mode : 'all';
    this.sourcesFile = path.join(root, sourcesName);
    if (this.monitors.has(saved?.selectedProfileId)) this.selectedProfileId = saved.selectedProfileId;
  }
  isExternal(id) { return id === 'default' && this.profiles.some(profile => profile.id === id && profile.providerId === 'codex'); }
  snapshot() {
    const next = super.snapshot();
    const profiles = next.profiles.map(profile => ({ ...profile, source: this.isExternal(profile.id) ? 'active' : 'connected', readOnly: this.isExternal(profile.id),
      sourceLabel: this.isExternal(profile.id) ? 'Codex / VS Code' : 'Limits' }));
    const selected = profiles.find(profile => profile.id === next.selectedProfileId);
    return { ...next, ...selected, profiles, subscriptions: { mode: this.mode || 'all', connected: profiles.filter(profile => profile.source === 'connected').length,
      active: profiles.filter(profile => profile.source === 'active').length } };
  }
  persist() {
    if (this.demo) return;
    super.persist();
    if (this.sourcesFile) {
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
