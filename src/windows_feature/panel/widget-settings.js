'use strict';

window.limitsWindowsWidgetSettings = {
  create(card, change) {
    const { styles, normalize } = window.limitsWindowsWidgetStyle;
    const texts = {
      ru: { label: 'Оформление виджета', classic: 'Классический', rows: 'Строки', cells: 'Ячейки' },
      en: { label: 'Widget style', classic: 'Classic', rows: 'Rows', cells: 'Cells' },
    };
    const row = document.createElement('div');
    row.className = 'settings-item';
    row.hidden = true;
    const copy = document.createElement('div'); copy.className = 'settings-item-copy';
    const label = document.createElement('label');
    const field = document.createElement('div'); field.className = 'settings-item-select';
    const select = document.createElement('select');
    select.id = 'settings-widget-style';
    label.htmlFor = select.id;
    for (const style of styles) select.add(new Option('', style));
    copy.append(label);
    field.append(select);
    row.append(copy, field);
    card.append(row);
    select.onchange = () => change('widgetStyle', select.value);
    return next => {
      row.hidden = next.platform !== 'win32';
      if (row.hidden) return;
      const text = texts[next.language] || texts.en;
      label.textContent = text.label;
      for (const option of select.options) option.textContent = text[option.value];
      select.value = normalize(next.preferences?.widgetStyle);
    };
  },
};
