'use strict';
(function (root) {
  const strings = {
    ru: {
      inWidget: 'В строке меню', useWidget: 'В строку меню',
      startup: 'Запускать при входе в macOS', tooltip: 'Limits · строка меню',
      trayMode: 'Две полоски в строке меню',
      accountsHint: 'В строке меню показаны лимиты выбранного аккаунта. Остальные аккаунты — ниже.',
      trayFootnote: '5h — пятичасовой лимит, 7d — недельный. Нажмите на полоску, чтобы открыть панель.'
    },
    en: {
      inWidget: 'In menu bar', useWidget: 'Use in menu bar',
      startup: 'Launch at macOS login', tooltip: 'Limits · menu bar',
      trayMode: 'Two menu bar indicators',
      accountsHint: 'The menu bar shows limits for the selected account. Other accounts appear below.',
      trayFootnote: '5h is the five-hour limit; 7d is the weekly limit. Click either bar to open the panel.'
    }
  };
  const api = { t(language, key) { return (strings[language] || strings.ru)[key] || null; } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsMacI18n = api;
})(globalThis);
