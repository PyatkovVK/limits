'use strict';
(() => {
  const texts = {
    ru: { classic: 'Значки в трее', bar: 'Полоски в трее' },
    en: { classic: 'Tray icons', bar: 'Tray bars' },
  };
  function selection(next) {
    const t = texts[next.language] || texts.en;
    return {
      value: next.preferences?.linuxTrayStyle || 'classic',
      options: ['classic', 'bar'].map(value => ({ value, label: t[value] })),
    };
  }
  (window.limitsPlatform ??= {}).displaySelection = selection;
})();
