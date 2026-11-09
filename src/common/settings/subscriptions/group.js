'use strict';
(() => {
  const bucketFor = profile => profile.buckets.find(item => item.id === profile.selectedId) || profile.buckets[0];
  const $ = id => document.getElementById(id);
  const labels = {
    ru: { title: 'Подписки', source: 'Источник', all: 'Все', connected: 'Подключены в Limits', active: 'В Codex / VS Code',
      local: 'Подключено в Limits', external: 'Codex / VS Code', empty: 'В этом режиме пока нет подписок',
      connect: 'Подключить аккаунт в Limits', inPanel: 'В панели', usePanel: 'В панель', manage: 'Управление', week: '7 д' },
    en: { title: 'Subscriptions', source: 'Source', all: 'All', connected: 'Connected in Limits', active: 'In Codex / VS Code',
      local: 'Connected in Limits', external: 'Codex / VS Code', empty: 'No subscriptions in this view yet',
      connect: 'Connect an account in Limits', inPanel: 'In panel', usePanel: 'Use in panel', manage: 'Manage', week: '7 d' },
  };

  function element(tag, className, parent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    parent.append(node);
    return node;
  }

  window.limitsSubscriptions = ({ accountAction, beginLogin, addAccount, isRemoving }) => {
    const profileCards = new Map();
    const add = $('add-account');
    const menu = $('subscription-providers');
    const controls = document.querySelector('.subscription-controls');
    const mode = controls.querySelector('select');
    const source = $('subscription-source');
    const empty = document.querySelector('.subscription-empty');
    const error = document.querySelector('.subscription-error');
    let providerSignature;
    let confirmedMode = 'all';
    let canAdd = false;
    let adding = false;
    let filterError = false;
    let filterErrorText;
    for (const value of ['all', 'connected', 'active']) element('option', '', mode).value = value;

    function showError(message) {
      error.textContent = message || '';
      error.hidden = !message;
    }
    mode.onchange = async () => {
      const requested = mode.value;
      mode.disabled = true;
      showError();
      try {
        const result = await window.limits.subscriptionMode(requested);
        filterError = Boolean(result.error);
        if (!filterError) confirmedMode = requested;
      } catch { filterError = true; }
      finally {
        mode.disabled = false;
        mode.value = confirmedMode;
        if (filterError) showError(filterErrorText);
      }
    };
    menu.onclick = async event => {
      const provider = event.target.closest('button');
      if (!provider || add.disabled) return;
      menu.hidePopover();
      adding = add.disabled = true;
      try { await addAccount(provider.dataset.provider); }
      finally { adding = false; add.disabled = !canAdd; }
    };
    window.limitsSettings.dialog.addEventListener('close', () => menu.hidePopover());

    function renderAccounts(next, t, words) {
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
          const toggle = element('button', 'profile-toggle', heading);
          toggle.type = 'button';
          toggle.setAttribute('aria-expanded', 'true');
          const copy = element('span', 'profile-copy', toggle);
          const name = element('span', 'profile-name', copy);
          const status = element('span', 'profile-status', copy);
          const select = element('button', 'profile-select', heading);
          select.onclick = () => accountAction('select', profile.id);
          select.type = 'button';
          const fold = element('div', 'profile-fold', node);
          fold.id = `profile-limits-${profile.id}`;
          toggle.setAttribute('aria-controls', fold.id);
          const clip = element('div', 'profile-fold-content', fold);
          const quotas = element('div', 'profile-quotas', clip);
          toggle.onclick = () => {
            const collapsed = fold.toggleAttribute('data-collapsed');
            fold.inert = collapsed;
            toggle.setAttribute('aria-expanded', String(!collapsed));
          };
          const values = {};
          for (const kind of ['short', 'weekly']) {
            const row = element('div', 'profile-quota', quotas);
            const label = element('span', '', row);
            const bar = element('progress', '', row); bar.max = 100;
            const value = element('span', 'profile-value', row);
            values[kind] = { row, label, bar, value };
          }
          const edit = element('details', 'profile-edit', clip);
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
          const directRemove = profile.providerId === 'deepseek';
          const remove = element('button', directRemove ? 'profile-remove profile-remove-icon' : 'profile-remove profile-action', directRemove ? heading : buttons);
          remove.type = 'button';
          if (directRemove) {
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5');
            icon.append(path); remove.append(icon);
          }
          remove.onclick = () => {
            remove.disabled = true;
            void accountAction('remove', profile.id);
          };
          card = { node, name, select, status, quotas, values, edit, summary, input, save, login, cancel, remove, directRemove };
          profileCards.set(profile.id, card);
        }
        const selected = profile.id === next.selectedProfileId;
        card.node.classList.toggle('selected', selected);
        card.node.classList.toggle('stale', profile.stale);
        card.node.hidden = confirmedMode !== 'all' && profile.source !== confirmedMode;
        card.name.textContent = profile.displayName || t('connectAccount');
        card.name.title = profile.account?.email || '';
        card.select.textContent = selected ? words.inPanel : words.usePanel;
        card.select.setAttribute('aria-pressed', String(selected));
        card.select.disabled = selected;
        const connection = profile.error || (profile.accountAvailable === false ? 'insufficientBalance' : {
          ready: profile.stale ? 'stale' : null, 'signing-in': 'signingIn', 'signed-out': 'signedOut', connecting: 'connecting',
        }[profile.status]);
        card.status.textContent = [profile.account?.planType, profile.source === 'active' ? words.external : words.local,
          connection && t(connection)].filter(Boolean).join(' · ');
        const generic = Boolean(profile.displaySchema && profile.displaySchema.layout !== 'quota-windows');
        for (const value of Object.values(card.values)) value.row.hidden = generic;
        let metrics = card.quotas.querySelector('.profile-metrics');
        if (generic) {
          if (!metrics) { metrics = element('div', 'profile-metrics', card.quotas); }
          metrics.hidden = false;
          window.limitsMetricElements.render(metrics, { ...profile, language: next.language, platform: next.platform },
            { profile: true, primaryOnly: profile.providerId === 'deepseek' });
        } else if (metrics) metrics.hidden = true;
        const bucket = bucketFor(profile);
        for (const kind of ['short', 'weekly']) {
          const quota = bucket?.[kind];
          card.values[kind].label.textContent = kind === 'short' ? t('shortCompact') : words.week;
          card.values[kind].bar.value = quota?.remaining ?? 0;
          card.values[kind].bar.setAttribute('aria-label', t(kind));
          card.values[kind].value.textContent = quota?.remaining == null ? '—' : `${quota.remaining}%`;
          card.values[kind].row.classList.toggle('limit-67', quota?.remaining === 67);
        }
        card.edit.hidden = Boolean(profile.readOnly) || card.directRemove;
        card.summary.textContent = words.manage;
        card.input.placeholder = t('nickname'); card.input.setAttribute('aria-label', t('nickname'));
        if (document.activeElement !== card.input) card.input.value = profile.nickname;
        card.save.textContent = t('save');
        card.login.textContent = t(profile.capabilities?.apiKey ? profile.account ? 'replaceApiKey' : 'connectApiKey' : profile.account ? 'switchAccount' : generic ? 'genericLogin' : 'login');
        card.login.disabled = (profile.capabilities?.signIn === false && !profile.capabilities?.apiKey) || next.demo || Boolean(next.keyConnection || next.loginProfileId && next.loginProfileId !== profile.id) || profile.refreshing;
        card.cancel.textContent = t('cancelLogin'); card.cancel.hidden = next.loginProfileId !== profile.id;
        const removeLabel = `${t('removeAccount')}: ${card.name.textContent}`;
        card.remove.title = removeLabel; card.remove.setAttribute('aria-label', removeLabel);
        if (!card.directRemove) card.remove.textContent = t('removeAccount');
        card.remove.hidden = profile.id === 'default' || Boolean(profile.readOnly);
        card.remove.disabled = next.demo || isRemoving(profile.id);
      }
    }
    return (next, t, actionError) => {
      const words = labels[next.language || 'ru'] || labels.en;
      const providers = next.providers || [];
      const signature = JSON.stringify(providers);
      if (signature !== providerSignature) {
        menu.replaceChildren();
        for (const provider of providers) {
          const button = element('button', 'subscription-button', menu);
          button.type = 'button'; button.dataset.provider = provider.id; button.textContent = provider.name;
        }
        providerSignature = signature;
      }
      canAdd = !next.demo && !next.loginProfileId && !next.keyConnection && providers.length > 0 && next.profiles?.length > 0;
      add.disabled = adding || !canAdd;
      if (add.disabled) menu.hidePopover();
      $('subscriptions-title').textContent = words.title;
      source.textContent = words.source;
      mode.id = next.platform === 'darwin' ? 'apple-subscription-mode' : 'subscription-mode';
      source.htmlFor = mode.id;
      controls.hidden = !next.subscriptions;
      confirmedMode = next.subscriptions?.mode || 'all';
      if (!mode.disabled) mode.value = confirmedMode;
      for (const option of mode.options) option.textContent = words[option.value];
      renderAccounts(next, t, words);
      empty.id = next.platform === 'darwin' ? 'apple-subscription-empty' : 'subscription-empty';
      empty.textContent = words.empty;
      empty.hidden = [...profileCards.values()].some(card => !card.node.hidden);
      if (next.readOnly) $('login').textContent = words.connect;
      filterErrorText = t('accountActionFailed');
      showError(actionError ? t(actionError) : filterError ? filterErrorText : '');
    };
  };
})();
