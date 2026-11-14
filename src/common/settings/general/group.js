'use strict';
(() => {
  const texts = {
    ru: { title: 'Главные', language: 'Язык интерфейса', display: 'Как показывать лимиты', startup: 'Запускать при входе', startupDescription: 'Автоматически запускать Limits после входа в систему', unavailable: 'Автозапуск сейчас недоступен' },
    en: { title: 'General', language: 'Interface language', display: 'How to show usage limits', startup: 'Launch at login', startupDescription: 'Start Limits automatically after you sign in', unavailable: 'Launch at login is currently unavailable' },
  };
  const languages = [{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }];

  /** @returns {SettingsGroup} */
  function describe(next, translate, { apply, close }) {
    const language = next.language || 'ru';
    const labels = texts[language] || texts.ru;
    const modes = next.displayModes || ['widget', 'tray'];
    const display = next.platform === 'linux'
      ? window.limitsLinuxDisplay.selection(next)
      : {
          value: next.displayMode || modes[0],
          options: modes.map(value => ({ value, label: translate(`${value}Mode`) })),
        };
    const startup = next.preferences?.startup;
    const hoverStyle = next.preferences?.islandHoverStyle || 'minimal';
    return {
      id: 'general-settings',
      title: labels.title,
      settings: [
        {
          id: 'language',
          kind: 'select',
          title: translate('language'),
          description: labels.language,
          value: language,
          options: languages,
          onChange: value => apply(window.limits.language(value)),
        },
        {
          id: 'display-mode',
          kind: 'select',
          title: translate('displayMode'),
          description: labels.display,
          ...display,
          disabled: display.options.length < 2,
          onChange: async value => {
            await apply(window.limits.displayMode(value));
            close();
          },
        },
        {
          id: 'island-hover-style',
          kind: 'select',
          title: translate('islandHoverStyle'),
          description: translate(hoverStyle === 'minimal' ? 'islandHoverMinimalDescription' : 'islandHoverInformativeDescription'),
          hidden: next.platform !== 'darwin' || !['notch', 'island'].includes(next.displayMode),
          value: hoverStyle,
          options: [
            { value: 'minimal', label: translate('islandHoverMinimal') },
            { value: 'informative', label: translate('islandHoverInformative') },
          ],
          onChange: value => apply(window.limits.preference('islandHoverStyle', value)),
        },
        {
          id: 'settings-startup',
          kind: 'toggle',
          title: labels.startup,
          description: startup?.available ? labels.startupDescription : labels.unavailable,
          value: Boolean(startup?.enabled),
          disabled: !startup?.available,
          onChange: value => apply(window.limits.preference('startup', value)),
        },
      ],
    };
  }

  window.limitsGeneralSettings = { describe };
})();
