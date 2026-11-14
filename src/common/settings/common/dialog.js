'use strict';
(() => {
  const texts = {
    ru: { settings: 'Настройки', close: 'Закрыть настройки', widget: 'Настройки панели', width: 'Ширина', widthHint: 'Размер виджета на рабочем столе', visible: 'Показать виджет', position: 'Положение', reset: 'Сбросить', error: 'Не удалось изменить настройку. Попробуйте ещё раз.' },
    en: { settings: 'Settings', close: 'Close settings', widget: 'Panel settings', width: 'Width', widthHint: 'Size of the desktop widget', visible: 'Show widget', position: 'Position', reset: 'Reset', error: 'Could not change this setting. Try again.' },
  };
  const resetTexts = {
    ru: { label: 'Время сброса', hidden: 'Не отображать', countdown: 'Время до сброса', clock: 'Дата и время', hint: 'Отсчёт: 5ч — часы:минуты; 7д — дни:часы:минуты.' },
    en: { label: 'Widget reset times', hidden: 'Do not show', countdown: 'Time until reset', clock: 'Date and time', hint: 'Countdown: 5h — hours:minutes; 7d — days:hours:minutes.' },
  };
  const groups = [window.limitsGeneralSettings.describe].map(describe => ({ describe, view: null }));
  let current;
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  const button = make('button', null, 'settings-button'); button.id = 'settings-button'; button.type = 'button';
  document.querySelector('.titlebar').insertBefore(button, document.getElementById('hide'));
  const dialog = make('dialog', document.body); dialog.id = 'settings-dialog'; dialog.setAttribute('aria-labelledby', 'settings-title');
  const header = make('div', dialog, 'settings-header');
  const title = make('h2', header); title.id = 'settings-title';
  const close = make('button', header, 'settings-close'); close.type = 'button';
  const content = make('div', dialog, 'settings-content');
  const widgetSection = make('section', content, 'settings-group settings-widget');
  const widgetTitle = make('h3', widgetSection); widgetTitle.id = 'settings-widget-title';
  widgetSection.setAttribute('aria-labelledby', widgetTitle.id);
  const widgetCard = make('div', widgetSection, 'settings-group-card');
  function widgetRow(id, kind, hasHint = false) {
    const row = make('div', widgetCard, 'settings-item');
    const copy = make('div', row, 'settings-item-copy');
    const label = make('label', copy); label.htmlFor = id;
    const control = kind === 'select'
      ? make('select', make('div', row, 'settings-item-select'))
      : make(kind, row, kind === 'input' ? 'settings-item-toggle' : 'refresh-button');
    control.id = id;
    const hint = hasHint ? make('p', copy, 'settings-item-description') : null;
    if (hint) {
      hint.id = `${id}-hint`;
      control.setAttribute('aria-describedby', hint.id);
    }
    return { row, label, control, hint };
  }
  const { label: visibleText, control: visible } = widgetRow('settings-visible', 'input');
  visible.type = 'checkbox'; visible.setAttribute('role', 'switch');
  const { label: widthText, control: width, hint: widthHint } = widgetRow('settings-width', 'select', true);
  for (const value of [240, 280, 320, 400]) { const option = make('option', width); option.value = value; option.textContent = `${value} px`; }
  const { row: resetDisplayRow, label: resetDisplayText, control: resetDisplay, hint: resetDisplayHint } =
    widgetRow('settings-widget-reset-display', 'select', true);
  for (const value of ['hidden', 'countdown', 'clock']) { const option = make('option', resetDisplay); option.value = value; }
  const { label: positionText, control: reset } = widgetRow('settings-reset', 'button');
  reset.type = 'button';
  let renderWidgetSettings;
  const extensions = make('div', content); extensions.id = 'settings-extensions';
  for (const section of document.querySelectorAll('[data-setting-section]')) extensions.append(section);
  content.append(document.querySelector('.accounts-section'));
  const error = make('p', content, 'notice warning'); error.setAttribute('role', 'status'); error.hidden = true;
  async function apply(request) {
    const next = await request;
    render(next);
    if (next.preferenceError) throw new Error(next.preferenceError);
  }
  const groupActions = { apply, close: () => dialog.close() };
  function renderSettings(next, translate) {
    current = next;
    if (dialog.open && document.body.classList.contains('apple-notch') && next.appleNotch?.phase !== 'expanded') dialog.close();
    const t = texts[next.language] || texts.en;
    for (const group of groups) {
      const definition = group.describe(next, translate, groupActions);
      if (!group.view) {
        group.view = window.limitsSettingsGroup.create(definition);
        content.insertBefore(group.view.section, widgetSection);
      }
      group.view.update(definition, t.error);
    }
    const resetT = resetTexts[next.language] || resetTexts.en;
    resetDisplayText.textContent = resetT.label;
    for (const option of resetDisplay.options) option.textContent = resetT[option.value];
    resetDisplay.value = next.preferences?.widgetResetDisplay || 'clock';
    resetDisplayRow.hidden = next.platform !== 'win32';
    resetDisplayHint.textContent = resetT.hint;
    resetDisplayHint.hidden = next.platform !== 'win32' || resetDisplay.value !== 'countdown';
    button.textContent = t.settings; button.title = t.settings;
    title.textContent = t.settings; close.setAttribute('aria-label', t.close);
    widgetTitle.textContent = t.widget;
    widthText.textContent = t.width; widthHint.textContent = t.widthHint; visibleText.textContent = t.visible;
    positionText.textContent = t.position; reset.textContent = t.reset;
    reset.setAttribute('aria-label', `${t.reset} — ${t.position.toLowerCase()}`);
    const prefs = next.preferences;
    widgetSection.hidden = !prefs?.widgetSupported || next.displayMode !== 'widget';
    renderWidgetSettings ??= window.limitsPlatform?.createWidgetSettings?.(widgetCard, change);
    renderWidgetSettings?.(next);
    width.value = String(prefs?.width || 280); visible.checked = prefs?.visible !== false;
    width.disabled = visible.disabled = reset.disabled = next.displayMode !== 'widget';
  }
  let pendingOpen = false;
  function open() {
    if (dialog.open) return;
    if (document.querySelector('dialog[open]')) { pendingOpen = true; return; }
    pendingOpen = false;
    dialog.showModal();
  }
  document.addEventListener('close', () => { if (pendingOpen) open(); }, true);
  button.onclick = open; close.onclick = () => dialog.close();
  // Keep Escape inside the modal so the notch host does not collapse behind it.
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  async function change(key, value) {
    error.hidden = true;
    try { await apply(window.limits.preference(key, value)); }
    catch { error.textContent = (texts[current?.language] || texts.en).error; error.hidden = false; }
  }
  width.onchange = () => change('width', Number(width.value));
  resetDisplay.onchange = () => change('widgetResetDisplay', resetDisplay.value);
  visible.onchange = () => change('visible', visible.checked);
  reset.onclick = () => change('resetPosition');
  window.limits.onSettingsOpen(open);
  window.limitsSettings = { open, dialog, extensions, render: renderSettings };
})();
