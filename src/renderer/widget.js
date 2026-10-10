'use strict';
const $ = id => document.getElementById(id);
function render(next) {
  const language = next.language || 'ru';
  const t = key => window.limitsI18n.t(language, key);
  window.limitsI18n.apply(language, document);
  const bucket = next.buckets.find(b => b.id === next.selectedId) || next.buckets.find(b => b.id === 'codex') || next.buckets[0];
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  document.body.classList.toggle('stale', Boolean(stale));
  document.body.classList.toggle('low', !stale && [bucket?.short?.remaining, bucket?.weekly?.remaining].some(n => typeof n === 'number' && n <= 10));
  $('widget-account').textContent = next.account?.email || t('connectAccount');
  $('widget-account').title = next.account?.email || t('login');
  $('widget-plan').textContent = next.demo ? t('demo') : `Codex${next.account?.planType ? ` · ${next.account.planType}` : ''}`;
  for (const kind of ['short', 'weekly']) {
    const quota = bucket?.[kind];
    $(`${kind}-value`).textContent = quota?.remaining == null ? '—' : String(quota.remaining);
    $(`${kind}-bar`).value = quota?.remaining ?? 0;
  }
}
$('details').addEventListener('click', () => window.limits.open());
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
