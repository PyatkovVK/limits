'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function locations({ app, env = process.env }) {
  if (!app.isPackaged) return null;
  const executable = env.APPIMAGE || app.getPath('exe');
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || /[\x00-\x1f\x7f=]/.test(executable)) return null;
  const config = env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(app.getPath('home'), '.config');
  return { executable, file: path.join(config, 'autostart', 'limits.desktop') };
}
function desktopEntry(executable) {
  // Exec quoting is applied after desktop-entry string escaping. Literal percent
  // signs must also survive field-code expansion; no shell is involved.
  const quoted = executable.replace(/%/g, '%%').replace(/["`$\\]/g, '\\$&');
  const command = `"${quoted}" --hidden`.replace(/\\/g, '\\\\');
  return `[Desktop Entry]\nType=Application\nVersion=1.0\nName=Limits\nComment=Show Codex usage limits\nExec=${command}\nIcon=limits\nTerminal=false\nStartupNotify=false\nX-GNOME-Autostart-enabled=true\n`;
}
function readEnabled(file) {
  let inEntry = false;
  const values = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith('[')) { inEntry = text === '[Desktop Entry]'; continue; }
    if (!inEntry || text.startsWith('#')) continue;
    const index = text.indexOf('=');
    if (index > 0) values.set(text.slice(0, index).trim(), text.slice(index + 1).trim());
  }
  return values.get('Type') === 'Application' && Boolean(values.get('Exec')) && values.get('Hidden') !== 'true' && values.get('X-GNOME-Autostart-enabled') !== 'false';
}
function writableDirectory(directory) {
  while (!fs.existsSync(directory)) {
    const parent = path.dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
  if (!fs.statSync(directory).isDirectory()) return false;
  fs.accessSync(directory, fs.constants.W_OK | fs.constants.X_OK);
  return true;
}
function startupState(options) {
  const state = { supported: true, available: false, enabled: false };
  if (options.demo || options.smoke) return state;
  try {
    const target = locations(options);
    if (!target) return state;
    try { state.enabled = readEnabled(target.file); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!fs.statSync(target.executable).isFile()) return state;
    fs.accessSync(target.executable, fs.constants.X_OK);
    state.available = writableDirectory(path.dirname(target.file));
  } catch { /* Unavailable paths keep the control disabled without disrupting monitoring. */ }
  return state;
}
function setStartup(enabled, options) {
  if (typeof enabled !== 'boolean' || !startupState(options).available) return false;
  let temporary;
  try {
    const target = locations(options);
    if (!enabled) { fs.rmSync(target.file, { force: true }); return true; }
    fs.mkdirSync(path.dirname(target.file), { recursive: true });
    temporary = `${target.file}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, desktopEntry(target.executable), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, target.file);
    temporary = null;
    return true;
  } catch { return false; }
  finally { if (temporary) { try { fs.rmSync(temporary, { force: true }); } catch {} } }
}
module.exports = { startupState, setStartup };
