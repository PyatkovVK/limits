'use strict';
(() => {
  const words = {
    ru: { title: 'Подписки', all: 'Все', connected: 'Подключены в Limits', active: 'В Codex / VS Code',
      addSource: 'Добавить профиль Codex', sourceHint: 'Выберите папку CODEX_HOME другого локального профиля Codex или VS Code.',
      hint: 'Подключённые аккаунты хранятся в Limits. Текущие аккаунты читаются из локальных профилей Codex / VS Code; вход и выход выполняйте там. Для другого CODEX_HOME добавьте профиль. При общем хранилище показывается одна подписка.',
      empty: 'В этом режиме пока нет подписок.', forget: 'Убрать из отслеживания', connect: 'Подключить аккаунт в Limits' },
    en: { title: 'Subscriptions', all: 'All', connected: 'Connected in Limits', active: 'In Codex / VS Code',
      addSource: 'Add Codex profile', sourceHint: 'Choose the CODEX_HOME folder for another local Codex or VS Code profile.',
      hint: 'Connected accounts are stored in Limits. Current accounts are read from local Codex / VS Code profiles; sign in and out there. Add a profile for another CODEX_HOME. Shared storage appears as one subscription.',
      empty: 'No subscriptions in this view yet.', forget: 'Stop tracking', connect: 'Connect an account in Limits' },
  };
  let controls, current;
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent.append(node); return node; };
  function render(next) {
    if (!next.subscriptions) return;
    current = next;
    const t = words[next.language] || words.en;
    const section = document.querySelector('.accounts-section');
    if (!controls) {
      controls = make('div', section, 'subscription-controls');
      section.insertBefore(controls, document.getElementById('accounts'));
      const mode = make('select', controls); mode.id = next.platform === 'darwin' ? 'apple-subscription-mode' : 'subscription-mode';
      for (const value of ['all', 'connected', 'active']) { const option = make('option', mode); option.value = value; }
      mode.onchange = async () => { await window.limits.subscriptionMode(mode.value); render(await window.limits.get()); };
      const source = make('button', controls, 'refresh-button'); source.id = next.platform === 'darwin' ? 'apple-subscription-add-source' : 'subscription-add-source'; source.type = 'button';
      source.onclick = async () => {
        source.disabled = true;
        const result = await window.limits.addSubscriptionSource();
        error.textContent = result.error ? (current.language === 'ru' ? 'Не удалось добавить профиль.' : 'Could not add the profile.') : '';
        render(await window.limits.get());
      };
      const error = make('p', controls, 'footnote warning'); error.setAttribute('role', 'status');
      const empty = make('p', section, 'footnote'); empty.id = next.platform === 'darwin' ? 'apple-subscription-empty' : 'subscription-empty';
    }
    section.querySelector('.accounts-heading > span').textContent = t.title;
    section.querySelector('.footnote:not(.warning)').textContent = t.hint;
    const mode = controls.querySelector('select'); mode.value = next.subscriptions.mode;
    mode.setAttribute('aria-label', t.title);
    for (const option of mode.options) option.textContent = t[option.value];
    const source = controls.querySelector('button');
    source.textContent = t.addSource; source.title = t.sourceHint; source.disabled = next.demo;
    source.hidden = mode.value === 'connected';
    let visible = 0;
    for (const profile of next.profiles) {
      const card = [...document.querySelectorAll('.profile-card')].find(node => node.dataset.profileId === profile.id);
      if (!card) continue;
      card.hidden = mode.value !== 'all' && profile.source !== mode.value;
      if (!card.hidden) visible++;
      card.querySelector('.profile-edit').hidden = profile.readOnly;
      card.querySelector('.profile-quotas').hidden = false;
      const status = card.querySelector('.profile-status');
      // The shared renderer refreshes this text on every account state event.
      const prefix = `${profile.sourceLabel} · `;
      if (!status.textContent.startsWith(prefix)) status.textContent = prefix + status.textContent;
      if (profile.readOnly && profile.id !== 'default') {
        const remove = card.querySelector('.profile-remove');
        const label = `${t.forget}: ${profile.displayName || profile.sourceLabel}`;
        remove.title = label; remove.setAttribute('aria-label', label);
      }
    }
    const empty = section.querySelector('[id$="subscription-empty"]'); empty.textContent = t.empty; empty.hidden = visible > 0;
    if (next.readOnly) document.getElementById('login').textContent = t.connect;
  }
  window.limits.subscribe(render);
  window.limits.get().then(render);
})();
