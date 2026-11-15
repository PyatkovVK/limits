'use strict';
(() => {
  const texts = {
    ru: { classic: 'Классические', digits: 'Цифры', rings: 'Кольца', line: 'Строка · XFCE', shelf: 'Полка · XFCE',
      xfce: 'Добавьте Genmon на панель. Команду можно скопировать из меню значка Limits' },
    en: { classic: 'Classic', digits: 'Digits', rings: 'Rings', line: 'Line · XFCE', shelf: 'Shelf · XFCE',
      xfce: 'Add Genmon to the panel. Copy its command from the Limits tray menu' },
  };
  function selection(next) {
    const t = texts[next.language] || texts.en;
    const { available, normalize, panel } = window.limitsLinuxTrayStyle;
    const xfce = Boolean(next.preferences?.xfcePanelAvailable);
    const value = normalize(next.preferences?.linuxTrayStyle, xfce);
    return {
      value,
      options: available(xfce).map(value => ({ value, label: t[value] })),
      ...(panel.includes(value) && { description: t.xfce }),
    };
  }
  (window.limitsPlatform ??= {}).displaySelection = selection;
})();
