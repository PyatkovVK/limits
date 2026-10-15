'use strict';
(function (root) {
  const strings = {
    ru: {
      browserOpening: 'Сейчас откроется браузер. Завершите вход там — чёлка свернётся автоматически.',
      inWidget: 'В строке меню', useWidget: 'В строку меню',
      startup: 'Запускать при входе в macOS', tooltip: 'Limits · строка меню',
      trayMode: 'Две полоски в строке меню',
      accountsHint: 'В строке меню показаны лимиты выбранного аккаунта. Остальные аккаунты — ниже.',
      trayFootnote: '5h — пятичасовой лимит, 7d — недельный. Рядом с 5h — время до сброса в часах и минутах. Нажмите на полоску, чтобы открыть панель.',
      notchMode: 'Чёлка · Apple', notchFootnote: 'Наведите на чёлку, чтобы увидеть лимиты. Нажмите, чтобы открыть панель. Esc — свернуть.',
      notchOpen: 'Открыть лимиты', notchHint: 'Нажмите, чтобы открыть', notchClose: 'Свернуть к чёлке',
      inNotch: 'В чёлке', useNotch: 'В чёлку', notchAccounts: 'Чёлка показывает лимиты выбранного аккаунта. Остальные аккаунты — ниже.'
    },
    en: {
      browserOpening: 'Your browser will open. Complete sign-in there; the notch will collapse automatically.',
      inWidget: 'In menu bar', useWidget: 'Use in menu bar',
      startup: 'Launch at macOS login', tooltip: 'Limits · menu bar',
      trayMode: 'Two menu bar indicators',
      accountsHint: 'The menu bar shows limits for the selected account. Other accounts appear below.',
      trayFootnote: '5h is the five-hour limit; 7d is the weekly limit. The timer beside 5h shows hours and minutes until reset. Click either bar to open the panel.',
      notchMode: 'Notch · Apple', notchFootnote: 'Hover over the notch to preview limits. Click to open the panel. Press Esc to collapse.',
      notchOpen: 'Open limits', notchHint: 'Click to open', notchClose: 'Collapse to notch',
      inNotch: 'In notch', useNotch: 'Use in notch', notchAccounts: 'The notch shows limits for the selected account. Other accounts appear below.'
    }
  };
  const api = { t(language, key) { return (strings[language] || strings.ru)[key] || null; } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsAppleI18n = api;
})(globalThis);
