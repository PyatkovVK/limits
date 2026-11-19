'use strict';
(function (root) {
  const rowsByContainer = new WeakMap();
  const statesByContainer = new WeakMap();
  function render(container, state, { compact = false, profile = false, primaryOnly = false } = {}) {
    statesByContainer.set(container, state);
    const view = root.limitsMetrics.view(state);
    const ordered = primaryOnly ? [view.primary].filter(Boolean)
      : compact ? [view.primary, ...view.metrics.filter(metric => metric.id !== view.primary?.id)].filter(Boolean).slice(0, 2) : view.metrics;
    let rows = rowsByContainer.get(container);
    if (!rows) { rows = new Map(); rowsByContainer.set(container, rows); }
    for (const [id, row] of rows) if (!ordered.some(metric => metric.id === id)) { row.node.remove(); rows.delete(id); }
    for (const metric of ordered) {
      let row = rows.get(metric.id);
      if (!row) {
        const node = document.createElement('div'); node.className = profile ? 'profile-quota' : compact ? 'metric-compact-row' : 'quota-card metric-card';
        node.dataset.metricId = metric.id;
        const heading = document.createElement('span'); heading.className = 'metric-label';
        const label = document.createElement('span');
        const reset = document.createElement('time'); reset.className = 'metric-reset'; heading.append(label, reset);
        const progress = document.createElement('progress');
        const value = document.createElement('span'); value.className = 'metric-value';
        node.append(heading, progress, value); container.append(node);
        row = { node, label, reset, progress, value }; rows.set(metric.id, row);
      }
      row.metric = metric;
      row.label.textContent = compact || profile ? metric.compactLabel : metric.label;
      row.value.textContent = metric.formatted;
      row.progress.setAttribute('aria-label', metric.label);
      const total = metric.type === 'percentage' ? 100 : metric.total;
      row.progress.hidden = !total || metric.value === null || metric.value < 0;
      row.progress.max = total || 100; row.progress.value = metric.value ?? 0;
      row.reset.hidden = metric.resetsAt === null;
      row.node.classList.toggle('limit-67', metric.type === 'percentage' && metric.value === 67 && metric.semantics === 'remaining');
      row.node.classList.toggle('low', metric.type === 'percentage' && metric.value !== null && metric.value <= 10 && metric.semantics === 'remaining');
      container.append(row.node);
    }
    if (compact && !view.primary) {
      for (const row of rows.values()) row.node.hidden = true;
      container.setAttribute('aria-label', '—');
      let empty = container.querySelector('.metric-empty');
      if (!empty) { empty = document.createElement('span'); empty.className = 'metric-empty'; container.append(empty); }
      empty.textContent = '—'; empty.hidden = false;
    } else {
      for (const row of rows.values()) row.node.hidden = false;
      const empty = container.querySelector('.metric-empty'); if (empty) empty.hidden = true;
      container.removeAttribute('aria-label');
    }
    countdowns(container, state);
    return view;
  }
  function countdowns(container, state) {
    container = container.querySelector('.metric-compact') || container;
    state = state || statesByContainer.get(container) || {};
    const timer = root.limitsPlatform?.resetClock || root.limitsCountdown;
    for (const row of rowsByContainer.get(container)?.values() || []) {
      if (row.metric.resetsAt === null) continue;
      if (timer?.renderWidget && container.classList.contains('metric-compact')) {
        timer.renderWidget(row.reset, row.metric.resetsAt / 1000, state.language || 'ru', state.preferences?.widgetResetDisplay || 'clock', row.metric.slot === 'weekly');
      } else timer?.render(row.reset, row.metric.resetsAt / 1000, state.language || 'ru');
    }
  }
  function compact(container, state) {
    const generic = Boolean(state.displaySchema && state.displaySchema.layout !== 'quota-windows');
    let target = container.querySelector('.metric-compact');
    for (const child of container.children) if (child !== target) child.hidden = generic;
    if (generic) {
      if (!target) { target = document.createElement('div'); target.className = 'metric-compact'; container.append(target); }
      target.hidden = false; render(target, state, { compact: true });
    } else if (target) target.hidden = true;
    return generic;
  }
  root.limitsMetricElements = { render, countdowns, compact };
})(globalThis);
