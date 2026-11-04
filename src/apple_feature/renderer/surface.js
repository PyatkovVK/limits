'use strict';
(function (root) {
  function surfacePath(width, height, neckWidth, capHeight, radius = 24) {
    if (![width, height, neckWidth, capHeight, radius].every(Number.isFinite) || width <= 0 || height <= 0) return '';
    const shoulder = (width - Math.min(width, Math.max(0, neckWidth))) / 2;
    const cap = Math.min(height, Math.max(0, capHeight));
    const join = Math.min(12, shoulder / 2, cap);
    const upper = Math.min(radius, shoulder - join, (height - cap) / 2);
    const lower = Math.min(radius, width / 2, shoulder ? height - cap - upper : height / 2);
    const n = value => Math.round(value * 1000) / 1000;
    if (shoulder < 0.01) return `M 0 0 H ${n(width)} V ${n(height - lower)} Q ${n(width)} ${n(height)} ${n(width - lower)} ${n(height)} H ${n(lower)} Q 0 ${n(height)} 0 ${n(height - lower)} Z`;
    const left = shoulder, right = width - shoulder;
    return `M ${n(left)} 0 H ${n(right)} V ${n(cap - join)} Q ${n(right)} ${n(cap)} ${n(right + join)} ${n(cap)} H ${n(width - upper)} Q ${n(width)} ${n(cap)} ${n(width)} ${n(cap + upper)} V ${n(height - lower)} Q ${n(width)} ${n(height)} ${n(width - lower)} ${n(height)} H ${n(lower)} Q 0 ${n(height)} 0 ${n(height - lower)} V ${n(cap + upper)} Q 0 ${n(cap)} ${n(upper)} ${n(cap)} H ${n(left - join)} Q ${n(left)} ${n(cap)} ${n(left)} ${n(cap - join)} Z`;
  }

  function observeSurface(shell, body) {
    function update() {
      const bounds = shell.getBoundingClientRect();
      const style = getComputedStyle(body);
      const path = surfacePath(bounds.width, bounds.height, parseFloat(style.getPropertyValue('--menu-bar-width')), parseFloat(style.getPropertyValue('--cap-height')), parseFloat(getComputedStyle(shell).borderBottomLeftRadius));
      if (path) shell.style.clipPath = `path("${path}")`;
    }
    // Track the actual animated size, rather than jumping to the final contour.
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    return update;
  }

  const api = { surfacePath, observeSurface };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsAppleSurface = api;
})(globalThis);
