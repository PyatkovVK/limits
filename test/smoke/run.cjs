'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const platforms = {
  win: { host: 'win32', name: 'Windows', subscriptions: 'windows' },
  mac: { host: 'darwin', name: 'macOS', subscriptions: 'apple' },
  linux: { host: 'linux', name: 'Linux', subscriptions: 'linux' },
};
const target = process.argv[2];
const platform = Object.hasOwn(platforms, target) ? platforms[target] : null;
if (!platform) {
  console.error('Choose a smoke suite: win, mac, or linux.');
  process.exit(1);
}
if (process.platform !== platform.host) {
  console.error(`Run npm run test:${target}:smoke on ${platform.name} with a desktop session.`);
  process.exit(1);
}

require('../../scripts/prepare/prepare-app.cjs');
const electron = require('electron');
const root = path.resolve(__dirname, '../..');
const scenarios = [['App in demo mode', electron, '.', '--demo', '--smoke-test']];
if (target === 'win') scenarios.push(['First-run onboarding', process.execPath, 'scripts/smoke/smoke-onboarding.cjs']);
scenarios.push(
  ['Subscriptions', electron, `test/smoke/${platform.subscriptions}-subscriptions.cjs`],
  ['Account management', electron, 'scripts/smoke/smoke-accounts.cjs'],
  ['Provider UI', electron, 'scripts/smoke/smoke-ai-connects.cjs'],
  ['DeepSeek and Z.ai', electron, 'scripts/smoke/smoke-deepseek.cjs'],
  ['Updates', electron, 'scripts/smoke/smoke-updates.cjs'],
  ['Reset notifications', electron, 'scripts/smoke/smoke-resets.cjs'],
);

if (target === 'win') {
  scenarios.push(
    ['Panel follows widget', electron, 'test/smoke/windows-panel-follow.cjs'],
    ['Native widget startup and input', electron, 'test/smoke/windows-widget-startup.cjs'],
  );
} else {
  scenarios.push(['Panel position', electron, 'scripts/smoke/smoke-panel-position.cjs']);
}
if (target === 'mac') {
  scenarios.push(['Notch layouts', electron, 'test/smoke/apple-notch.cjs', '--layout-fixture']);
}

const failures = [];
for (const [name, executable, ...args] of scenarios) {
  console.log(`\n${platform.name} smoke: ${name}`);
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', timeout: 90_000 });
  if (result.status === 0) continue;
  failures.push(name);
  console.error(`${name} failed (${result.error?.message ?? result.signal ?? `exit ${result.status}`}).`);
}

console.log(`\n${platform.name} smoke: ${scenarios.length - failures.length}/${scenarios.length} passed.`);
if (failures.length) {
  console.error(`Failed scenarios: ${failures.join(', ')}.`);
  process.exitCode = 1;
}
