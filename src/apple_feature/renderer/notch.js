'use strict';
(function () {
  const isNotch = new URLSearchParams(location.search).get('apple') === 'notch';
  const body = document.body;
  let islandIndicators, updateSurface, panel;

  function preparePanel() {
    const main = document.querySelector('main');
    const footer = main.querySelector('footer');
    const refresh = main.querySelector('#refresh');
    footer.prepend(main.querySelector('.account-row'));
    footer.append(refresh);
    const cards = [...main.querySelectorAll('.quota-card.short, .quota-card.weekly')];
    const quotas = document.createElement('div'); quotas.className = 'apple-panel-quotas';
    cards[0].before(quotas);
    quotas.append(...cards);
    return {
      periods: cards.map(card => card.querySelector('[data-i18n]')),
      refresh,
      updated: footer.querySelector('#updated'),
      status: footer.querySelector('.live-dot'),
      connection: document.getElementById('connection'),
    };
  }

  function renderPanel(updatedTime, t) {
    const { periods, refresh, updated, status, connection } = panel ??= preparePanel();
    periods[0].textContent = t('shortPeriod');
    periods[1].textContent = t('weeklyPeriod');
    updated.title = updated.textContent;
    updated.textContent = updatedTime || '—';
    status.title = connection.textContent;
    refresh.title = [refresh.textContent, status.title, updated.title].join(' · ');
    refresh.setAttribute('aria-label', refresh.title);
  }

  if (isNotch) {
    body.classList.add('apple-notch');
    const content = document.createElement('div');
    content.className = 'apple-content'; content.inert = true;
    content.dataset.backgroundTarget = '';
    content.append(...body.children);
    const shell = document.createElement('div'); shell.className = 'apple-shell';
    const cap = document.createElement('div'); cap.className = 'apple-cap'; cap.setAttribute('aria-hidden', 'true');
    const resetHint = document.createElement('div'); resetHint.className = 'apple-preview-reset'; resetHint.hidden = true;
    const resetLabel = document.createElement('span');
    const resetTime = document.createElement('time'); resetTime.id = 'apple-short-reset'; resetHint.append(resetLabel, resetTime);
    const trigger = document.createElement('button'); trigger.className = 'apple-trigger'; trigger.id = 'apple-trigger';
    const preview = document.createElement('div'); preview.className = 'apple-preview';
    const heading = document.createElement('div'); heading.className = 'apple-preview-heading';
    const title = document.createElement('span'); title.textContent = 'Limits';
    const hint = document.createElement('span'); hint.id = 'apple-hint';
    heading.append(title, hint); preview.append(heading);
    for (const [kind, label] of [['short', '5h'], ['weekly', '7d']]) {
      const row = document.createElement('div'); row.className = `apple-preview-row ${kind}`;
      const name = document.createElement('span'); name.textContent = label; name.className = 'metric-label';
      const bar = document.createElement('progress'); bar.max = 100; bar.id = `apple-${kind}-bar`;
      const value = document.createElement('span'); value.className = 'metric-value'; value.id = `apple-${kind}-value`;
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
    trigger.append(preview, resetHint); shell.append(cap, trigger, content, islandIndicators.header, notification, outline); body.append(shell);
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
      if (next.platform !== 'darwin') return;
      const t = key => window.limitsAppleI18n.t(next.language, key);
      renderPanel(updatedTime, t);
      if (!isNotch || !next.appleNotch) return;
      this.state = next;
      const layout = next.appleNotch;
      body.classList.toggle('apple-island', layout.mode === 'island');
      body.dataset.islandIndicators = layout.indicatorMode;
      body.dataset.notchHoverStyle = layout.hoverStyle;
      body.toggleAttribute('data-peek-values', layout.peekShowsValues);
      body.toggleAttribute('data-peek-fallback', layout.peekFallback);
      body.classList.toggle('apple-narrow-preview', layout.peekFallback && layout.closedWidth < 340);
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
      const loginNotice = document.getElementById('apple-login-notice');
      const noticeParent = document.querySelector('dialog[open] .settings-content') || document.querySelector('.apple-content main');
      if (loginNotice.parentElement !== noticeParent) noticeParent.prepend(loginNotice);
      loginNotice.hidden = !layout.browserOpening;
      loginNotice.textContent = t('browserOpening');
      trigger.setAttribute('aria-label', t('notchOpen'));
      islandIndicators.render(next, layout);
      document.getElementById('apple-hint').textContent = t('notchHint');
      window.limitsMetricElements?.compact(document.querySelector('.apple-preview'), next);
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets[0];
      for (const kind of ['short', 'weekly']) {
        const value = bucket?.[kind]?.remaining ?? null;
        document.getElementById(`apple-${kind}-value`).textContent = value === null ? '—' : `${value}%`;
        const meter = document.getElementById(`apple-${kind}-bar`);
        meter.value = value ?? 0;
        meter.hidden = !layout.peekFallback && layout.phase === 'peek' && value === null;
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
      const fallback = next.appleNotch.peekFallback;
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets[0];
      const hint = document.querySelector('.apple-preview-reset');
      const time = document.getElementById('apple-short-reset');
      const parent = fallback ? document.querySelector('.apple-preview-row.short .metric-label') : hint;
      if (time.parentElement !== parent) parent.append(time);
      const reset = next.displaySchema && next.displaySchema.layout !== 'quota-windows'
        ? window.limitsMetrics.view(next).primary?.resetsAt / 1000
        : bucket?.short?.resetsAt;
      hint.hidden = fallback || !Number.isFinite(reset) || reset <= 0;
      if (!hint.hidden) hint.firstElementChild.textContent = window.limitsI18n.t(next.language, 'resetIn');
      if (fallback || !hint.hidden) window.limitsCountdown.render(time, reset, next.language);
      if (fallback) window.limitsMetricElements?.countdowns(document.querySelector('.apple-preview'));
    }
  };
})();
