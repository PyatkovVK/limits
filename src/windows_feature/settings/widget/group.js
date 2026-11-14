'use strict';

window.limitsWindowsWidgetSettings = {
  create(card, change) {
    const { styles, normalize } = window.limitsWindowsWidgetStyle;
    const styleLabels = {
      classic: 'widgetStyleClassic',
      rows: 'widgetStyleRows',
      cells: 'widgetStyleCells',
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
      const t = key => window.limitsWindowsI18n.t(next.language === 'ru' ? 'ru' : 'en', key);
      label.textContent = t('widgetStyleLabel');
      for (const option of select.options) option.textContent = t(styleLabels[option.value]);
      select.value = normalize(next.preferences?.widgetStyle);
    };
  },
};
