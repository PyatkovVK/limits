'use strict';
(() => {
  const texts = {
    ru: { settings: 'Настройки', close: 'Закрыть настройки', language: 'Язык', widget: 'Виджет Windows', width: 'Ширина', visible: 'Показывать виджет', reset: 'Сбросить положение', startup: 'Запускать при входе в систему', installed: 'Автозапуск доступен в установленной версии.', error: 'Не удалось изменить настройку. Попробуйте ещё раз.' },
    en: { settings: 'Settings', close: 'Close settings', language: 'Language', widget: 'Windows widget', width: 'Width', visible: 'Show widget', reset: 'Reset position', startup: 'Launch at login', installed: 'Autostart is available in the installed app.', error: 'Could not change this setting. Try again.' },
  };
  let current;
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  const button = make('button', null, 'settings-button'); button.id = 'settings-button'; button.type = 'button';
  document.querySelector('.titlebar').insertBefore(button, document.getElementById('hide'));
  const dialog = make('dialog', document.body); dialog.id = 'settings-dialog'; dialog.setAttribute('aria-labelledby', 'settings-title');
  const header = make('div', dialog, 'settings-header');
  const title = make('h2', header); title.id = 'settings-title';
  const close = make('button', header, 'settings-close'); close.type = 'button'; close.textContent = '×';
  const content = make('div', dialog, 'settings-content');
  const languageRow = make('label', content, 'settings-row'); const languageText = make('span', languageRow);
  languageRow.append(document.getElementById('language'));
  content.append(document.querySelector('.display-settings'), document.getElementById('display-hint'));
  const widgetSection = make('section', content, 'settings-widget');
  const widgetTitle = make('h3', widgetSection);
  const widthRow = make('label', widgetSection, 'settings-row'); const widthText = make('span', widthRow);
  const width = make('select', widthRow); width.id = 'settings-width';
  for (const value of [240, 280, 320, 400]) { const option = make('option', width); option.value = value; option.textContent = `${value} px`; }
  const visibleRow = make('label', widgetSection, 'settings-row'); const visibleText = make('span', visibleRow);
  const visible = make('input', visibleRow); visible.type = 'checkbox'; visible.id = 'settings-visible';
  const reset = make('button', widgetSection, 'refresh-button'); reset.type = 'button'; reset.id = 'settings-reset';
  const startupRow = make('label', content, 'settings-row'); const startupText = make('span', startupRow);
  const startup = make('input', startupRow); startup.type = 'checkbox'; startup.id = 'settings-startup';
  const startupHint = make('p', content, 'footnote');
  const extensions = make('div', content); extensions.id = 'settings-extensions';
  for (const section of document.querySelectorAll('[data-setting-section]')) extensions.append(section);
  content.append(document.querySelector('.accounts-section'));
  const error = make('p', content, 'notice warning'); error.setAttribute('role', 'status'); error.hidden = true;
  function render(next) {
    current = next;
    if (dialog.open && document.body.classList.contains('apple-notch') && next.appleNotch?.phase !== 'expanded') dialog.close();
    const t = texts[next.language] || texts.en;
    button.textContent = t.settings; button.title = t.settings;
    title.textContent = t.settings; close.setAttribute('aria-label', t.close);
    languageText.textContent = t.language; widgetTitle.textContent = next.platform === 'linux' ? next.language === 'ru' ? 'Виджет Linux' : 'Linux widget' : t.widget;
    widthText.textContent = t.width; visibleText.textContent = t.visible; reset.textContent = t.reset;
    startupText.textContent = t.startup; startupHint.textContent = t.installed;
    const prefs = next.preferences;
    widgetSection.hidden = !prefs?.widgetSupported;
    width.value = String(prefs?.width || 280); visible.checked = prefs?.visible !== false;
    width.disabled = visible.disabled = reset.disabled = next.displayMode !== 'widget';
    startupRow.hidden = !prefs?.startup.supported;
    startup.checked = Boolean(prefs?.startup.enabled); startup.disabled = !prefs?.startup.available;
    startupHint.hidden = !prefs?.startup.supported || prefs.startup.available;
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
  document.getElementById('display-mode').addEventListener('change', () => dialog.close());
  async function change(key, value) {
    error.hidden = true;
    try { const next = await window.limits.preference(key, value); render(next); if (next.preferenceError) throw new Error(); }
    catch { error.textContent = (texts[current?.language] || texts.en).error; error.hidden = false; }
  }
  width.onchange = () => change('width', Number(width.value));
  visible.onchange = () => change('visible', visible.checked);
  startup.onchange = () => change('startup', startup.checked);
  reset.onclick = () => change('resetPosition');
  window.limits.onSettingsOpen(open);
  window.limits.subscribe(render);
  window.limits.get().then(render);
  window.limitsSettings = { open, dialog, extensions };
})();
