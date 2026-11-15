'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { percentage } = require('../../common/tray/tray-image.cjs');
const { view } = require('../../common/renderer/metrics.js');
const { panel } = require('../settings/general/styles.js');

const activationFlag = '--linux-panel-activate';
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const escapeMarkup = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function genmonAvailable(env = process.env) {
  const desktop = [env.XDG_CURRENT_DESKTOP, env.DESKTOP_SESSION].join(':');
  if (!/(?:^|:)xfce(?:$|:)/i.test(desktop)) return false;
  const directories = (env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':');
  return directories.some(dir => path.isAbsolute(dir) && fs.existsSync(path.join(dir, 'xfce4/panel/plugins/genmon.desktop')));
}

function activationCommand({ executable, appPath, packaged, appImage, demo }) {
  const args = [appImage || executable];
  if (!packaged) args.push(appPath);
  if (demo) args.push('--demo');
  args.push(activationFlag);
  return args.map(quote).join(' ');
}

function meter(value, color) {
  const filled = Math.round((value ?? 0) / 20);
  return '<span foreground="' + color + '">' +
    (value === null ? '┄┄┄┄┄' : '▪'.repeat(filled) + '▫'.repeat(5 - filled)) + '</span>';
}

function genmonOutput({ style, bucket, metricsState, stale, dark, language }, activate) {
  if (!panel.includes(style)) return '\n';
  const ru = language === 'ru';
  const short = percentage(bucket?.short?.remaining);
  const week = percentage(bucket?.weekly?.remaining);
  const format = value => value === null ? '—' : value + '%';
  const first = (ru ? '5ч' : '5h') + ' <b>' + format(short) + '</b>';
  const second = (ru ? '7д' : '7d') + ' <b>' + format(week) + '</b>';
  let text = first + '  │  ' + second;
  if (metricsState?.displaySchema?.layout === 'metrics') {
    const primary = view(metricsState, language).primary;
    text = escapeMarkup(primary?.label || 'Limits') + ' <b>' + escapeMarkup(primary?.formatted || '—') + '</b>';
  } else if (style === 'shelf') {
    const shortColor = stale ? '#888888' : dark ? '#73e3c8' : '#087362';
    const weekColor = stale ? '#888888' : dark ? '#cbb4ff' : '#6948a2';
    const align = value => format(value).padStart(4).replaceAll(' ', '\u00a0');
    const gap = '\u00a0'.repeat(4);
    const values = (ru ? '5ч' : '5h') + ' <b>' + align(short) + '</b>' + gap +
      (ru ? '7д' : '7d') + ' <b>' + align(week) + '</b>';
    text = '<span font_family="monospace" size="small">' + values + '\n' +
      meter(short, shortColor) + '\u00a0'.repeat(2) + gap + meter(week, weekColor) + '</span>';
  }
  const tooltip = ru ? 'Limits · Открыть подробности' : 'Limits · Open details';
  return '<txt>' + text + '</txt><tool>' + tooltip + '</tool><txtclick>' + activate + '</txtclick>\n';
}

function createGenmonPresentation({ root, activate }) {
  const file = path.join(root, 'xfce-panel.xml');
  const temporary = file + '.tmp';
  let previous;
  function write(output) {
    if (output === previous) return;
    try {
      if (previous === undefined) fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(temporary, output, { mode: 0o600 });
      fs.renameSync(temporary, file);
      previous = output;
    } catch (error) {
      console.error('XFCE panel:', error.message);
    }
  }
  return {
    command: 'cat ' + quote(file),
    update: state => write(genmonOutput(state, activate)),
    clear: () => write('\n'),
  };
}

module.exports = { activationFlag, activationCommand, genmonAvailable, createGenmonPresentation, genmonOutput };
