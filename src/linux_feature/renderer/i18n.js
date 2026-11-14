'use strict';

(function (root) {
  const strings = {
    ru: {
      widgetShortCompact: '5ч',
      weeklyCompact: '7д',
      drag: 'Потяните за аккаунт, чтобы передвинуть виджет',
    },
    en: {
      widgetShortCompact: '5h',
      weeklyCompact: '7d',
      drag: 'Drag the account to move the widget',
    },
  };
  const api = {
    t(language, key) {
      return (strings[language] || strings.ru)[key] || null;
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsLinuxI18n = api;
})(globalThis);
