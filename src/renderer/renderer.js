'use strict';
const $ = id => document.getElementById(id);
let state = null;
let actionError = null;

function countdown(unix) {
  if (!unix) return '—';
  const seconds = Math.ceil(unix - Date.now() / 1000);
  if (seconds <= 0) return 'Проверяем сброс…';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return days ? `${days} д ${hours} ч ${minutes} мин` : hours ? `${hours} ч ${minutes} мин` : `${minutes} мин ${seconds % 60} с`;
}

function render(next) {
  state = next;
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
  document.body.classList.toggle('stale', Boolean(stale));
  $('demo').hidden = !next.demo;
  $('connection').textContent = next.demo ? 'ДЕМО' : next.status === 'signing-in' ? 'Вход в браузере' : next.status === 'signed-out' ? 'Нужен вход' : next.status === 'connecting' ? 'Подключение' : stale ? 'Нет свежих данных' : 'В сети';
  $('connection').classList.toggle('stale', Boolean(stale));
  $('account').textContent = next.account?.email || (next.status === 'signed-out' ? 'Подключите аккаунт ChatGPT' : 'Аккаунт Codex');
  $('plan').hidden = !next.account?.planType;
  $('plan').textContent = next.account?.planType || '';
  const message = actionError || next.error || next.widgetError || (next.status === 'unsupported' ? 'Лимиты подписки доступны при входе через ChatGPT. Сейчас Codex использует другой способ авторизации.' : next.status === 'ready' && !bucket ? 'Сервис пока не вернул данные о лимитах.' : stale && next.updatedAt ? 'Показаны последние полученные данные. Ожидаем обновление.' : null);
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
    $(`${kind}-reset`).textContent = countdown(value?.resetsAt);
    $(`${kind}-reset`).title = value?.resetsAt ? `Сброс ${new Date(value.resetsAt * 1000).toLocaleString('ru-RU')}` : 'Время сброса пока неизвестно';
  }
  $('other').hidden = !bucket?.other?.length;
  $('other').textContent = bucket?.other?.map(item => `${item.label}: ${item.remaining === null ? 'нет данных' : `${item.remaining}% осталось`}`).join(' · ') || '';
  $('refresh').disabled = next.refreshing || next.demo;
  $('login').disabled = next.demo || next.status === 'signing-in' || next.refreshing;
  $('login').textContent = next.status === 'signing-in' ? 'Завершите вход в браузере' : next.account ? 'Сменить аккаунт ↗' : 'Войти через ChatGPT ↗';
  $('updated').textContent = next.updatedAt ? `Обновлено в ${new Date(next.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Ожидаем данные';
  document.querySelector('.interval').textContent = next.interval > 60 ? `повтор через ${next.interval / 60} мин` : `каждые ${next.interval || 30} с`;
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
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
setInterval(() => { if (state) render(state); }, 1000);
