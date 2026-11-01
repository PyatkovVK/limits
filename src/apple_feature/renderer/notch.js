'use strict';
(function () {
  const isNotch = new URLSearchParams(location.search).get('apple') === 'notch';
  const body = document.body;
  let islandIndicators;
  // This option belongs only to the macOS adapter; shared hosts filter it out.
  const islandOption = document.createElement('option');
  islandOption.value = 'island'; islandOption.dataset.i18n = 'islandMode'; islandOption.hidden = islandOption.disabled = true;
  document.getElementById('display-mode').append(islandOption);
  if (isNotch) {
    body.classList.add('apple-notch');
    const content = document.createElement('div');
    content.className = 'apple-content'; content.inert = true;
    content.append(...body.children);
    const shell = document.createElement('div'); shell.className = 'apple-shell';
    const cap = document.createElement('div'); cap.className = 'apple-cap'; cap.setAttribute('aria-hidden', 'true');
    const meters = document.createElement('div'); meters.className = 'apple-mini';
    for (const kind of ['short', 'weekly']) {
      const progress = document.createElement('progress'); progress.className = `apple-mini-${kind}`; progress.max = 100;
      meters.append(progress);
    }
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
    trigger.append(meters, preview); shell.append(cap, trigger, content, islandIndicators.header, notification); body.append(shell);
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
        if (next.displayMode === 'island') keys.footnote = 'islandFootnote';
        key = keys[key] || key;
      }
      return window.limitsAppleI18n.t(language, key);
    },
    render(next) {
      if (!isNotch || !next.appleNotch) return;
      this.state = next;
      const layout = next.appleNotch;
      body.classList.toggle('apple-island', layout.mode === 'island');
      body.dataset.notchPhase = layout.phase;
      body.classList.toggle('reduced-motion', Boolean(next.reducedMotion));
      const properties = { 'cap-height': layout.capHeight, 'content-top': layout.contentTop, 'menu-bar-width': layout.menuBarWidth, 'meters-top': layout.metersTop, 'meters-height': layout.metersHeight, 'full-width': layout.fullWidth, 'full-height': layout.fullHeight, 'closed-width': layout.closedWidth, 'closed-height': layout.closedHeight, 'peek-width': layout.peekWidth, 'peek-height': layout.peekHeight, 'notification-width': layout.notificationWidth, 'notification-height': layout.notificationHeight };
      for (const [name, value] of Object.entries(properties)) body.style.setProperty(`--${name}`, `${value}px`);
      const expanded = layout.phase === 'expanded';
      document.querySelector('.apple-content').inert = !expanded;
      const trigger = document.getElementById('apple-trigger');
      trigger.tabIndex = expanded || layout.mode === 'island' ? -1 : 0;
      trigger.setAttribute('aria-expanded', String(expanded));
      trigger.inert = layout.phase === 'notification' || expanded;
      const t = key => window.limitsAppleI18n.t(next.language, key);
      const loginNotice = document.getElementById('apple-login-notice');
      const noticeParent = document.querySelector('dialog[open] .settings-content') || document.querySelector('.apple-content main');
      if (loginNotice.parentElement !== noticeParent) noticeParent.prepend(loginNotice);
      loginNotice.hidden = !layout.browserOpening;
      loginNotice.textContent = t('browserOpening');
      trigger.setAttribute('aria-label', t('notchOpen'));
      islandIndicators.render(next, layout);
      document.getElementById('apple-hint').textContent = t('notchHint');
      window.limitsMetricElements?.compact(document.querySelector('.apple-preview'), next);
      window.limitsMetricElements?.compact(document.querySelector('.apple-mini'), next);
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
      for (const kind of ['short', 'weekly']) {
        const value = bucket?.[kind]?.remaining ?? null;
        document.getElementById(`apple-${kind}-value`).textContent = value === null ? '—' : `${value}%`;
        document.getElementById(`apple-${kind}-bar`).value = value ?? 0;
        document.querySelector(`.apple-mini-${kind}`).value = value ?? 0;
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
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
      window.limitsCountdown.render(document.getElementById('apple-short-reset'), bucket?.short?.resetsAt, next.language);
    }
  };
})();
