'use strict';
(function (root) {
  const strings = {
    ru: {
      weeklyCompact: '7д',
      drag: 'Потяните за любую часть виджета, чтобы передвинуть его',
      footnote: 'Потяните за любую часть виджета, чтобы передвинуть его на панели задач.',
    },
    en: {
      weeklyCompact: '7d',
      drag: 'Drag any part of the widget to move it',
      footnote: 'Drag any part of the widget to move it along the taskbar.',
    },
  };
  const api = { t(language, key) { return (strings[language] || strings.ru)[key] || null; } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsWindowsI18n = api;
})(globalThis);
