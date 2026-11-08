'use strict';
(function (root) {
  // Reserve room for the overflow control before filling the two safe wings.
  function fitIndicators(widths, sideWidth, moreWidth = 30, gap = 8) {
    function fill(reserve) {
      const sides = [[], []], used = [0, 0], hidden = [];
      const capacity = [sideWidth, Math.max(0, sideWidth - reserve)];
      widths.forEach((width, index) => {
        const first = index % 2;
        const side = [first, 1 - first].find(side => used[side] + (sides[side].length ? gap : 0) + width <= capacity[side]);
        if (side === undefined) hidden.push(index);
        else { used[side] += (sides[side].length ? gap : 0) + width; sides[side].push(index); }
      });
      return { left: sides[0], right: sides[1], hidden };
    }
    const result = fill(0);
    return result.hidden.length ? fill(moreWidth + gap) : result;
  }
  function create() {
    const header = document.createElement('div'); header.className = 'apple-island-meters';
    const left = document.createElement('div'); left.className = 'apple-island-wing';
    const right = document.createElement('div'); right.className = 'apple-island-wing';
    const more = document.createElement('button'); more.className = 'apple-island-more'; more.type = 'button';
    more.onclick = () => window.limits.open();
    header.append(left, right);
    const nodes = new Map(); let signature;
    return { header, render(next, layout) {
      if (layout.mode !== 'island') return;
      const view = root.limitsMetrics.view(next);
      let metrics = [view.primary, ...view.metrics.filter(metric => metric.id !== view.primary?.id)].filter(Boolean);
      if (!metrics.length && (!next.displaySchema || next.displaySchema.layout === 'quota-windows')) {
        const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets[0];
        metrics = ['short', 'weekly'].map(id => ({ id, slot: id, type: 'percentage', semantics: 'remaining', value: bucket?.[id]?.remaining ?? null,
          formatted: bucket?.[id]?.remaining == null ? '—' : `${bucket[id].remaining}%` }));
      }
      if (!metrics.length) metrics = [{ id: 'unknown', compactLabel: 'Limits', type: 'count', value: null, formatted: '—' }];
      const shellWidth = layout.phase === 'closed' ? layout.closedWidth : layout.phase === 'peek' ? layout.peekWidth : layout.fullWidth;
      const width = Math.min(shellWidth, layout.metersWidth);
      const nextSignature = JSON.stringify([metrics, next.stale, next.language, width, layout.notchWidth, layout.phase, layout.indicatorMode]);
      if (nextSignature === signature) return;
      signature = nextSignature;
      header.hidden = layout.indicatorMode === 'hidden';
      for (const [id, node] of nodes) if (!metrics.some(metric => metric.id === id)) { node.remove(); nodes.delete(id); }
      const ordered = metrics.map((metric, index) => {
        let node = nodes.get(metric.id);
        if (!node) {
          node = document.createElement('button'); node.type = 'button'; node.className = 'apple-island-meter';
          const label = document.createElement('span'); label.className = 'apple-island-label';
          const value = document.createElement('span'); value.className = 'apple-island-value';
          const dot = document.createElement('span'); dot.className = 'apple-island-dot'; dot.setAttribute('aria-hidden', 'true');
          node.append(label, value, dot); node.onclick = () => window.limits.open(); nodes.set(metric.id, node);
        }
        const short = metric.slot === 'short';
        const label = short ? '5h' : metric.slot === 'weekly' ? '7d' : metric.compactLabel || metric.label || metric.id;
        const caption = node.querySelector('.apple-island-label'), value = node.querySelector('.apple-island-value');
        const dot = node.querySelector('.apple-island-dot');
        caption.textContent = label; value.textContent = metric.formatted;
        const order = short ? [dot, value, caption] : [caption, value, dot];
        if (node.firstElementChild !== order[0]) node.append(...order);
        node.title = `${metric.label || label}: ${metric.formatted}`; node.setAttribute('aria-label', node.title);
        node.classList.toggle('quota-period', short || metric.slot === 'weekly');
        node.classList.toggle('weekly', index % 2 === 1);
        node.classList.toggle('low', metric.type === 'percentage' && metric.semantics === 'remaining' && metric.value !== null && metric.value <= 10);
        node.classList.toggle('unknown', next.stale || metric.value == null);
        node.hidden = false; left.append(node);
        return node;
      });
      const compact = layout.indicatorMode === 'values';
      const wingWidth = (width - layout.notchWidth) / 2;
      const compactInset = Math.min(10, Math.max(4, wingWidth - 24));
      const sideWidth = Math.max(0, wingWidth - (compact ? compactInset : 24));
      header.style.setProperty('--island-compact-inset', `${compactInset}px`);
      header.style.setProperty('--island-wing-width', `${sideWidth}px`);
      header.style.removeProperty('--island-value-size');
      header.classList.toggle('stacked', compact && sideWidth < 38);
      if (header.hidden) {
        for (const node of ordered) node.hidden = true;
        more.hidden = true;
        return;
      }
      more.hidden = false; more.textContent = `+${metrics.length}`; right.append(more);
      const measure = () => ordered.map(node => node.getBoundingClientRect().width);
      let widths = measure();
      if (compact && metrics.length <= 2 && metrics.every(metric => metric.type === 'percentage')) {
        let fontSize = parseFloat(getComputedStyle(ordered[0]).fontSize);
        // The system font's proportions can change at small sizes.
        for (let attempt = 0; attempt < 3; attempt++) {
          const widest = Math.max(...widths);
          if (widest <= sideWidth) break;
          fontSize *= (sideWidth - 0.5) / widest;
          header.style.setProperty('--island-value-size', `${fontSize}px`);
          widths = measure();
        }
      }
      const plan = fitIndicators(widths, sideWidth, more.getBoundingClientRect().width);
      for (const index of plan.left) left.append(ordered[index]);
      for (const index of plan.right) right.append(ordered[index]);
      for (const index of plan.hidden) ordered[index].hidden = true;
      more.hidden = !plan.hidden.length; more.textContent = `+${plan.hidden.length}`;
      more.title = plan.hidden.map(index => ordered[index].title).join('\n');
      more.setAttribute('aria-label', `${root.limitsAppleI18n.t(next.language, 'islandMore')}: ${plan.hidden.length}`);
      right.append(more);
    } };
  }
  const api = { fitIndicators, create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsAppleIsland = api;
})(globalThis);
