'use strict';
(() => {
  let generation = 0, imageId, imageData;
  let current = { mode: 'default', color: '#202632', hasImage: false };
  const subscribers = new Set();
  const target = document.querySelector('[data-background-target]') || document.body;

  function isLight(color) {
    const rgb = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) > .179;
  }

  function paint(element, mode, color, image) {
    const custom = mode !== 'default';
    element.style.backgroundColor = custom ? color : '';
    element.style.backgroundImage = custom ? 'none' : '';
    if (mode === 'image' && image) element.style.backgroundImage = `linear-gradient(#0009, #0009), url("${image}")`;
  }

  const properties = ['background-image', 'background-color', 'background-size', 'background-position', 'background-repeat'];
  const variables = ['--ink', '--muted', '--edge', '--surface', '--control', '--track', '--appearance-ink', '--appearance-muted'];
  async function apply(next) {
    if (next.error) throw new Error(next.error);
    const request = ++generation;
    let image;
    if (next.mode === 'image') {
      image = imageId === next.imageId ? imageData : await window.limits.backgroundImage();
      if (request !== generation) return;
      if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error('invalidImage');
      imageId = next.imageId; imageData = image;
    }
    for (const property of properties) target.style.removeProperty(property);
    for (const property of variables) document.body.style.removeProperty(property);
    delete document.body.dataset.background;
    if (next.mode !== 'default') {
      const light = next.mode === 'color' && isLight(next.color);
      document.body.dataset.background = light ? 'light' : 'dark';
      const ink = light ? '#000000' : '#ffffff';
      const muted = next.mode === 'image' ? '#eef1f6' : ink;
      for (const [key, color] of Object.entries({ '--ink': ink, '--muted': muted, '--appearance-ink': ink, '--appearance-muted': muted,
        '--edge': light ? '#15171c44' : '#ffffff44', '--surface': light ? '#ffffff33' : '#00000033', '--control': light ? '#ffffff88' : '#101318cc', '--track': light ? '#15171c33' : '#ffffff33' })) document.body.style.setProperty(key, color);
      paint(target, next.mode, next.color, image);
      target.style.backgroundSize = 'cover';
      target.style.backgroundPosition = 'center';
      target.style.backgroundRepeat = 'no-repeat';
    }
    current = { ...next, image };
    for (const listener of subscribers) listener(current);
  }

  async function update(request) {
    try { await apply(await request); }
    catch (error) { for (const listener of subscribers) listener(current, error.message); }
  }

  window.limitsAppearance = {
    update, paint, isLight,
    subscribe(listener) { subscribers.add(listener); listener(current); },
  };
  window.limits.onAppearance(next => { void update(next); });
  void update(window.limits.appearance());
})();
