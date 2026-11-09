'use strict';
(function (root) {
  const strings = {
    ru: {
      islandMode: 'Вокруг чёлки',
      islandHoverStyle: 'При наведении', islandHoverMinimal: 'Минималистичный', islandHoverInformative: 'Информативный',
      islandHoverMinimalDescription: 'Шкалы под показателями', islandHoverInformativeDescription: 'Шкалы и время до сброса под показателями',
      shortPeriod: '5 часов', weeklyPeriod: '7 дней',
      islandDismiss: 'Закрыть уведомление', islandSource: 'Открыть источник', islandUpdateAction: 'Посмотреть обновление',
      islandUpdate: 'Доступно обновление Limits', islandVersion: 'Новая версия:',
      islandMore: 'Показать остальные показатели',
      browserOpening: 'Сейчас откроется браузер. Завершите вход там — чёлка свернётся автоматически.',
      inWidget: 'В строке меню', useWidget: 'В строку меню',
      startup: 'Запускать при входе в macOS', tooltip: 'Limits · строка меню',
      trayMode: 'Строка меню',
      accountsHint: 'В строке меню показаны лимиты выбранного аккаунта. Остальные аккаунты — ниже.',
      notchMode: 'Чёлка',
      notchOpen: 'Открыть лимиты', notchHint: 'Нажмите, чтобы открыть', notchClose: 'Свернуть к чёлке',
      inNotch: 'В чёлке', useNotch: 'В чёлку', notchAccounts: 'Чёлка показывает лимиты выбранного аккаунта. Остальные аккаунты — ниже.'
    },
    en: {
      islandMode: 'Around the notch',
      islandHoverStyle: 'On hover', islandHoverMinimal: 'Minimal', islandHoverInformative: 'Informative',
      islandHoverMinimalDescription: 'Bars below the indicators', islandHoverInformativeDescription: 'Bars and time until reset below the indicators',
      shortPeriod: '5 hours', weeklyPeriod: '7 days',
      islandDismiss: 'Dismiss notification', islandSource: 'Open source', islandUpdateAction: 'View update',
      islandUpdate: 'A Limits update is available', islandVersion: 'New version:',
      islandMore: 'Show more metrics',
      browserOpening: 'Your browser will open. Complete sign-in there; the notch will collapse automatically.',
      inWidget: 'In menu bar', useWidget: 'Use in menu bar',
      startup: 'Launch at macOS login', tooltip: 'Limits · menu bar',
      trayMode: 'Menu bar',
      accountsHint: 'The menu bar shows limits for the selected account. Other accounts appear below.',
      notchMode: 'Notch',
      notchOpen: 'Open limits', notchHint: 'Click to open', notchClose: 'Collapse to notch',
      inNotch: 'In notch', useNotch: 'Use in notch', notchAccounts: 'The notch shows limits for the selected account. Other accounts appear below.'
    }
  };
  const api = { t(language, key) { return (strings[language] || strings.ru)[key] || null; } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsAppleI18n = api;
})(globalThis);
