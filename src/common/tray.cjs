'use strict';
const { percentage, icon } = require('../windows_feature/tray-icon.cjs');
const { icon: macIcon } = require('../apple_feature/tray-icon.cjs');
const { icon: linuxIcon } = require('../linux_feature/tray-icon.cjs');
const { t } = require('./renderer/i18n.js');
const { format } = require('./renderer/countdown.js');

// Stable GUIDs let Windows keep icon visibility preferences across mode switches.
const ids = { app: 'd46fa280-e375-4eaf-ae9e-e645c94ff7cb', short: 'b577427c-28cc-493a-8f24-a76e440ff62c', weekly: '1c682035-fb71-4ffd-99f1-a088946a6b35' };
function tooltip(kind, { bucket, account, displayName, language = 'ru', stale, demo }, now = Date.now()) {
  const quota = bucket?.[kind];
  const value = percentage(quota?.remaining);
  const lines = [`Limits · ${t(language, kind)}`, account?.email || t(language, 'connectAccount')];
  if (displayName && displayName !== account?.email) lines.splice(1, 0, displayName);
  if (account?.planType) lines.push(`${bucket?.name || 'Codex'} · ${account.planType}`);
  lines.push(value === null ? t(language, 'noData') : `${quota.remaining}%`);
  if (Number.isFinite(quota?.resetsAt) && quota.resetsAt > 0 && quota.resetsAt < 8640000000000) {
    const remaining = kind === 'short' ? format(quota.resetsAt, now) : new Date(quota.resetsAt * 1000).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    lines.push(`${t(language, kind === 'short' ? 'resetIn' : 'resetsAt')}: ${remaining}`);
  } else lines.push(t(language, 'resetUnknown'));
  if (stale) lines.push(t(language, 'stale'));
  if (demo) lines.push(t(language, 'demoNotice'));
  return lines.join('\n');
}
class TrayPresentation {
  constructor({ Tray, Menu, nativeImage, appIcon, onClick, platform = process.platform }) {
    Object.assign(this, { Tray, Menu, nativeImage, appIcon, onClick, platform });
    this.quotaIcon = platform === 'darwin' ? macIcon : platform === 'linux' ? linuxIcon : icon;
    this.mode = null;
    this.entries = [];
  }
  update({ mode, linuxTrayStyle = 'classic', bucket, stale, dark = true, account, displayName, language, demo, menu }) {
    if (this.mode !== mode) {
      const old = this.entries;
      this.entries = (mode === 'tray' ? ['short', 'weekly'] : ['app']).map(kind => {
        const image = kind === 'app' ? this.appIcon : this.quotaIcon(this.nativeImage, { kind, style: linuxTrayStyle, language, remaining: bucket?.[kind]?.remaining, resetsAt: bucket?.[kind]?.resetsAt, stale, dark });
        const tray = this.platform === 'linux' ? new this.Tray(image) : new this.Tray(image, ids[kind]);
        tray.on('click', () => this.onClick(tray, kind));
        const entry = { kind, tray, image };
        if (this.platform === 'darwin') tray.on('right-click', () => tray.popUpContextMenu(entry.contextMenu));
        return entry;
      });
      this.mode = mode;
      old.forEach(entry => entry.tray.destroy());
    }
    const menuSignature = JSON.stringify(menu);
    for (const entry of this.entries) {
      const { kind, tray } = entry;
      const signature = JSON.stringify([percentage(bucket?.[kind]?.remaining), stale, dark, this.platform === 'darwin' && kind === 'short' ? format(bucket?.short?.resetsAt) : null,
        this.platform === 'linux' ? [linuxTrayStyle, language] : null]);
      if (kind !== 'app' && signature !== entry.signature) {
        entry.image = this.quotaIcon(this.nativeImage, { kind, style: linuxTrayStyle, language, remaining: bucket?.[kind]?.remaining, resetsAt: bucket?.[kind]?.resetsAt, stale, dark });
        tray.setImage(entry.image);
        entry.signature = signature;
      }
      const title = kind === 'app' ? t(language, 'tooltip') : tooltip(kind, { bucket, stale, account, displayName, language, demo });
      if (title !== entry.tooltip) { tray.setToolTip(title); entry.tooltip = title; }
      if (menuSignature !== entry.menuSignature) {
        entry.contextMenu = this.Menu.buildFromTemplate(menu);
        // Attaching a native macOS menu intercepts activation of the status item.
        if (this.platform !== 'darwin') tray.setContextMenu(entry.contextMenu);
        entry.menuSignature = menuSignature;
      }
    }
  }
  bounds() { return this.platform === 'linux' ? null : this.entries[0]?.tray.getBounds(); }
  destroy() { this.entries.forEach(entry => entry.tray.destroy()); this.entries = []; this.mode = null; }
}
module.exports = { TrayPresentation, tooltip };
