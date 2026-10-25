'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { Accounts, AUTH_ENV_VARIABLES } = require('./accounts.cjs');

function externalOptions(home, env) {
  const isolated = { ...env, CODEX_HOME: home };
  for (const key of Object.keys(isolated)) if (AUTH_ENV_VARIABLES.includes(key.toUpperCase())) delete isolated[key];
  return { env: isolated, readOnly: true };
}
function sourceId(home) { return `active-${createHash('sha256').update(home).digest('hex').slice(0, 24)}`; }

class Subscriptions extends Accounts {
  constructor({ root, createMonitor, env = process.env, initialProfiles, demo = false, sourcesName = 'subscriptions.json' }) {
    let defaultHome = path.resolve(env.CODEX_HOME || path.join(env.HOME || os.homedir(), '.codex'));
    try { defaultHome = fs.realpathSync(defaultHome); } catch { /* Codex may not have created its home yet. */ }
    let saved;
    try { if (!demo) saved = JSON.parse(fs.readFileSync(path.join(root, sourcesName), 'utf8')); } catch { /* First launch. */ }
    const external = new Map([['default', defaultHome]]);
    super({ root, initialProfiles, createMonitor: (profile, options) => createMonitor(profile,
      external.has(profile.id) ? externalOptions(external.get(profile.id), env) : options) });
    Object.assign(this, { external, defaultHome, demo });
    this.mode = ['all', 'connected', 'active'].includes(saved?.mode) ? saved.mode : 'all';
    this.sourcesFile = path.join(root, sourcesName);
    for (const home of Array.isArray(saved?.homes) ? saved.homes.slice(0, 32) : []) {
      if (typeof home !== 'string' || !path.isAbsolute(home) || home.includes('\0')) continue;
      this.attachSource(path.resolve(home));
    }
    if (this.monitors.has(saved?.selectedProfileId)) this.selectedProfileId = saved.selectedProfileId;
  }
  isExternal(id) { return id === 'default' || Boolean(this.external?.has(id)); }
  attachSource(home) {
    if ([...this.external.values()].includes(home)) return [...this.external].find(([, value]) => value === home)[0];
    const id = sourceId(home);
    this.external.set(id, home);
    const profile = { id, nickname: '' };
    this.attach(profile); this.profiles.push(profile);
    return id;
  }
  addSource(home) {
    if (this.demo || typeof home !== 'string' || !path.isAbsolute(home) || !fs.statSync(home).isDirectory()) throw new Error('Invalid Codex home');
    home = fs.realpathSync(home);
    let privateHome = path.resolve(this.root, 'accounts');
    try { privateHome = fs.realpathSync(privateHome); } catch { /* No connected profiles yet. */ }
    if (home === privateHome || home.startsWith(privateHome + path.sep)) throw new Error('Use connected accounts for Limits profiles');
    if (this.external.size >= 33 && ![...this.external.values()].includes(home)) throw new Error('Too many sources');
    const id = this.attachSource(home);
    this.persist(); this.publish(); void this.monitors.get(id).refresh();
    return id;
  }
  snapshot() {
    const next = super.snapshot();
    const profiles = next.profiles.map(profile => ({ ...profile, source: this.isExternal(profile.id) ? 'active' : 'connected', readOnly: this.isExternal(profile.id),
      sourceLabel: profile.id === 'default' ? 'Codex / VS Code' : this.external?.has(profile.id) ? path.basename(this.external.get(profile.id)) : 'Limits' }));
    const selected = profiles.find(profile => profile.id === next.selectedProfileId);
    return { ...next, ...selected, profiles, subscriptions: { mode: this.mode || 'all', connected: profiles.filter(profile => profile.source === 'connected').length,
      active: profiles.filter(profile => profile.source === 'active').length } };
  }
  persist() {
    if (this.demo) return;
    // External references are stored separately and never written into accounts.json.
    const profiles = this.profiles.filter(profile => !this.isExternal(profile.id) || profile.id === 'default');
    fs.mkdirSync(this.root, { recursive: true });
    const write = (file, value) => { fs.writeFileSync(`${file}.tmp`, JSON.stringify(value)); fs.renameSync(`${file}.tmp`, file); };
    write(this.file, { version: 1, profiles, selectedProfileId: this.isExternal(this.selectedProfileId) ? 'default' : this.selectedProfileId });
    if (this.sourcesFile) write(this.sourcesFile, { version: 1, mode: this.mode, selectedProfileId: this.selectedProfileId,
      homes: [...this.external].filter(([id]) => id !== 'default').map(([, home]) => home) });
  }
  setMode(mode) {
    if (!['all', 'connected', 'active'].includes(mode)) throw new Error('Unknown mode');
    this.mode = mode; this.persist(); this.publish(); return this.snapshot();
  }
  login(id = this.selectedProfileId) {
    if (this.isExternal(id)) return Promise.reject(new Error('Sign in to this profile in Codex or VS Code'));
    return super.login(id);
  }
  remove(id) {
    if (!this.isExternal(id)) return super.remove(id);
    if (id === 'default') return Promise.reject(new Error('The default Codex source cannot be removed'));
    this.monitors.get(id)?.stop(); this.monitors.delete(id); this.external.delete(id);
    this.profiles = this.profiles.filter(profile => profile.id !== id);
    if (this.selectedProfileId === id) this.selectedProfileId = 'default';
    this.persist(); this.publish(); return Promise.resolve();
  }
}

module.exports = { Subscriptions, externalOptions, sourceId };
