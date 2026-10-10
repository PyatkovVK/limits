'use strict';
const $ = id => document.getElementById(id);
let state;
function countdown(unix) {
  if (!unix) return '—';
  const seconds = Math.ceil(unix - Date.now() / 1000);
  if (seconds <= 0) return 'проверяем';
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds / 3600) % 24, minutes = Math.floor(seconds / 60) % 60;
  return days ? `${days}д ${hours}ч` : hours ? `${hours}ч ${minutes}мин` : `${minutes}мин ${seconds % 60}с`;
}
function render(next) {
  state = next;
  const bucket = next.buckets.find(b => b.id === next.selectedId) || next.buckets.find(b => b.id === 'codex') || next.buckets[0];
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  document.body.classList.toggle('stale', Boolean(stale));
  document.body.classList.toggle('low', !stale && [bucket?.short.remaining, bucket?.weekly.remaining].some(n => typeof n === 'number' && n <= 10));
  $('widget-account').textContent = next.account?.email || 'Войти через ChatGPT';
  $('widget-account').title = next.account?.email || 'Нажмите на полосы и войдите через ChatGPT';
  $('widget-plan').textContent = `Codex${next.account?.planType ? ` · ${next.account.planType}` : ''}`;
  $('widget-status').textContent = next.demo ? 'ДЕМО' : stale ? 'Нет свежих данных' : 'Обновление каждые 30 с';
  for (const kind of ['short', 'weekly']) {
    const quota = bucket?.[kind];
    $(`${kind}-value`).textContent = quota?.remaining == null ? '—' : String(quota.remaining);
    $(`${kind}-bar`).value = quota?.remaining ?? 0;
    $(`${kind}-reset`).textContent = `До сброса: ${countdown(quota?.resetsAt)}`;
  }
}
$('details').addEventListener('click', () => window.limits.open());
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
setInterval(() => { if (state) render(state); }, 1000);
