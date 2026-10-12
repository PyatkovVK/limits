'use strict';
(() => {
  const texts = {
    ru: { title: 'Значки в трее', bar: 'Полоска · 5ч / 7д', classic: 'Прежний вид · проценты', error: 'Не удалось изменить вид значков.' },
    en: { title: 'Tray icons', bar: 'Bar · 5h / 7d', classic: 'Classic · percentages', error: 'Could not change the tray icons.' },
  };
  let controls, language = 'ru';
  function render(next) {
    if (next.platform !== 'linux') return;
    language = next.language || 'ru';
    if (!controls) {
      const section = document.createElement('section'); section.dataset.settingSection = 'linux-tray';
      const row = document.createElement('label'); row.className = 'settings-row linux-tray-style';
      const title = document.createElement('span');
      const select = document.createElement('select'); select.id = 'settings-tray-style';
      for (const value of ['bar', 'classic']) { const option = document.createElement('option'); option.value = value; select.append(option); }
      const error = document.createElement('p'); error.className = 'notice warning'; error.setAttribute('role', 'status'); error.hidden = true;
      row.append(title, select); section.append(row, error);
      window.limitsSettings.extensions.prepend(section);
      controls = { title, select, error };
      select.onchange = async () => {
        error.hidden = true;
        try {
          const updated = await window.limits.preference('linuxTrayStyle', select.value);
          render(updated);
          if (updated.preferenceError) throw new Error();
        } catch {
          error.textContent = (texts[language] || texts.en).error;
          error.hidden = false;
        }
      };
    }
    const t = texts[language] || texts.en;
    controls.title.textContent = t.title;
    controls.select.options[0].textContent = t.bar;
    controls.select.options[1].textContent = t.classic;
    controls.select.value = next.preferences?.linuxTrayStyle || 'classic';
  }
  window.limits.subscribe(render);
  window.limits.get().then(render);
})();
