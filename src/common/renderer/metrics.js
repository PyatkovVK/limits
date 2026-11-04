'use strict';
(function (root) {
  const caption = (labels, language = 'ru') => labels?.[language] || labels?.en || labels?.ru || '';
  function format(metric, language = 'ru') {
    if (metric?.value == null || !Number.isFinite(metric.value)) return '—';
    const locale = language === 'ru' ? 'ru-RU' : 'en-GB';
    if (metric.type === 'money') return new Intl.NumberFormat(locale, { style: 'currency', currency: metric.currency, currencyDisplay: 'code' }).format(metric.value);
    const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(metric.value);
    return metric.type === 'percentage' ? `${value}%` : `${value} ${metric.unit || ''}`.trim();
  }
  function view(state, language = state.language || 'ru') {
    const group = state.groups?.find(item => item.id === state.selectedId) || state.groups?.[0];
    const schema = state.displaySchema?.groups?.find(item => item.id === group?.id);
    const metrics = (schema?.metrics || []).map(descriptor => {
      const metric = group?.metrics?.find(item => item.id === descriptor.id);
      if (!metric) return null;
      return { ...metric, label: caption(descriptor.label, language), compactLabel: caption(descriptor.compactLabel, language) || caption(descriptor.label, language),
        slot: descriptor.slot, formatted: format(metric, language) };
    }).filter(Boolean);
    return { group, metrics, primary: metrics.find(item => item.id === state.displaySchema?.primaryMetricId) || null };
  }
  function legacyBuckets(state) {
    if (state.displaySchema?.layout !== 'quota-windows') return [];
    return (state.groups || []).map(group => {
      const schema = state.displaySchema.groups.find(item => item.id === group.id);
      const bucket = { id: group.id, name: group.name, plan: group.plan, short: null, weekly: null, other: [] };
      for (const descriptor of schema?.metrics || []) {
        const metric = group.metrics.find(item => item.id === descriptor.id);
        if (metric?.type !== 'percentage') continue;
        const remaining = metric.value === null ? null : metric.semantics === 'used' ? 100 - metric.value : metric.value;
        const value = { label: caption(descriptor.label), remaining, used: remaining === null ? null : 100 - remaining,
          resetsAt: metric.resetsAt === null ? null : metric.resetsAt / 1000, duration: metric.durationSeconds === null ? null : metric.durationSeconds / 60 };
        if (descriptor.slot) bucket[descriptor.slot] = value; else bucket.other.push(value);
      }
      return bucket;
    });
  }
  const api = { caption, format, view, legacyBuckets };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsMetrics = api;
})(globalThis);
