'use strict';

window.limitsWindowsPanelReady = window.renderReady.then(async () => {
  if (document.body.dataset.platform !== 'win32') return;
  await document.fonts.ready;
  const main = document.querySelector('main');
  const titlebar = document.querySelector('.titlebar');
  const dialog = document.getElementById('settings-dialog');
  const settings = dialog.querySelector('.settings-content');
  function wrap(parent) {
    const content = document.createElement('div');
    content.append(...parent.childNodes);
    parent.append(content);
    return content;
  }
  const content = wrap(main);
  const settingsContent = wrap(settings);
  const verticalEdges = node => {
    const style = getComputedStyle(node);
    return ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0);
  };
  function measure() {
    // Measure intrinsic wrappers so closing Settings also shrinks the window;
    // scrollHeight of a constrained viewport can retain its previous height.
    const height = titlebar.offsetHeight + content.offsetHeight + verticalEdges(main) + verticalEdges(document.body);
    const modalHeight = dialog.open ? dialog.querySelector('.settings-header').offsetHeight + settingsContent.offsetHeight + verticalEdges(settings) + verticalEdges(dialog) + 28 : 0;
    return Math.ceil(Math.max(height, modalHeight));
  }
  let lastHeight, frame = null;
  async function report() {
    frame = null;
    const height = measure();
    if (height === lastHeight) return;
    lastHeight = height;
    await window.limitsWindows.panelSize(height);
  }
  function schedule() {
    if (frame === null) frame = requestAnimationFrame(() => void report());
  }
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  const sizes = new ResizeObserver(schedule);
  for (const node of [content, titlebar, settingsContent]) sizes.observe(node);
  document.addEventListener('toggle', schedule, true);
  dialog.addEventListener('close', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('pagehide', () => {
    mutations.disconnect(); sizes.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  }, { once: true });
  window.limitsWindowsPanel = { measure, report };
  await report();
});
