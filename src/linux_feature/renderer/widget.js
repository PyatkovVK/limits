'use strict';
const $ = id => document.getElementById(id);
let resetAt = null, weeklyResetAt = null, language = 'ru';
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
function renderCountdown() {
  window.limitsCountdown.render($('short-reset'), resetAt, language);
  window.limitsCountdown.render($('weekly-reset'), weeklyResetAt, language, Date.now(), { compactDays: true });
}
function render(next) {
  language = next.language || 'ru';
  document.body.dataset.platform = 'linux';
  const translate = (lang, key) => window.limitsI18n.t(lang, key, 'linux');
  const t = key => translate(language, key);
  window.limitsI18n.apply(language, document, translate);
  const bucket = next.buckets.find(b => b.id === next.selectedId) || next.buckets.find(b => b.id === 'codex') || next.buckets[0];
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  document.body.classList.toggle('stale', Boolean(stale));
  document.body.classList.toggle('reduced-motion', Boolean(next.reducedMotion));
  document.body.classList.toggle('low', !stale && [bucket?.short?.remaining, bucket?.weekly?.remaining].some(n => typeof n === 'number' && n <= 10));
  setText($('widget-account'), next.displayName || next.account?.email || t('connectAccount'));
  $('widget-account').title = next.account?.email || t('login');
  setText($('widget-plan'), next.demo ? t('demo') : `Codex${next.account?.planType ? ` · ${next.account.planType}` : ''}`);
  for (const kind of ['short', 'weekly']) {
    const quota = bucket?.[kind];
    setText($(`${kind}-value`), quota?.remaining == null ? '—' : String(quota.remaining));
    if ($(`${kind}-bar`).value !== (quota?.remaining ?? 0)) $(`${kind}-bar`).value = quota?.remaining ?? 0;
    $(`${kind}-bar`).closest('.quota').classList.toggle('limit-67', quota?.remaining === 67);
  }
  resetAt = bucket?.short?.resetsAt;
  weeklyResetAt = bucket?.weekly?.resetsAt;
  renderCountdown();
}
document.getElementById('details').addEventListener('click', () => void window.limits.toggleDetails());
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
setInterval(renderCountdown, 1000);
