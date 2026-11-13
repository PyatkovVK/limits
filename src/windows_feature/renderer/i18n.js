'use strict';
(function (root) {
  const strings = {
    ru: {
      connectAccount: 'Подключите аккаунт',
      chooseProvider: 'Выбрать провайдера',
      widgetShortCompact: '5ч',
      weeklyCompact: '7д',
      drag: 'Потяните за любую часть виджета, чтобы передвинуть его',
      footnote: 'Потяните за любую часть виджета, чтобы передвинуть его на панели задач.',
      widgetStyleLabel: 'Оформление виджета',
      widgetStyleClassic: 'Классический',
      widgetStyleRows: 'Строки',
      widgetStyleCells: 'Ячейки',
    },
    en: {
      connectAccount: 'Connect an account',
      chooseProvider: 'Choose a provider',
      widgetShortCompact: '5h',
      weeklyCompact: '7d',
      drag: 'Drag any part of the widget to move it',
      footnote: 'Drag any part of the widget to move it along the taskbar.',
      widgetStyleLabel: 'Widget style',
      widgetStyleClassic: 'Classic',
      widgetStyleRows: 'Rows',
      widgetStyleCells: 'Cells',
    },
  };
  const api = { t(language, key) { return (strings[language] || strings.ru)[key] || null; } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsWindowsI18n = api;
})(globalThis);
