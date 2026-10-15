'use strict';
(function () {
  const isNotch = new URLSearchParams(location.search).get('apple') === 'notch';
  const body = document.body;
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
    trigger.append(meters, preview); shell.append(cap, trigger, content); body.append(shell);
    const loginNotice = document.createElement('div');
    loginNotice.id = 'apple-login-notice'; loginNotice.className = 'notice'; loginNotice.setAttribute('role', 'status'); loginNotice.hidden = true;
    content.querySelector('main').prepend(loginNotice);
    trigger.addEventListener('click', () => window.limits.open());
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); window.limits.hide(); } });
    setInterval(() => { if (window.limitsApple?.state) window.limitsApple.renderCountdown(); }, 1000);
  }
  window.limitsApple = {
    translate(language, key, next) {
      if (next.displayMode === 'notch') {
        const keys = { inWidget: 'inNotch', useWidget: 'useNotch', accountsHint: 'notchAccounts', close: 'notchClose' };
        key = keys[key] || key;
      }
      return window.limitsAppleI18n.t(language, key);
    },
    render(next) {
      if (!isNotch || !next.appleNotch) return;
      this.state = next;
      const layout = next.appleNotch;
      body.dataset.notchPhase = layout.phase;
      body.classList.toggle('reduced-motion', Boolean(next.reducedMotion));
      const properties = { 'cap-height': layout.capHeight, 'full-width': layout.fullWidth, 'full-height': layout.fullHeight, 'closed-width': layout.closedWidth, 'closed-height': layout.closedHeight, 'peek-width': layout.peekWidth, 'peek-height': layout.peekHeight };
      for (const [name, value] of Object.entries(properties)) body.style.setProperty(`--${name}`, `${value}px`);
      const expanded = layout.phase === 'expanded';
      document.querySelector('.apple-content').inert = !expanded;
      const trigger = document.getElementById('apple-trigger');
      trigger.tabIndex = expanded ? -1 : 0;
      trigger.setAttribute('aria-expanded', String(expanded));
      const t = key => window.limitsAppleI18n.t(next.language, key);
      const loginNotice = document.getElementById('apple-login-notice');
      const noticeParent = document.querySelector('dialog[open] .settings-content') || document.querySelector('.apple-content main');
      if (loginNotice.parentElement !== noticeParent) noticeParent.prepend(loginNotice);
      loginNotice.hidden = !layout.browserOpening;
      loginNotice.textContent = t('browserOpening');
      trigger.setAttribute('aria-label', t('notchOpen'));
      document.getElementById('apple-hint').textContent = t('notchHint');
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
      for (const kind of ['short', 'weekly']) {
        const value = bucket?.[kind]?.remaining ?? null;
        document.getElementById(`apple-${kind}-value`).textContent = value === null ? '—' : `${value}%`;
        document.getElementById(`apple-${kind}-bar`).value = value ?? 0;
        document.querySelector(`.apple-mini-${kind}`).value = value ?? 0;
        document.querySelector(`.apple-preview-row.${kind}`).classList.toggle('low', value !== null && value <= 10);
      }
      this.renderCountdown();
    },
    renderCountdown() {
      const next = this.state;
      const bucket = next.buckets.find(item => item.id === next.selectedId) || next.buckets.find(item => item.id === 'codex') || next.buckets[0];
      window.limitsCountdown.render(document.getElementById('apple-short-reset'), bucket?.short?.resetsAt, next.language);
    }
  };
})();
