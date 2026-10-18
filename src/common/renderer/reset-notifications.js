'use strict';
(() => {
  const { words, eventText } = window.limitsResetStrings;
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  const section = make('section', window.limitsSettings.extensions, 'reset-section');
  const title = make('h3', section);
  const row = make('div', section, 'reset-toggle-row');
  const label = make('label', row, 'reset-toggle');
  const enabled = make('input', label); enabled.type = 'checkbox'; enabled.id = 'reset-notifications-enabled';
  const labelText = make('span', label);
  const helpButton = make('button', row, 'reset-help-button'); helpButton.type = 'button'; helpButton.textContent = '?';
  helpButton.id = 'reset-notifications-info'; helpButton.setAttribute('aria-expanded', 'false'); helpButton.setAttribute('aria-controls', 'reset-notifications-help');
  const help = make('div', section, 'reset-help'); help.id = 'reset-notifications-help'; help.hidden = true;
  const description = make('p', help);
  const thanks = make('p', help);
  const thanksStart = document.createTextNode(''); thanks.append(thanksStart);
  function link(parent, kind, text) {
    const node = make('a', parent); node.href = kind === 'site' ? 'https://codex-resets.com/' : 'https://x.com/wong2__'; node.textContent = text;
    node.onclick = event => { event.preventDefault(); void openLink(kind); };
    return node;
  }
  link(thanks, 'author', '@wong2__');
  const thanksEnd = document.createTextNode(''); thanks.append(thanksEnd);
  const source = make('p', section, 'reset-source'); const sourceText = document.createTextNode(''); source.append(sourceText);
  link(source, 'site', 'codex-resets.com');
  const result = make('p', section, 'reset-result'); result.id = 'reset-notifications-result'; result.setAttribute('role', 'status');
  const summary = make('p', section, 'reset-summary'); summary.id = 'reset-notifications-summary';
  summary.setAttribute('role', 'status');
  const checked = make('p', section, 'footnote'); checked.id = 'reset-notifications-checked';
  const error = make('p', section, 'reset-result warning'); error.setAttribute('role', 'status'); error.hidden = true;
  const demoRow = make('label', section, 'settings-row'); const demoLabel = make('span', demoRow);
  const demoSelect = make('select', demoRow); demoSelect.id = 'reset-notifications-demo';
  for (const scenario of ['quiet', 'scheduled', 'forecast', 'error']) { const option = make('option', demoSelect); option.value = scenario; }
  const demoHint = make('p', section, 'footnote');
  let current, saving = false, actionError = null;
  const text = () => words[current?.language] || words.en;
  function render(next) {
    current = next;
    const value = next.resetNotifications;
    if (!value) return;
    const t = text();
    title.textContent = t.title; labelText.textContent = t.enabled;
    enabled.checked = value.enabled; enabled.disabled = saving;
    helpButton.setAttribute('aria-label', t.help); helpButton.title = t.description;
    description.textContent = t.description; thanksStart.textContent = t.thanks; thanksEnd.textContent = t.thanksEnd; sourceText.textContent = t.source;
    const event = value.scheduled || value.watch;
    result.textContent = value.status === 'error' ? t[value.error] || t.checkFailed : value.status === 'ready' ?
      (value.scheduled ? t[value.scheduled.resetType === 'banked' ? 'banked' : 'scheduled'] : value.watch ? t.forecast : t.quiet) : t[value.status] || t.idle;
    result.classList.toggle('warning', value.status === 'error');
    result.hidden = value.enabled && value.status === 'ready' && Boolean(event);
    summary.hidden = !value.enabled || value.status !== 'ready' || !event;
    summary.textContent = summary.hidden ? '' : eventText(event, next.language);
    checked.hidden = !value.enabled || value.checkedAt === null;
    checked.textContent = checked.hidden ? '' : `${t.lastCheck}: ${new Date(value.checkedAt).toLocaleString(next.language === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
    const message = actionError || value.notificationError;
    error.hidden = !message; error.textContent = t[message] || '';
    demoRow.hidden = demoHint.hidden = !value.demo; demoLabel.textContent = t.demo; demoHint.textContent = t.simulated;
    demoSelect.value = value.demoScenario; demoSelect.disabled = !value.enabled;
    for (const option of demoSelect.options) option.textContent = t[{ quiet: 'demoQuiet', scheduled: 'demoScheduled', forecast: 'demoForecast', error: 'demoError' }[option.value]];
  }
  helpButton.onclick = () => { help.hidden = !help.hidden; helpButton.setAttribute('aria-expanded', String(!help.hidden)); };
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !help.hidden) { event.preventDefault(); event.stopPropagation(); help.hidden = true; helpButton.setAttribute('aria-expanded', 'false'); helpButton.focus(); }
  });
  async function openLink(kind) {
    actionError = null;
    try { const outcome = await window.limits.openResetLink(kind); actionError = outcome.error || null; }
    catch { actionError = 'openFailed'; }
    render(current);
  }
  enabled.onchange = async () => {
    const value = enabled.checked;
    saving = true; actionError = null; render(current);
    try {
      const next = await window.limits.setResetNotifications(value);
      current = { ...current, resetNotifications: next }; actionError = next.actionError || null;
    } catch { actionError = 'unavailable'; }
    saving = false; render(current);
  };
  demoSelect.onchange = async () => {
    actionError = null;
    try { const next = await window.limits.demoReset(demoSelect.value); if (next.actionError || next.error === 'unavailable') actionError = 'unavailable'; else current = { ...current, resetNotifications: next }; }
    catch { actionError = 'unavailable'; }
    render(current);
  };
  window.limits.subscribe(render);
  window.limitsResetNotificationsReady = window.limits.get().then(render);
})();
