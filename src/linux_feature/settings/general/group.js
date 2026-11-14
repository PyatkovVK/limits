'use strict';
(() => {
  const texts = {
    ru: { classic: 'Значки в трее', bar: 'Полоски в трее' },
    en: { classic: 'Tray icons', bar: 'Tray bars' },
  };
  function selection(next, modes, translate) {
    const t = texts[next.language] || texts.en;
    return {
      value: next.displayMode === 'widget' ? 'widget' : next.preferences?.linuxTrayStyle || 'classic',
      options: modes.flatMap(mode => mode === 'tray' ? ['classic', 'bar'] : [mode])
        .map(value => ({ value, label: t[value] || translate(`${value}Mode`) })),
    };
  }
  window.limitsLinuxDisplay = { selection };
})();
