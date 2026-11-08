'use strict';
const { contractError } = require('../contracts.cjs');

const windows = [
  { id: 'short', unit: 3, number: 5, durationSeconds: 5 * 3600 },
  { id: 'weekly', unit: 6, number: 1, durationSeconds: 7 * 86400 }
];
const plans = new Map([['lite', 'Lite'], ['pro', 'Pro'], ['max', 'Max']]);

function remainingPercent(limit) {
  if (!limit) return null;
  if (limit.type === 'CREDIT_LIMIT' && Number.isFinite(limit.remaining) && limit.remaining >= 0 &&
      Number.isFinite(limit.usage) && limit.usage > 0 && limit.remaining <= limit.usage) {
    return Math.round(limit.remaining / limit.usage * 1000) / 10;
  }
  if (!Number.isFinite(limit.percentage) || limit.percentage < 0 || limit.percentage > 100) return null;
  return Math.round((100 - limit.percentage) * 10) / 10;
}

function normalizeQuota(raw) {
  if (!Array.isArray(raw?.limits)) throw contractError('quotaRefreshFailed');
  const metrics = windows.map(({ id, unit, number, durationSeconds }) => {
    const matches = limit => limit?.unit === unit && limit.number === number;
    const limit = raw.limits.find(item => matches(item) && item.type === 'CREDIT_LIMIT')
      ?? raw.limits.find(item => matches(item) && item.type === 'TOKENS_LIMIT');
    const resetsAt = limit?.nextResetTime;
    return { id, type: 'percentage', semantics: 'remaining', value: remainingPercent(limit),
      resetsAt: Number.isFinite(resetsAt) && resetsAt > 0 ? resetsAt : null, durationSeconds };
  });
  if (metrics.every(metric => metric.value === null)) throw contractError('quotaRefreshFailed');
  return { groups: [{ id: 'zai', name: 'Z.ai', plan: plans.get(raw.level) ?? null, metrics }] };
}

module.exports = { normalizeQuota };
