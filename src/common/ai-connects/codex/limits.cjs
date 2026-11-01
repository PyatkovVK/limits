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
  return buckets.sort((a, b) => Number(b.id === 'codex') - Number(a.id === 'codex')).map(bucket => {
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


function groupsFromBuckets(buckets) {
  return buckets.map(bucket => ({ id: bucket.id, name: bucket.name, plan: bucket.plan,
    metrics: [['short', bucket.short], ['weekly', bucket.weekly], ...(bucket.other || []).map((value, index) => ['other-' + index, value])].map(([id, value]) => ({
      id, type: 'percentage', semantics: 'remaining', value: value?.remaining ?? null,
      resetsAt: value?.resetsAt == null ? null : value.resetsAt * 1000,
      durationSeconds: value?.duration == null ? null : value.duration * 60
    })) }));
}
function displaySchema(state) {
  return { layout: 'quota-windows', primaryMetricId: 'short', groups: (state.groups || []).map(group => ({ id: group.id,
    metrics: group.metrics.map(metric => ({ id: metric.id, slot: ['short', 'weekly'].includes(metric.id) ? metric.id : null,
      label: metric.id === 'short' ? { ru: '5 часов', en: '5 hours' } : metric.id === 'weekly' ? { ru: 'Неделя', en: 'Weekly' } : { ru: (metric.durationSeconds / 60 || '?') + ' мин', en: (metric.durationSeconds / 60 || '?') + ' min' },
      compactLabel: metric.id === 'short' ? { ru: '5 ч', en: '5h' } : metric.id === 'weekly' ? { ru: '7д', en: '7d' } : null
    })) })) };
}
module.exports = { normalizeLimits, windowView, groupsFromBuckets, displaySchema };
