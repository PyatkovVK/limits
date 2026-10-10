'use strict';

function windowView(raw, label) {
  if (!raw) return { label, remaining: null, used: null, resetsAt: null, duration: null };
  const used = typeof raw.usedPercent === 'number' && Number.isFinite(raw.usedPercent)
    ? Math.min(100, Math.max(0, raw.usedPercent)) : null;
  return {
    label, used, remaining: used === null ? null : Math.round((100 - used) * 10) / 10,
    resetsAt: typeof raw.resetsAt === 'number' && Number.isFinite(raw.resetsAt) && raw.resetsAt > 0 ? raw.resetsAt : null,
    duration: typeof raw.windowDurationMins === 'number' ? raw.windowDurationMins : null
  };
}

function normalizeLimits(response) {
  const byId = response?.rateLimitsByLimitId;
  const buckets = byId && Object.keys(byId).length ? Object.entries(byId).map(([id, bucket]) => ({ ...bucket, id }))
    : response?.rateLimits ? [{ ...response.rateLimits, id: response.rateLimits.limitId || 'codex' }] : [];
  return buckets.map(bucket => {
    const windows = [bucket.primary, bucket.secondary].filter(Boolean);
    return {
      id: bucket.id, name: bucket.limitName || (bucket.id === 'codex' ? 'Codex' : bucket.id),
      plan: bucket.planType || null,
      short: windowView(windows.find(w => w.windowDurationMins === 300), '5 часов'),
      weekly: windowView(windows.find(w => w.windowDurationMins === 10080), 'Неделя'),
      other: windows.filter(w => ![300, 10080].includes(w.windowDurationMins)).map(w => windowView(w, `${w.windowDurationMins ?? '?'} мин`))
    };
  });
}

function selectedBucket(state) {
  return state.buckets?.find(b => b.id === state.selectedId) || state.buckets?.find(b => b.id === 'codex') || state.buckets?.[0] || null;
}

function isStale(state, now = Date.now()) {
  return Boolean(state.error || !state.updatedAt || now - state.updatedAt > 90000);
}

module.exports = { normalizeLimits, selectedBucket, windowView, isStale };
