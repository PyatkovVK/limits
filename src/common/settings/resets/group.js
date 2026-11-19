'use strict';
(() => {
  const { words, eventDetails } = window.limitsResetStrings;
  const make = (parent, tag, className = '') => {
    const node = document.createElement(tag);
    node.className = className;
    parent.append(node);
    return node;
  };
  const section = make(window.limitsSettings.extensions, 'section', 'settings-group reset-section');
  section.hidden = true;
  const title = make(section, 'h3'); title.id = 'reset-settings-title';
  section.setAttribute('aria-labelledby', title.id);
  const card = make(section, 'div', 'settings-group-card');
  const row = make(card, 'div', 'settings-item reset-toggle-row');
  const copy = make(row, 'div', 'settings-item-copy');
  const label = make(copy, 'label', 'reset-toggle'); label.htmlFor = 'reset-notifications-enabled';
  const hint = make(copy, 'p', 'settings-item-description'); hint.id = 'reset-notifications-hint';
  const enabled = make(row, 'input', 'settings-item-toggle');
  enabled.type = 'checkbox'; enabled.id = label.htmlFor;
  enabled.setAttribute('role', 'switch');
  enabled.setAttribute('aria-describedby', hint.id);

  const status = make(card, 'div', 'settings-item reset-status'); status.id = 'reset-notifications-status';
  status.hidden = true;
  const announcement = make(status, 'div');
  announcement.setAttribute('role', 'status');
  const result = make(announcement, 'div', 'reset-result'); result.id = 'reset-notifications-result';
  const detail = make(announcement, 'p', 'settings-item-description'); detail.id = 'reset-notifications-summary';
  const checked = make(status, 'p', 'settings-item-description'); checked.id = 'reset-notifications-checked';
  const error = make(card, 'p', 'settings-item-error'); error.setAttribute('role', 'status');

  const source = make(card, 'div', 'reset-source');
  const summary = make(source, 'button', 'reset-source-toggle'); summary.id = 'reset-notifications-info'; summary.type = 'button';
  summary.setAttribute('aria-controls', 'reset-notifications-help');
  summary.setAttribute('aria-expanded', 'false');
  const help = make(source, 'div', 'reset-help'); help.id = 'reset-notifications-help';
  help.hidden = true;
  const description = make(help, 'p');
  function link(parent, kind, text) {
    const node = make(parent, 'a');
    node.href = kind === 'site' ? 'https://codex-resets.com/' : 'https://x.com/wong2__';
    node.textContent = text;
    node.onclick = event => { event.preventDefault(); void openLink(kind); };
  }
  const attribution = make(help, 'p');
  const attributionLabel = document.createTextNode('');
  attribution.append(attributionLabel);
  link(attribution, 'site', 'codex-resets.com');
  const thanks = make(help, 'p');
  const thanksStart = document.createTextNode(''), thanksEnd = document.createTextNode('');
  thanks.append(thanksStart);
  link(thanks, 'author', '@wong2__');
  thanks.append(thanksEnd);

  let current, saving = false, actionError = null;
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }
  function render(next) {
    current = next;
    const value = next.resetNotifications;
    // Every installation has a default Codex profile, even before sign-in.
    section.hidden = !value || !next.profiles?.some(profile => profile.providerId === 'codex' && profile.account?.type === 'chatgpt');
    if (section.hidden) return;
    const t = words[next.language] || words.en;
    setText(title, t.title);
    setText(label, t.enabled);
    setText(hint, t.enabledDescription);
    if (!saving) enabled.checked = value.enabled;
    enabled.disabled = saving;
    setText(summary, t.help);
    setText(description, t.description);
    attributionLabel.data = t.source;
    thanksStart.data = t.thanks; thanksEnd.data = t.thanksEnd;

    status.hidden = !value.enabled;
    const event = value.status === 'ready' ? value.scheduled || value.watch : null;
    const eventDisplay = event && eventDetails(event, next.language);
    setText(result, eventDisplay?.title || (value.status === 'error' ? t[value.error] || t.checkFailed : t[value.status === 'ready' ? 'quiet' : value.status] || t.idle));
    result.classList.toggle('warning', value.status === 'error');
    detail.hidden = !eventDisplay;
    setText(detail, eventDisplay?.description || '');
    checked.hidden = value.checkedAt == null || value.status === 'checking' || value.status === 'error';
    setText(checked, checked.hidden ? '' : `${t.lastCheck}: ${new Date(value.checkedAt).toLocaleString(next.language === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}`);
    setText(error, t[actionError || value.notificationError] || '');
  }

  function showSource(open) {
    help.hidden = !open;
    summary.setAttribute('aria-expanded', String(open));
  }
  summary.onclick = () => showSource(help.hidden);
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !help.hidden) {
      event.preventDefault();
      event.stopPropagation();
      showSource(false);
      summary.focus();
    }
  });
  async function openLink(kind) {
    actionError = null;
    try { const outcome = await window.limits.openResetLink(kind); actionError = outcome.error || null; }
    catch { actionError = 'openFailed'; }
    render(current);
  }
  enabled.onchange = async () => {
    if (saving) return;
    const value = enabled.checked;
    saving = true; actionError = null; render(current);
    try {
      const next = await window.limits.setResetNotifications(value);
      current = { ...current, resetNotifications: next }; actionError = next.actionError || null;
    } catch { actionError = 'unavailable'; }
    saving = false; render(current);
  };
  window.limits.subscribe(render);
  window.limitsResetNotificationsReady = window.limits.get().then(render);
})();
