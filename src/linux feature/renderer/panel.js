'use strict';

window.limitsLinuxPanelReady = window.renderReady.then(async () => {
  if (document.body.dataset.platform !== 'linux') return;
  await document.fonts.ready;
  const main = document.querySelector('main');
  const titlebar = document.querySelector('.titlebar');
  let lastHeight, frame = null;
  function measure() {
    const style = getComputedStyle(document.body);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    // main.scrollHeight includes content beyond the current scroll viewport.
    // body/document scrollHeight would retain the old, oversized window height.
    return Math.ceil(titlebar.getBoundingClientRect().height + main.scrollHeight + border);
  }
  function report() {
    frame = null;
    const height = measure();
    if (height === lastHeight) return Promise.resolve();
    lastHeight = height;
    return window.limits.panelSize(height);
  }
  function schedule() {
    if (frame === null) frame = requestAnimationFrame(() => void report());
  }
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  const sizes = new ResizeObserver(schedule);
  sizes.observe(main); sizes.observe(titlebar);
  // A details toggle can grow scrollHeight without changing the viewport size.
  document.addEventListener('toggle', schedule, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('pagehide', () => {
    mutations.disconnect(); sizes.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  }, { once: true });
  await report();
});
