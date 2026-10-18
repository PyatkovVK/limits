'use strict';

window.limitsLinuxPanelReady = window.renderReady.then(async () => {
  if (document.body.dataset.platform !== 'linux') return;
  await document.fonts.ready;
  const main = document.querySelector('main');
  const titlebar = document.querySelector('.titlebar');
  const content = document.createElement('div');
  content.className = 'linux-panel-content';
  content.append(...main.childNodes);
  main.append(content);
  let lastHeight, frame = null;
  function measure() {
    const style = getComputedStyle(document.body);
    const mainStyle = getComputedStyle(main);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const padding = parseFloat(mainStyle.paddingTop) + parseFloat(mainStyle.paddingBottom);
    // Measure intrinsic content so the minimum window height cannot prevent shrinking.
    return Math.ceil(titlebar.getBoundingClientRect().height + content.getBoundingClientRect().height + padding + border);
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
  sizes.observe(content); sizes.observe(titlebar);
  // A details toggle can grow scrollHeight without changing the viewport size.
  document.addEventListener('toggle', schedule, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('pagehide', () => {
    mutations.disconnect(); sizes.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  }, { once: true });
  await report();
});
