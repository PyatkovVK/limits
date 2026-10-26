'use strict';
const $ = id => document.getElementById(id);
let state = null;
let actionError = null;
const profileCards = new Map();
const removingProfiles = new Set();
const bucketFor = profile => profile.buckets.find(item => item.id === profile.selectedId) || profile.buckets.find(item => item.id === 'codex') || profile.buckets[0];
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
function element(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.append(node);
  return node;
}
function renderAccounts(next, t) {
  const profiles = next.profiles || [];
  for (const [id, card] of profileCards) {
    if (!profiles.some(profile => profile.id === id)) { card.node.remove(); profileCards.delete(id); }
  }
  for (const profile of profiles) {
    let card = profileCards.get(profile.id);
    if (!card) {
      const node = element('article', 'profile-card', $('accounts'));
      node.dataset.profileId = profile.id;
      const heading = element('div', 'profile-heading', node);
      const name = element('span', 'profile-name', heading);
      const select = element('button', 'profile-select', heading);
      select.onclick = () => accountAction('select', profile.id);
      const remove = element('button', 'profile-remove', heading);
      remove.type = 'button';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5');
      icon.append(path); remove.append(icon);
      remove.onclick = () => {
        remove.disabled = true;
        void accountAction('remove', profile.id);
      };
      const status = element('div', 'profile-status', node);
      const quotas = element('div', 'profile-quotas', node);
      const values = {};
      for (const kind of ['short', 'weekly']) {
        const row = element('div', 'profile-quota', quotas);
        const label = element('span', '', row);
        const bar = element('progress', '', row); bar.max = 100;
        const value = element('span', 'profile-value', row);
        values[kind] = { row, label, bar, value };
      }
      const reset = element('time', 'profile-reset', values.short.label);
      const edit = element('details', 'profile-edit', node);
      const summary = element('summary', '', edit);
      const editor = element('div', 'profile-editor', edit);
      const input = element('input', '', editor); input.maxLength = 80;
      const save = element('button', 'profile-action', editor);
      save.onclick = () => accountAction('rename', profile.id, input.value);
      const buttons = element('div', 'profile-buttons', edit);
      const login = element('button', 'profile-action', buttons);
      login.onclick = () => beginLogin(profile.id);
      const cancel = element('button', 'profile-action', buttons);
      cancel.onclick = () => accountAction('cancel', profile.id);
      card = { node, name, select, status, quotas, values, reset, summary, input, save, login, cancel, remove };
      profileCards.set(profile.id, card);
    }
    const selected = profile.id === next.selectedProfileId;
    card.node.classList.toggle('selected', selected);
    card.node.classList.toggle('stale', profile.stale);
    card.node.classList.toggle('fresh', !profile.stale);
    card.name.textContent = profile.displayName || t('connectAccount');
    card.name.title = profile.account?.email || '';
    card.select.textContent = t(selected ? 'inWidget' : 'useWidget');
    card.select.disabled = selected;
    card.status.textContent = [profile.account?.planType, t(profile.error || (profile.status === 'ready' ? profile.stale ? 'stale' : 'online' : profile.status === 'signing-in' ? 'signingIn' : profile.status === 'signed-out' ? 'signedOut' : 'connecting'))].filter(Boolean).join(' · ');
    card.quotas.hidden = selected;
    const bucket = bucketFor(profile);
    for (const kind of ['short', 'weekly']) {
      const quota = bucket?.[kind];
      // Keep the countdown node and input focus intact while refreshing.
      if (kind === 'short') {
        if (!card.values[kind].label.firstChild || card.values[kind].label.firstChild.nodeType !== Node.TEXT_NODE) card.values[kind].label.prepend(document.createTextNode(''));
        card.values[kind].label.firstChild.textContent = t('shortCompact');
      } else card.values[kind].label.textContent = t('weeklyCompact');
      card.values[kind].bar.value = quota?.remaining ?? 0;
      card.values[kind].bar.setAttribute('aria-label', t(kind));
      card.values[kind].value.textContent = quota?.remaining == null ? '—' : `${quota.remaining}%`;
      card.values[kind].row.classList.toggle('limit-67', quota?.remaining === 67);
    }
    card.summary.textContent = t('editAccount');
    card.input.placeholder = t('nickname'); card.input.setAttribute('aria-label', t('nickname'));
    if (document.activeElement !== card.input) card.input.value = profile.nickname;
    card.save.textContent = t('save');
    card.login.textContent = t(profile.account ? 'switchAccount' : 'login');
    card.login.disabled = next.demo || Boolean(next.loginProfileId && next.loginProfileId !== profile.id) || profile.refreshing;
    card.cancel.textContent = t('cancelLogin'); card.cancel.hidden = next.loginProfileId !== profile.id;
    const removeLabel = `${t('removeAccount')}: ${card.name.textContent}`;
    card.remove.title = removeLabel; card.remove.setAttribute('aria-label', removeLabel);
    card.remove.hidden = profile.id === 'default'; card.remove.disabled = next.demo || removingProfiles.has(profile.id);
  }
  $('add-account').disabled = next.demo || Boolean(next.loginProfileId) || !profiles.length;
}
function renderCountdown() {
  if (!state) return;
  const timer = state.platform === 'win32' ? window.limitsWindowsResetClock : window.limitsCountdown;
  const bucket = state.buckets.find(item => item.id === state.selectedId) || state.buckets.find(item => item.id === 'codex') || state.buckets[0];
  timer.render($('short-reset'), bucket?.short?.resetsAt, state.language || 'ru');
  for (const profile of state.profiles || []) {
    const card = profileCards.get(profile.id);
    if (card) timer.render(card.reset, bucketFor(profile)?.short?.resetsAt, state.language || 'ru');
  }
}

