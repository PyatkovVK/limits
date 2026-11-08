'use strict';
(() => {
  const words = {
    ru: { title: 'Подписки', all: 'Все', connected: 'Подключены в Limits', active: 'В Codex / VS Code',
      empty: 'В этом режиме пока нет подписок.', connect: 'Подключить аккаунт в Limits' },
    en: { title: 'Subscriptions', all: 'All', connected: 'Connected in Limits', active: 'In Codex / VS Code',
      empty: 'No subscriptions in this view yet.', connect: 'Connect an account in Limits' },
  };
  let controls;
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent.append(node); return node; };
  function render(next) {
    if (!next.subscriptions) return;
    const t = words[next.language] || words.en;
    const section = document.querySelector('.accounts-section');
    if (!controls) {
      controls = make('div', section, 'subscription-controls');
      section.insertBefore(controls, document.getElementById('accounts'));
      const mode = make('select', controls); mode.id = next.platform === 'darwin' ? 'apple-subscription-mode' : 'subscription-mode';
      for (const value of ['all', 'connected', 'active']) { const option = make('option', mode); option.value = value; }
      mode.onchange = async () => { await window.limits.subscriptionMode(mode.value); render(await window.limits.get()); };
      controls.append(document.getElementById('account-provider'), document.getElementById('add-account'));
      const empty = make('p', section, 'footnote'); empty.id = next.platform === 'darwin' ? 'apple-subscription-empty' : 'subscription-empty';
    }
    section.querySelector('.accounts-heading > span').textContent = t.title;
    const mode = controls.querySelector('select'); mode.value = next.subscriptions.mode;
    mode.setAttribute('aria-label', t.title);
    for (const option of mode.options) option.textContent = t[option.value];
    let visible = 0;
    for (const profile of next.profiles) {
      const card = [...document.querySelectorAll('.profile-card')].find(node => node.dataset.profileId === profile.id);
      if (!card) continue;
      card.hidden = mode.value !== 'all' && profile.source !== mode.value;
      if (!card.hidden) visible++;
      const status = card.querySelector('.profile-status');
      // The shared renderer refreshes this text on every account state event.
      const prefix = `${profile.sourceLabel} · `;
      if (!status.textContent.startsWith(prefix)) status.textContent = prefix + status.textContent;
    }
    const empty = section.querySelector('[id$="subscription-empty"]'); empty.textContent = t.empty; empty.hidden = visible > 0;
    if (next.readOnly) document.getElementById('login').textContent = t.connect;
  }
  window.limits.subscribe(render);
  window.limits.get().then(render);
})();
