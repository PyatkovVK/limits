'use strict';
(function () {
  const isNotch = new URLSearchParams(location.search).get('apple') === 'notch';
  const body = document.body;
  let islandIndicators, updateSurface, renderIslandPanel;
  if (isNotch) {
    body.classList.add('apple-notch');
    const content = document.createElement('div');
    content.className = 'apple-content'; content.inert = true;
    content.dataset.backgroundTarget = '';
    content.append(...body.children);
    const main = content.querySelector('main');
    const account = main.querySelector('.account-row');
    const accountPosition = document.createComment('account position');
    account.before(accountPosition);
    const actions = main.querySelector('.actions');
    const refresh = actions.querySelector('#refresh');
    const footer = main.querySelector('footer');
    const updated = footer.querySelector('#updated');
    const connection = content.querySelector('#connection');
    const status = footer.querySelector('.live-dot');
    const quotas = document.createElement('div'); quotas.className = 'apple-panel-quotas';
    const cards = [...main.querySelectorAll('.quota-card')];
    cards[0].before(quotas);
    quotas.append(...cards);
    renderIslandPanel = (island, updatedTime, t) => {
      if (island) {
        if (account.parentElement !== footer) { footer.prepend(account); footer.append(refresh); }
        cards[0].querySelector('[data-i18n]').textContent = t('islandShortPeriod');
        cards[1].querySelector('[data-i18n]').textContent = t('islandWeeklyPeriod');
        updated.title = updated.textContent;
        updated.textContent = updatedTime || '—';
        status.title = connection.textContent;
        refresh.title = [refresh.textContent, status.title, updated.title].join(' · ');
        refresh.setAttribute('aria-label', refresh.title);
      } else if (account.parentElement === footer) {
        accountPosition.after(account); actions.prepend(refresh);
        for (const node of [status, updated, refresh]) node.removeAttribute('title');
        refresh.removeAttribute('aria-label');
      }
    };
    const shell = document.createElement('div'); shell.className = 'apple-shell';
    const cap = document.createElement('div'); cap.className = 'apple-cap'; cap.setAttribute('aria-hidden', 'true');
    const meters = document.createElement('div'); meters.className = 'apple-mini';
    for (const kind of ['short', 'weekly']) {
      const progress = document.createElement('progress'); progress.className = `apple-mini-${kind}`; progress.max = 100;
      meters.append(progress);
    }
    const resetHint = document.createElement('div'); resetHint.className = 'apple-island-reset'; resetHint.hidden = true;
    const resetLabel = document.createElement('span');
    const resetTime = document.createElement('time'); resetHint.append(resetLabel, resetTime);
    const trigger = document.createElement('button'); trigger.className = 'apple-trigger'; trigger.id = 'apple-trigger';
    const preview = document.createElement('div'); preview.className = 'apple-preview';
    const heading = document.createElement('div'); heading.className = 'apple-preview-heading';
    const title = document.createElement('span'); title.textContent = 'Limits';
    const hint = document.createElement('span'); hint.id = 'apple-hint'; heading.append(title, hint); preview.append(heading);
    for (const [kind, label] of [['short', '5h'], ['weekly', '7d']]) {
      const row = document.createElement('div'); row.className = `apple-preview-row ${kind}`;
      const name = document.createElement('span'); name.textContent = label; name.className = 'apple-period';
      if (kind === 'short') { const reset = document.createElement('time'); reset.id = 'apple-short-reset'; name.append(reset); }
      const bar = document.createElement('progress'); bar.max = 100; bar.id = `apple-${kind}-bar`;
      const value = document.createElement('span'); value.id = `apple-${kind}-value`;
      row.append(name, bar, value); preview.append(row);
    }
    islandIndicators = window.limitsAppleIsland.create();
    const notification = document.createElement('section'); notification.className = 'apple-notification'; notification.hidden = true;
    notification.setAttribute('role', 'status'); notification.setAttribute('aria-live', 'polite'); notification.setAttribute('aria-atomic', 'true');
    const notificationTitle = document.createElement('strong'); notificationTitle.id = 'apple-notification-title';
    const dismiss = document.createElement('button'); dismiss.className = 'apple-notification-dismiss'; dismiss.type = 'button'; dismiss.textContent = '×';
    const notificationBody = document.createElement('p'); notificationBody.id = 'apple-notification-body';
    const notificationAction = document.createElement('button'); notificationAction.className = 'apple-notification-action'; notificationAction.type = 'button';
    notification.append(notificationTitle, dismiss, notificationBody, notificationAction);
    dismiss.onclick = () => window.limits.dismissNotification(window.limitsApple.state?.appleNotch?.notification?.id);
    notificationAction.onclick = () => window.limits.openNotification(window.limitsApple.state?.appleNotch?.notification?.id);
    const svg = 'http://www.w3.org/2000/svg';
    const outline = document.createElementNS(svg, 'svg'); outline.classList.add('apple-surface-outline'); outline.setAttribute('aria-hidden', 'true');
    outline.append(document.createElementNS(svg, 'path'));
    trigger.append(meters, resetHint, preview); shell.append(cap, trigger, content, islandIndicators.header, notification, outline); body.append(shell);
    updateSurface = window.limitsAppleSurface.observeSurface(shell, body);
    const loginNotice = document.createElement('div');
    loginNotice.id = 'apple-login-notice'; loginNotice.className = 'notice'; loginNotice.setAttribute('role', 'status'); loginNotice.hidden = true;
    content.querySelector('main').prepend(loginNotice);
    trigger.addEventListener('click', () => window.limits.open());
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      const layout = window.limitsApple.state?.appleNotch;
      if (layout?.phase === 'notification') window.limits.dismissNotification(layout.notification?.id);
      else window.limits.hide();
    });
    setInterval(() => { if (window.limitsApple?.state) window.limitsApple.renderCountdown(); }, 1000);
  }
  window.limitsApple = {
    activeHost(next) {
      return ['notch', 'island'].includes(next?.displayMode) ? isNotch && next.appleNotch?.phase === 'expanded' : !isNotch;
    },
    translate(language, key, next) {
      if (['notch', 'island'].includes(next.displayMode)) {
        const keys = { inWidget: 'inNotch', useWidget: 'useNotch', accountsHint: 'notchAccounts', close: 'notchClose' };
        key = keys[key] || key;
      }
      return window.limitsAppleI18n.t(language, key);
    },
    render(next, updatedTime) {
      if (!isNotch || !next.appleNotch) return;
      this.state = next;
      const layout = next.appleNotch;
      body.classList.toggle('apple-island', layout.mode === 'island');
      body.dataset.islandIndicators = layout.indicatorMode;
      body.dataset.islandHoverStyle = layout.hoverStyle;
      body.classList.toggle('apple-narrow-preview', layout.mode === 'island' && layout.closedWidth < 340);
      body.dataset.notchPhase = layout.phase;
      body.classList.toggle('reduced-motion', Boolean(next.reducedMotion));
      const properties = { 'cap-height': layout.capHeight, 'content-top': layout.contentTop, 'menu-bar-width': layout.capWidth, 'meters-width': layout.metersWidth, 'meters-top': layout.metersTop, 'meters-height': layout.metersHeight, 'full-width': layout.fullWidth, 'full-height': layout.fullHeight, 'closed-width': layout.closedWidth, 'closed-height': layout.closedHeight, 'peek-width': layout.peekWidth, 'peek-height': layout.peekHeight, 'notification-width': layout.notificationWidth, 'notification-height': layout.notificationHeight };
      for (const [name, value] of Object.entries(properties)) body.style.setProperty(`--${name}`, `${value}px`);
      updateSurface();
      const expanded = layout.phase === 'expanded';
      document.querySelector('.apple-content').inert = !expanded;
      const trigger = document.getElementById('apple-trigger');
      trigger.tabIndex = expanded || (layout.mode === 'island' && layout.indicatorMode !== 'hidden') ? -1 : 0;
      trigger.setAttribute('aria-expanded', String(expanded));
      trigger.inert = layout.phase === 'notification' || expanded;
      const t = key => window.limitsAppleI18n.t(next.language, key);
      renderIslandPanel(layout.mode === 'island', updatedTime, t);
      const loginNotice = document.getElementById('apple-login-notice');
      const noticeParent = document.querySelector('dialog[open] .settings-content') || document.querySelector('.apple-content main');
      if (loginNotice.parentElement !== noticeParent) noticeParent.prepend(loginNotice);
      loginNotice.hidden = !layout.browserOpening;
      loginNotice.textContent = t('browserOpening');
      trigger.setAttribute('aria-label', t('notchOpen'));
      islandIndicators.render(next, layout);
      document.getElementById('apple-hint').textContent = t('notchHint');
      window.limitsMetricElements?.compact(document.querySelector('.apple-preview'), next);
      const generic = window.limitsMetricElements?.compact(document.querySelector('.apple-mini'), next);
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets[0];
      for (const kind of ['short', 'weekly']) {
        const value = bucket?.[kind]?.remaining ?? null;
        document.getElementById(`apple-${kind}-value`).textContent = value === null ? '—' : `${value}%`;
        document.getElementById(`apple-${kind}-bar`).value = value ?? 0;
        const meter = document.querySelector(`.apple-mini-${kind}`);
        meter.value = value ?? 0;
        meter.hidden = generic || (layout.mode === 'island' && value === null);
        document.querySelector(`.apple-preview-row.${kind}`).classList.toggle('low', value !== null && value <= 10);
      }
      const message = layout.notification;
      const notification = document.querySelector('.apple-notification');
      const notificationParent = expanded ? document.querySelector('dialog[open] .mac-settings-content') || document.querySelector('dialog[open] .settings-content') || document.querySelector('.mac-panel-content') || document.querySelector('.apple-content main') : document.querySelector('.apple-shell');
      if (notification.parentElement !== notificationParent) notificationParent.prepend(notification);
      notification.hidden = !message || layout.mode !== 'island';
      document.getElementById('apple-notification-title').textContent = message?.title || '';
      document.getElementById('apple-notification-body').textContent = message?.body || '';
      document.querySelector('.apple-notification-dismiss').setAttribute('aria-label', t('islandDismiss'));
      const action = document.querySelector('.apple-notification-action');
      action.hidden = !message?.action;
      action.textContent = t(message?.action === 'updates' ? 'islandUpdateAction' : 'islandSource');
      this.renderCountdown();
    },
    renderCountdown() {
      const next = this.state;
      window.limitsMetricElements?.countdowns(document.querySelector('.apple-preview'));
      window.limitsMetricElements?.countdowns(document.querySelector('.apple-mini'));
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets[0];
      window.limitsCountdown.render(document.getElementById('apple-short-reset'), bucket?.short?.resetsAt, next.language);
      const hint = document.querySelector('.apple-island-reset');
      const reset = next.displaySchema && next.displaySchema.layout !== 'quota-windows'
        ? window.limitsMetrics.view(next).primary?.resetsAt / 1000
        : bucket?.short?.resetsAt;
      hint.hidden = !Number.isFinite(reset) || reset <= 0;
      if (!hint.hidden) {
        hint.firstElementChild.textContent = window.limitsI18n.t(next.language, 'resetIn');
        window.limitsCountdown.render(hint.lastElementChild, reset, next.language);
      }
    }
  };
})();
