'use strict';
const { contractError } = require('../contracts.cjs');

function counter(value) {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function counterRatio(detail) {
  const limit = counter(detail?.limit);
  if (!limit) return null;
  const used = counter(detail.used);
  if (used !== null) return Math.min(used / limit, 1);
  const remaining = counter(detail.remaining);
  return remaining !== null && remaining <= limit ? 1 - remaining / limit : null;
}

function quota(id, durationSeconds, counters, usage) {
  // The provider can return a zero ratio alongside nonzero usage counters.
  const used = counterRatio(counters) ?? usage?.used_ratio;
  if (!Number.isFinite(used) || used < 0 || used > 1) return null;
  const resetTime = counters?.resetTime ?? usage?.reset_time;
  const resetsAt = typeof resetTime === 'string' ? Date.parse(resetTime) : NaN;
  return { id, type: 'percentage', semantics: 'remaining', value: Math.round((1 - used) * 1000) / 10,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt : null, durationSeconds };
}

function normalizeQuota(raw) {
  const short = Array.isArray(raw?.limits) ? raw.limits.find(item =>
    item?.window?.timeUnit === 'TIME_UNIT_MINUTE' && counter(item.window.duration) === 300
  )?.detail : null;
  const metrics = [
    quota('short', 5 * 3600, short, raw?.usages?.limit_5h),
    quota('weekly', 7 * 86400, raw?.usage, raw?.usages?.limit_7d)
  ].filter(Boolean);
  if (!metrics.length) throw contractError('kimiQuotaRefreshFailed');
  return { groups: [{ id: 'kimi', name: 'Kimi Code', metrics }] };
}

module.exports = { normalizeQuota };
