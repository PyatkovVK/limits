'use strict';
(() => {
  const strings = {
    ru: {
      title: 'Фон', type: 'Тип фона', description: 'Для окна с лимитами', default: 'Стандартный', color: 'Цвет',
      colorTitle: 'Цвет фона', image: 'Изображение', choose: 'Выбрать файл…', replace: 'Заменить файл…',
      hint: 'PNG или JPEG до 10 МБ', preview: 'Предпросмотр', compact: 'Свернуто', fiveHours: '5 ч', sevenDays: '7 д',
      invalidImage: 'Не удалось прочитать изображение. Выберите PNG или JPEG',
      imageTooLarge: 'Изображение слишком большое. Выберите файл поменьше',
      appearanceFailed: 'Не удалось изменить фон. Попробуйте ещё раз',
    },
    en: {
      title: 'Background', type: 'Background type', description: 'For the limits window', default: 'Default', color: 'Color',
      colorTitle: 'Background color', image: 'Image', choose: 'Choose file…', replace: 'Replace file…',
      hint: 'PNG or JPEG up to 10 MB', preview: 'Preview', compact: 'Collapsed', fiveHours: '5 h', sevenDays: '7 d',
      invalidImage: 'Could not read the image. Choose a PNG or JPEG',
      imageTooLarge: 'The image is too large. Choose a smaller file',
      appearanceFailed: 'Could not change the background. Try again',
    },
  };
  const appearance = window.limitsAppearance;
  const make = (parent, tag, className = '') => {
    const node = document.createElement(tag);
    node.className = className;
    parent.append(node);
    return node;
  };
  const section = make(window.limitsSettings.extensions, 'section', 'settings-group background-settings');
  const title = make(section, 'h3'); title.id = 'background-title';
  section.setAttribute('aria-labelledby', title.id);
  const card = make(section, 'div', 'settings-group-card');
  const modeRow = make(card, 'div', 'settings-item');
  const modeCopy = make(modeRow, 'div', 'settings-item-copy');
  const modeLabel = make(modeCopy, 'label'); modeLabel.htmlFor = 'background-mode';
  const description = make(modeCopy, 'p', 'settings-item-description'); description.id = 'background-description';
  const mode = make(make(modeRow, 'div', 'settings-item-select'), 'select'); mode.id = 'background-mode';
  mode.setAttribute('aria-describedby', description.id);
  for (const value of ['default', 'color', 'image']) mode.add(new Option('', value));

  const colorRow = make(card, 'div', 'settings-item');
  const colorLabel = make(make(colorRow, 'div', 'settings-item-copy'), 'label'); colorLabel.htmlFor = 'background-color';
  const color = make(colorRow, 'input'); color.type = 'color'; color.id = 'background-color';

  const imageRow = make(card, 'div', 'settings-item');
  const imageCopy = make(imageRow, 'div', 'settings-item-copy');
  const imageLabel = make(imageCopy, 'div', 'background-image-label');
  const hint = make(imageCopy, 'p', 'settings-item-description'); hint.id = 'background-file-hint';
  const choose = make(imageRow, 'button', 'refresh-button'); choose.type = 'button'; choose.id = 'background-choose';
  choose.setAttribute('aria-describedby', hint.id);
  const error = make(card, 'p', 'settings-item-error'); error.setAttribute('role', 'status');

  const preview = make(card, 'div', 'background-preview');
  const compact = make(preview, 'div', 'background-preview-compact'); compact.hidden = true;
  const compactLabel = make(compact, 'div', 'background-preview-caption');
  const strip = make(compact, 'div', 'background-preview-strip');
  const compactMeters = make(strip, 'div', 'background-preview-meters');
  compactMeters.setAttribute('aria-hidden', 'true');
  const quotas = [{ period: 'fiveHours', value: 67 }, { period: 'sevenDays', value: 23 }];
  const compactValues = quotas.map(() => make(compactMeters, 'span'));
  const caption = make(preview, 'div', 'background-preview-caption'); caption.id = 'background-preview-caption';
  const screen = make(preview, 'div', 'background-preview-screen');
  make(screen, 'div', 'background-preview-neck').setAttribute('aria-hidden', 'true');
  const sample = make(screen, 'div', 'background-preview-window'); sample.id = 'background-preview-window';
  sample.setAttribute('role', 'group');
  sample.setAttribute('aria-labelledby', caption.id);
  const header = make(sample, 'div', 'background-preview-line background-preview-title');
  make(header, 'span').textContent = 'Limits';
  make(header, 'span').textContent = 'Codex';
  const periods = quotas.map(({ value }) => {
    const metric = make(sample, 'div', value === 67 ? 'background-preview-quota limit-67' : 'background-preview-quota');
    const line = make(metric, 'div', 'background-preview-line');
    const period = make(line, 'span');
    make(line, 'span', 'background-preview-value').textContent = `${value}%`;
    const bar = make(metric, 'progress'); bar.max = 100; bar.value = value; bar.setAttribute('aria-hidden', 'true');
    return period;
  });

  let saved, issue, draftImage = false, pending = false;
  let text = strings.ru;
  function paint(mode, color, image) {
    sample.dataset.tone = mode === 'default' ? 'default' : mode === 'color' && appearance.isLight(color) ? 'light' : 'dark';
    appearance.paint(sample, mode, color, image);
  }
  function render() {
    const selection = draftImage ? 'image' : saved.mode;
    mode.value = selection;
    color.value = saved.color;
    colorRow.hidden = selection !== 'color';
    imageRow.hidden = selection !== 'image';
    mode.disabled = color.disabled = choose.disabled = pending;
    choose.textContent = saved.hasImage ? text.replace : text.choose;
    error.textContent = issue ? text[issue] || text.appearanceFailed : '';
    paint(saved.mode, saved.color, saved.image);
  }
  async function change(action) {
    if (pending) return;
    pending = mode.disabled = color.disabled = choose.disabled = true;
    issue = null;
    error.textContent = '';
    try { await appearance.update(action()); }
    catch { issue = 'appearanceFailed'; }
    finally { pending = false; render(); }
  }
  mode.onchange = () => {
    const selection = mode.value;
    draftImage = selection === 'image' && !saved.hasImage;
    if (draftImage) {
      issue = null;
      render();
    } else void change(() => window.limits.setAppearance({ mode: selection }));
  };
  color.oninput = () => paint('color', color.value);
  color.onchange = () => {
    const value = color.value;
    return change(() => window.limits.setAppearance({ mode: 'color', color: value }));
  };
  choose.onclick = () => void change(() => window.limits.chooseBackground());
  appearance.subscribe((value, errorKey) => {
    saved = value;
    issue = errorKey;
    if (saved.mode === 'image') draftImage = false;
    render();
  });

  function localize(next) {
    text = strings[next.language] || strings.en;
    title.textContent = text.title;
    modeLabel.textContent = text.type;
    description.textContent = text.description;
    for (const option of mode.options) option.textContent = text[option.value];
    colorLabel.textContent = text.colorTitle;
    imageLabel.textContent = text.image;
    hint.textContent = text.hint;
    compactLabel.textContent = text.compact;
    caption.textContent = text.preview;
    for (const [index, { period, value }] of quotas.entries()) {
      periods[index].textContent = text[period];
      compactValues[index].textContent = `${text[period]} ${value}%`;
    }
    compact.hidden = next.platform !== 'darwin';
    preview.dataset.presentation = next.platform === 'darwin' ? next.displayMode : 'window';
    choose.textContent = saved.hasImage ? text.replace : text.choose;
    error.textContent = issue ? text[issue] || text.appearanceFailed : '';
  }
  window.limits.subscribe(localize);
  window.limitsBackgroundReady = window.limits.get().then(localize);
})();
