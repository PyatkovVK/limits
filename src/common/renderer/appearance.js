'use strict';
(() => {
  const words = {
    ru: { title: 'Фон', default: 'Стандартный', color: 'Цвет', image: 'Картинка', choose: 'Выбрать картинку…', reset: 'Стандартный фон', hint: 'PNG или JPG, до 10 МБ. Картинка сохраняется в приложении.', invalidImage: 'Не удалось прочитать картинку. Выберите PNG или JPG.', imageTooLarge: 'Картинка слишком большая. Выберите файл поменьше.', appearanceFailed: 'Не удалось изменить фон. Попробуйте ещё раз.' },
    en: { title: 'Background', default: 'Default', color: 'Color', image: 'Image', choose: 'Choose image…', reset: 'Use default background', hint: 'PNG or JPG, up to 10 MB. The app keeps its own copy.', invalidImage: 'Could not read this image. Choose a PNG or JPG.', imageTooLarge: 'This image is too large. Choose a smaller file.', appearanceFailed: 'Could not change the background. Try again.' },
  };
  let language = 'en', value, generation = 0, imageId, imageData;
  const target = document.querySelector('.apple-shell') || document.body;
  const main = document.querySelector('main');
  let controls;
  const create = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  if (main) {
    const section = create('section', document.getElementById('settings-extensions') || main, 'appearance-controls'); section.dataset.settingSection = 'appearance';
    const heading = create('h3', section);
    const row = create('label', section, 'appearance-row'); const label = create('span', row);
    const select = create('select', row); select.id = 'background-mode';
    for (const mode of ['default', 'color', 'image']) { const option = create('option', select); option.value = mode; }
    const colorRow = create('label', section, 'appearance-row'); const colorLabel = create('span', colorRow);
    const color = create('input', colorRow); color.type = 'color'; color.id = 'background-color'; color.value = '#202632';
    const choose = create('button', section, 'refresh-button'); choose.type = 'button'; choose.id = 'background-choose';
    const reset = create('button', section, 'refresh-button'); reset.type = 'button'; reset.id = 'background-reset';
    const hint = create('p', section, 'footnote'); const error = create('p', section, 'notice warning'); error.hidden = true; error.setAttribute('role', 'status');
    controls = { heading, label, select, colorRow, colorLabel, color, choose, reset, hint, error };
    select.onchange = () => select.value === 'image' && !value?.hasImage ? chooseImage() : change({ mode: select.value, color: color.value });
    color.onchange = () => change({ mode: 'color', color: color.value });
    choose.onclick = chooseImage; reset.onclick = () => change({ mode: 'default' });
  }
  function labels() {
    if (!controls) return;
    const t = words[language] || words.en;
    controls.heading.textContent = controls.label.textContent = t.title;
    controls.colorLabel.textContent = t.color;
    for (const option of controls.select.options) option.textContent = t[option.value];
    controls.choose.textContent = t.choose; controls.reset.textContent = t.reset; controls.hint.textContent = t.hint;
  }
  function fail(key) { if (controls) { controls.error.textContent = (words[language] || words.en)[key] || (words[language] || words.en).appearanceFailed; controls.error.hidden = false; } }
  async function change(next) { try { await apply(await window.limits.setAppearance(next)); } catch { fail('appearanceFailed'); } }
  async function chooseImage() {
    if (controls) controls.choose.disabled = controls.select.disabled = true;
    try { await apply(await window.limits.chooseBackground()); } catch { fail('appearanceFailed'); }
    finally { if (controls) controls.choose.disabled = controls.select.disabled = false; }
  }
  const properties = ['background-image', 'background-color', 'background-size', 'background-position', 'background-repeat'];
  const variables = ['--ink', '--muted', '--edge', '--surface', '--control', '--track', '--appearance-ink', '--appearance-muted'];
  async function apply(next) {
    const request = ++generation; value = next;
    if (controls) {
      controls.select.value = next.mode; controls.color.value = next.color;
      controls.colorRow.hidden = next.mode !== 'color'; controls.error.hidden = true;
      if (next.error) fail(next.error);
    }
    for (const property of properties) target.style.removeProperty(property);
    for (const property of variables) document.body.style.removeProperty(property);
    delete document.body.dataset.background;
    if (next.mode === 'default') return;
    let data;
    if (next.mode === 'image') {
      if (imageId !== next.imageId) { data = await window.limits.backgroundImage(); if (request !== generation) return; imageId = next.imageId; imageData = data; }
      else data = imageData;
      if (!data || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) { fail('invalidImage'); return; }
    }
    const rgb = next.color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    const light = next.mode === 'color' && (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) > .179;
    document.body.dataset.background = light ? 'light' : 'dark';
    const ink = light ? '#000000' : '#ffffff';
    const muted = next.mode === 'image' ? '#eef1f6' : ink;
    for (const [key, color] of Object.entries({ '--ink': ink, '--muted': muted, '--appearance-ink': ink, '--appearance-muted': muted,
      '--edge': light ? '#15171c44' : '#ffffff44', '--surface': light ? '#ffffff33' : '#00000033', '--control': light ? '#ffffff88' : '#101318cc', '--track': light ? '#15171c33' : '#ffffff33' })) document.body.style.setProperty(key, color);
    target.style.backgroundColor = next.color;
    target.style.backgroundImage = data ? `linear-gradient(#0009, #0009), url("${data}")` : 'none';
    target.style.backgroundSize = 'cover'; target.style.backgroundPosition = 'center'; target.style.backgroundRepeat = 'no-repeat';
  }
  window.limits.subscribe(next => { language = next.language || 'en'; labels(); });
  window.limits.get().then(next => { language = next.language || 'en'; labels(); });
  window.limits.onAppearance(next => { void apply(next).catch(() => fail('appearanceFailed')); });
  window.limits.appearance().then(apply).catch(() => fail('appearanceFailed'));
})();