function render(next) {
  state = next;
  document.body.dataset.platform = next.platform || '';
  document.body.dataset.theme = next.dark ? 'dark' : 'light';
  document.body.classList.toggle('reduced-transparency', Boolean(next.reducedTransparency));
  document.body.classList.toggle('reduced-motion', Boolean(next.reducedMotion));
  const language = next.language || 'ru';
  const translate = (lang, key) => (next.platform === 'darwin' ? window.limitsApple?.translate(lang, key, next) : null) || (next.platform === 'win32' ? window.limitsWindowsI18n?.t(lang, key) : null) || window.limitsI18n.t(lang, key, next.platform);
  const t = key => translate(language, key);
  window.limitsI18n.apply(language, document, translate);
  $('language').value = language;
  if (!window.limitsLinuxDisplay?.render(next)) {
    $('display-mode').value = next.displayMode || 'widget';
    const modes = next.displayModes || ['widget', 'tray'];
    for (const option of $('display-mode').options) option.hidden = option.disabled = !modes.includes(option.value);
    $('display-mode').closest('.display-settings').hidden = modes.length < 2;
  }
  $('display-hint').textContent = t(next.displayMode === 'notch' ? 'notchFootnote' : next.displayMode === 'tray' ? 'trayFootnote' : 'footnote');
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
  document.body.classList.toggle('stale', Boolean(stale));
  $('demo').hidden = !next.demo;
  $('connection').textContent = t(next.demo ? 'demo' : next.status === 'signing-in' ? 'signingIn' : next.status === 'signed-out' ? 'signedOut' : next.status === 'connecting' ? 'connecting' : stale ? 'stale' : 'online');
  $('connection').classList.toggle('stale', Boolean(stale));
  $('account').textContent = next.displayName || next.account?.email || t(next.status === 'signed-out' ? 'connectAccount' : 'account');
  $('account').title = next.account?.email || '';
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
    card.classList.toggle('limit-67', remaining === 67);
  }
  $('other').hidden = !bucket?.other?.length;
  $('other').textContent = bucket?.other?.map(item => `${item.duration ?? '?'} ${t('minutes')}: ${item.remaining === null ? t('noData') : `${item.remaining}%`}`).join(' · ') || '';
  $('refresh').disabled = next.refreshing || next.demo;
  $('login').disabled = next.demo || next.status === 'signing-in' || next.refreshing || Boolean(next.loginProfileId);
  $('login').textContent = t(next.status === 'signing-in' ? 'finishLogin' : next.account ? 'switchAccount' : 'login');
  $('updated').textContent = next.updatedAt ? `${t('updated')} ${new Date(next.updatedAt).toLocaleTimeString(language === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : t('waiting');
  renderAccounts(next, t);
  renderCountdown();
  window.limitsApple?.render(next);
}

$('hide').addEventListener('click', () => window.limits.hide());
$('refresh').addEventListener('click', async () => { actionError = null; render(await window.limits.refresh()); });
async function beginLogin(id) {
  actionError = null; $('login').disabled = true;
  const result = await window.limits.login(id);
  actionError = result.error || null;
  render(await window.limits.get());
}
$('login').addEventListener('click', () => beginLogin());
$('add-account').addEventListener('click', async () => {
  actionError = null; $('add-account').disabled = true;
  const result = await window.limits.addAccount();
  actionError = result.error || null;
  render(await window.limits.get());
});
$('bucket').addEventListener('change', () => window.limits.select($('bucket').value));
$('language').addEventListener('change', async () => { render(await window.limits.language($('language').value)); });
$('display-mode').addEventListener('change', async () => { render(await window.limits.displayMode($('display-mode').value)); });
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
setInterval(renderCountdown, 1000);
