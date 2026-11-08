'use strict';
(() => {
  const texts = {
    ru: { settings: 'Настройки', close: 'Закрыть настройки', widget: 'Настройки панели', width: 'Ширина', visible: 'Показывать виджет', reset: 'Сбросить положение', error: 'Не удалось изменить настройку. Попробуйте ещё раз.' },
    en: { settings: 'Settings', close: 'Close settings', widget: 'Panel settings', width: 'Width', visible: 'Show widget', reset: 'Reset position', error: 'Could not change this setting. Try again.' },
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
  const widgetSection = make('section', content, 'settings-widget');
  const widgetTitle = make('h3', widgetSection);
  const widthRow = make('label', widgetSection, 'settings-row'); const widthText = make('span', widthRow);
  const width = make('select', widthRow); width.id = 'settings-width';
  for (const value of [240, 280, 320, 400]) { const option = make('option', width); option.value = value; option.textContent = `${value} px`; }
  const resetDisplayRow = make('label', widgetSection, 'settings-row'); const resetDisplayText = make('span', resetDisplayRow);
  const resetDisplay = make('select', resetDisplayRow); resetDisplay.id = 'settings-widget-reset-display';
  for (const value of ['hidden', 'countdown', 'clock']) { const option = make('option', resetDisplay); option.value = value; }
  const resetDisplayHint = make('p', widgetSection, 'footnote'); resetDisplayHint.id = 'settings-widget-reset-hint'; resetDisplay.setAttribute('aria-describedby', resetDisplayHint.id);
  const visibleRow = make('label', widgetSection, 'settings-row'); const visibleText = make('span', visibleRow);
  const visible = make('input', visibleRow); visible.type = 'checkbox'; visible.id = 'settings-visible';
  const reset = make('button', widgetSection, 'refresh-button'); reset.type = 'button'; reset.id = 'settings-reset';
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
    widthText.textContent = t.width; visibleText.textContent = t.visible; reset.textContent = t.reset;
    const prefs = next.preferences;
    widgetSection.hidden = !prefs?.widgetSupported || next.displayMode !== 'widget';
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
