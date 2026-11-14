'use strict';
const fs = require('node:fs');
const path = require('node:path');

const windows = [['short', 'five_hour', 5 * 3600], ['weekly', 'seven_day', 7 * 86400]];
const snapshotFile = 'claude-quota.json';

function quotaMetrics(limits, now) {
  return windows.flatMap(([id, name, durationSeconds]) => {
    const { used_percentage: used, resets_at: reset } = limits?.[name] ?? {};
    if (!Number.isFinite(used) || used < 0 || used > 100) return [];
    const resetsAt = Number.isFinite(reset) && reset > 0 && reset < 8640000000000 ? reset * 1000 : null;
    if (resetsAt !== null && resetsAt <= now) return [];
    return [{ id, type: 'percentage', semantics: 'remaining', value: Math.round((100 - used) * 10) / 10, resetsAt, durationSeconds }];
  });
}

async function run() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  const rateLimits = JSON.parse(input)?.rate_limits;
  const updatedAt = Date.now();
  const metrics = quotaMetrics(rateLimits, updatedAt);
  if (!metrics.length) return;

  // An empty status line from another session must not replace a valid sample.
  const limits = {};
  for (const [id, name] of windows) {
    if (metrics.some(metric => metric.id === id)) {
      const { used_percentage, resets_at } = rateLimits[name];
      limits[name] = { used_percentage, resets_at: Number.isFinite(resets_at) ? resets_at : undefined };
    }
  }
  const target = path.join(__dirname, snapshotFile);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ updatedAt, limits }), { mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  process.stdout.write(metrics.map(metric => `${metric.id === 'short' ? '5h' : '7d'}: ${metric.value}% left`).join(' | ') + '\n');
}

module.exports = { quotaMetrics, snapshotFile, run };
