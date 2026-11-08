'use strict';

function displaySchema(state) {
  return { layout: 'quota-windows', primaryMetricId: 'short', groups: (state.groups || []).map(group => ({ id: group.id,
    metrics: group.metrics.map(metric => ({ id: metric.id, slot: ['short', 'weekly'].includes(metric.id) ? metric.id : null,
      label: metric.id === 'short' ? { ru: '5 часов', en: '5 hours' } : metric.id === 'weekly' ? { ru: 'Неделя', en: 'Weekly' } : { ru: (metric.durationSeconds / 60 || '?') + ' мин', en: (metric.durationSeconds / 60 || '?') + ' min' },
      compactLabel: metric.id === 'short' ? { ru: '5 ч', en: '5h' } : metric.id === 'weekly' ? { ru: '7д', en: '7d' } : null
    })) })) };
}
module.exports = { displaySchema };
