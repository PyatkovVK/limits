'use strict';
const { spawn: spawnProcess } = require('node:child_process');
const { createInterface } = require('node:readline');
const { browserEnvironment } = require('./browser.cjs');

function screenSaverName(desktop = '') {
  if (/cinnamon/i.test(desktop)) return 'org.cinnamon.ScreenSaver';
  if (/mate/i.test(desktop)) return 'org.mate.ScreenSaver';
  if (/xfce/i.test(desktop)) return 'org.xfce.ScreenSaver';
  if (/gnome|unity/i.test(desktop)) return 'org.gnome.ScreenSaver';
  return 'org.freedesktop.ScreenSaver';
}

function watchSession({ powerMonitor, refresh, spawn = spawnProcess, env = process.env }) {
  let stopped = false;
  let idle = false;
  let active = null;
  const recover = () => { if (!stopped) { idle = false; refresh(); } };
  powerMonitor.on('resume', recover);
  // Electron's unlock-screen event is only supported on macOS and Windows.
  // Observe the desktop's session-bus signal without opening or changing it.
  let child, lines;
  try {
    const name = screenSaverName(env.XDG_CURRENT_DESKTOP || env.DESKTOP_SESSION);
    child = spawn('gdbus', ['monitor', '--session', '--dest', name], { stdio: ['ignore', 'pipe', 'pipe'], env: browserEnvironment(env) });
    child.stderr.resume();
    lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      const match = /: org\.(?:freedesktop|gnome|cinnamon|mate|xfce)\.ScreenSaver\.ActiveChanged \((true|false),?\)/.exec(line);
      if (!match) return;
      const next = match[1] === 'true';
      if (!next && active !== false) recover();
      active = next;
    });
    child.on('error', () => lines.close());
  } catch { /* Idle polling remains available if the desktop monitor is unavailable. */ }
  // Also cover desktops without the signal or gdbus, and return from long idle.
  const timer = setInterval(() => {
    let seconds;
    try { seconds = powerMonitor.getSystemIdleTime(); } catch { return; }
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const returning = idle && seconds < 60;
    idle = seconds >= 60;
    if (returning) recover();
  }, 5000);
  timer.unref();
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    powerMonitor.removeListener('resume', recover);
    lines?.close();
    child?.kill();
  };
}

module.exports = { watchSession, screenSaverName };
