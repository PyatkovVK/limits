'use strict';
const $ = id => document.getElementById(id);
let state = null;
let actionError = null;
const removingProfiles = new Set();
async function accountAction(action, id, value) {
  if (action === 'remove' && removingProfiles.has(id)) return;
  if (action === 'remove') removingProfiles.add(id);
  actionError = null;
  try {
    const result = await window.limits.accountAction(action, id, value);
    actionError = result.error || null;
  } catch { actionError = 'accountActionFailed'; }
  finally { if (action === 'remove') removingProfiles.delete(id); }
  render(await window.limits.get());
}
function renderCountdown() {
  if (!state) return;
  window.limitsMetricElements?.countdowns($('provider-metrics'), state);
  const timer = state.platform === 'win32' ? window.limitsWindowsResetClock : window.limitsCountdown;
  const bucket = state.buckets.find(item => item.id === state.selectedId) || state.buckets[0];
  timer.render($('short-reset'), bucket?.short?.resetsAt, state.language || 'ru');
  const weeklyReset = $('weekly-reset');
  weeklyReset.hidden = !state.capabilities?.apiKey || bucket?.weekly?.resetsAt == null;
  if (!weeklyReset.hidden) timer.render(weeklyReset, bucket.weekly.resetsAt, state.language || 'ru', Date.now(), { compactDays: true });
}

function render(next) {
  state = next;
  document.body.dataset.platform = next.platform || '';
  document.body.dataset.theme = next.dark ? 'dark' : 'light';
  document.body.classList.toggle('reduced-transparency', Boolean(next.reducedTransparency));
  document.body.classList.toggle('reduced-motion', Boolean(next.reducedMotion));
  const language = next.language || 'ru';
  const translate = (lang, key) => (next.platform === 'darwin' ? window.limitsApple?.translate(lang, key, next) : null) || (next.platform === 'win32' ? window.limitsWindowsI18n?.t(lang, key) : null) || window.limitsI18n.t(lang, key);
  const t = key => translate(language, key);
  const generic = Boolean(next.displaySchema && next.displaySchema.layout !== 'quota-windows');
  window.limitsI18n.apply(language, document, translate);
  window.limitsSettings.render(next, t);
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > (next.staleAfterMs || 90000);
  const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets[0];
  document.body.classList.toggle('stale', Boolean(stale));
  $('demo').hidden = !next.demo;
  $('connection').textContent = t(next.demo ? 'demo' : next.status === 'signing-in' ? 'signingIn' : next.status === 'signed-out' ? 'signedOut' : next.status === 'connecting' ? 'connecting' : stale ? 'stale' : 'online');
  $('connection').classList.toggle('stale', Boolean(stale));
  $('account').textContent = next.displayName || next.account?.email || t(next.status === 'signed-out' ? 'connectAccount' : 'account');
  $('account').title = next.account?.email || '';
  $('plan').hidden = !next.account?.planType;
  $('plan').textContent = next.account?.planType || '';
  const messageKey = actionError || next.error || next.widgetError || (next.accountAvailable === false ? 'insufficientBalance' : next.status === 'unsupported' ? generic ? 'genericUnsupported' : 'unsupported' : next.status === 'ready' && !(next.groups?.length || bucket) ? 'noLimits' : stale && next.updatedAt ? 'cached' : null);
  const message = messageKey ? t(messageKey) : null;
  $('error').hidden = !message;
  $('error').textContent = message || '';
  const groups = next.groups || next.buckets;
  for (const kind of ['short', 'weekly']) $(`${kind}-bar`).closest('.quota-card').hidden = generic;
  $('provider-metrics').hidden = !generic;
  if (generic) window.limitsMetricElements.render($('provider-metrics'), next);
  $('bucket-row').hidden = groups.length < 2;
  const signature = JSON.stringify(groups.map(item => [item.id, item.name]));
  if ($('bucket').dataset.signature !== signature) {
    $('bucket').replaceChildren(...groups.map(item => {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; return option;
    }));
    $('bucket').dataset.signature = signature;
  }
  if (groups.length) $('bucket').value = window.limitsMetrics.view(next).group?.id || bucket?.id;
  for (const kind of ['short', 'weekly']) {
    const value = bucket?.[kind];
    const remaining = value?.remaining ?? null;
    $(`${kind}-value`).textContent = remaining === null ? '—' : String(remaining);
    $(`${kind}-unit`).hidden = remaining === null;
    $(`${kind}-bar`).value = remaining ?? 0;
    const card = $(`${kind}-bar`).closest('.quota-card');
    card.classList.toggle('low', remaining !== null && remaining <= 10);
    card.classList.toggle('caution', remaining !== null && remaining > 10 && remaining <= 25);
    card.classList.toggle('limit-67', remaining === 67);
  }
  $('other').hidden = !bucket?.other?.length;
  $('other').textContent = bucket?.other?.map(item => `${item.duration ?? '?'} ${t('minutes')}: ${item.remaining === null ? t('noData') : `${item.remaining}%`}`).join(' · ') || '';
  $('refresh').disabled = next.refreshing || next.demo;
  $('login').disabled = (next.capabilities?.signIn === false && !next.capabilities?.apiKey && !next.readOnly) || next.demo || next.status === 'signing-in' || next.refreshing || Boolean(next.loginProfileId || next.keyConnection);
  $('login').textContent = t(next.capabilities?.apiKey ? next.account ? 'replaceApiKey' : 'connectApiKey' : next.status === 'signing-in' ? 'finishLogin' : next.account ? 'switchAccount' : generic ? 'genericLogin' : 'login');
  $('updated').textContent = next.updatedAt ? `${t('updated')} ${new Date(next.updatedAt).toLocaleTimeString(language === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : t('waiting');
  renderSubscriptions(next, t, actionError);
  renderCountdown();
  window.limitsApple?.render(next);
}

$('hide').addEventListener('click', () => window.limits.hide());
$('refresh').addEventListener('click', async () => { actionError = null; render(await window.limits.refresh()); });
async function beginLogin(id) {
  actionError = null; $('login').disabled = true;
  const result = await window.limits.login(id);
  window.limitsKeyConnection?.open(result);
  actionError = result.connection ? null : result.error || null;
  render(await window.limits.get());
}
$('login').addEventListener('click', () => beginLogin());
async function addAccount(providerId) {
  actionError = null;
  try {
    const result = await window.limits.addAccount(providerId);
    window.limitsKeyConnection?.open(result);
    actionError = result.connection ? null : result.error || null;
  } catch { actionError = 'accountActionFailed'; }
  render(await window.limits.get());
}
const renderSubscriptions = window.limitsSubscriptions({ accountAction, beginLogin, addAccount, isRemoving: id => removingProfiles.has(id) });
$('bucket').addEventListener('change', () => window.limits.select($('bucket').value));
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
setInterval(renderCountdown, 1000);
