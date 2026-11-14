'use strict';
const fs = require('node:fs');
const path = require('node:path');

const label = 'dev.codexlimits.desktop.autostart';
const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const agentPath = app => path.join(app.getPath('home'), 'Library', 'LaunchAgents', `${label}.plist`);

// A user LaunchAgent also works with local, ad hoc signed builds. Native
// SMAppService registration may silently fail without Apple notarization.
function agentContents(executable) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${escape(executable)}</string><string>--hidden</string></array>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
</dict></plist>
`;
}

function enabled(app) {
  try { if (fs.readFileSync(agentPath(app), 'utf8') === agentContents(process.execPath)) return true; }
  catch { /* An absent or unreadable agent must not prevent the settings from opening. */ }
  return Boolean(app.getLoginItemSettings().openAtLogin);
}

function setEnabled(app, value) {
  const target = agentPath(app);
  if (value) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.new`;
    try {
      fs.writeFileSync(temporary, agentContents(process.execPath), { mode: 0o600 });
      fs.renameSync(temporary, target);
    } finally { fs.rmSync(temporary, { force: true }); }
  } else fs.rmSync(target, { force: true });
  // Remove an older native login item so the app is launched only once.
  const native = app.getLoginItemSettings();
  if (native.openAtLogin || native.status === 'requires-approval') app.setLoginItemSettings({ openAtLogin: false });
}

module.exports = { enabled, setEnabled };
