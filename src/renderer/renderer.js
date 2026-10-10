'use strict';
const $ = id => document.getElementById(id);
let state = null;
let actionError = null;

function render(next) {
  state = next;
  const language = next.language || 'ru';
  const t = key => window.limitsI18n.t(language, key);
  window.limitsI18n.apply(language, document);
  $('language').value = language;
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
  document.body.classList.toggle('stale', Boolean(stale));
  $('demo').hidden = !next.demo;
  $('connection').textContent = t(next.demo ? 'demo' : next.status === 'signing-in' ? 'signingIn' : next.status === 'signed-out' ? 'signedOut' : next.status === 'connecting' ? 'connecting' : stale ? 'stale' : 'online');
  $('connection').classList.toggle('stale', Boolean(stale));
  $('account').textContent = next.account?.email || t(next.status === 'signed-out' ? 'connectAccount' : 'account');
  $('plan').hidden = !next.account?.planType;
  $('plan').textContent = next.account?.planType || '';
  const messageKey = actionError || next.error || next.widgetError || (next.status === 'unsupported' ? 'unsupported' : next.status === 'ready' && !bucket ? 'noLimits' : stale && next.updatedAt ? 'cached' : null);
  const message = messageKey ? t(messageKey) : null;
  $('error').hidden = !message;
  $('error').textContent = message || '';
  $('bucket-row').hidden = next.buckets.length < 2;
  const signature = JSON.stringify(next.buckets.map(item => [item.id, item.name]));
  if ($('bucket').dataset.signature !== signature) {
    $('bucket').replaceChildren(...next.buckets.map(item => {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; return option;
    }));
    $('bucket').dataset.signature = signature;
  }
  if (bucket) $('bucket').value = bucket.id;
  for (const kind of ['short', 'weekly']) {
    const value = bucket?.[kind];
    const remaining = value?.remaining ?? null;
    $(`${kind}-value`).textContent = remaining === null ? '—' : String(remaining);
    $(`${kind}-bar`).value = remaining ?? 0;
    const card = $(`${kind}-bar`).closest('.quota-card');
    card.classList.toggle('low', remaining !== null && remaining <= 10);
    card.classList.toggle('caution', remaining !== null && remaining > 10 && remaining <= 25);
  }
  $('other').hidden = !bucket?.other?.length;
  $('other').textContent = bucket?.other?.map(item => `${item.duration ?? '?'} ${t('minutes')}: ${item.remaining === null ? t('noData') : `${item.remaining}%`}`).join(' · ') || '';
  $('refresh').disabled = next.refreshing || next.demo;
  $('login').disabled = next.demo || next.status === 'signing-in' || next.refreshing;
  $('login').textContent = t(next.status === 'signing-in' ? 'finishLogin' : next.account ? 'switchAccount' : 'login');
  $('updated').textContent = next.updatedAt ? `${t('updated')} ${new Date(next.updatedAt).toLocaleTimeString(language === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : t('waiting');
}

$('hide').addEventListener('click', () => window.limits.hide());
$('refresh').addEventListener('click', async () => { actionError = null; render(await window.limits.refresh()); });
$('login').addEventListener('click', async () => {
  actionError = null; $('login').disabled = true;
  const result = await window.limits.login();
  actionError = result.error || null;
  render(await window.limits.get());
});
$('bucket').addEventListener('change', () => window.limits.select($('bucket').value));
$('language').addEventListener('change', async () => { render(await window.limits.language($('language').value)); });
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
