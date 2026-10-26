'use strict';
(() => {
  const texts = {
    ru: { classic: 'Прежние значки · проценты', bar: 'Полоски · 5ч / 7д', widget: 'Виджет на рабочем столе' },
    en: { classic: 'Classic icons · percentages', bar: 'Bars · 5h / 7d', widget: 'Desktop widget' },
  };
  function render(next) {
    if (next.platform !== 'linux') return false;
    const select = document.getElementById('display-mode');
    if (!select.dataset.linuxDisplay) {
      const options = ['classic', 'bar', 'widget'].map(value => {
        const option = document.createElement('option'); option.value = value; return option;
      });
      select.replaceChildren(...options);
      select.dataset.linuxDisplay = 'true';
    }
    const t = texts[next.language] || texts.en;
    for (const option of select.options) if (option.textContent !== t[option.value]) option.textContent = t[option.value];
    select.value = next.displayMode === 'widget' ? 'widget' : next.preferences?.linuxTrayStyle || 'classic';
    select.closest('.display-settings').hidden = false;
    return true;
  }
  window.limitsLinuxDisplay = { render };
})();
