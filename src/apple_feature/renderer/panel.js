'use strict';

window.limitsMacPanelReady = window.renderReady.then(async () => {
  if (document.body.dataset.platform !== 'darwin') return;
  await document.fonts.ready;
  const main = document.querySelector('main');
  const titlebar = document.querySelector('.titlebar');
  const dialog = document.getElementById('settings-dialog');
  const settings = dialog.querySelector('.settings-content');
  function wrap(parent, className) {
    const content = document.createElement('div');
    content.className = className;
    content.append(...parent.childNodes);
    parent.append(content);
    return content;
  }
  const content = wrap(main, 'mac-panel-content');
  const settingsContent = wrap(settings, 'mac-settings-content');
  const verticalEdges = node => {
    const style = getComputedStyle(node);
    return ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0);
  };
  function measure() {
    // scrollHeight of the flex viewport cannot shrink below its previous height.
    // offsetHeight of the intrinsic wrapper also ignores notch opening transforms.
    const height = titlebar.offsetHeight + content.offsetHeight + verticalEdges(main) + verticalEdges(document.body);
    const inset = parseFloat(getComputedStyle(dialog).getPropertyValue('--settings-inset')) || 14;
    const modalHeight = dialog.open ? dialog.querySelector('.settings-header').offsetHeight + settingsContent.offsetHeight + verticalEdges(settings) + verticalEdges(dialog) + 2 * inset : 0;
    return Math.ceil(Math.max(height, modalHeight));
  }
  let lastHeight, frame = null;
  async function report() {
    frame = null;
    const height = measure();
    if (height === lastHeight) return;
    lastHeight = height;
    await window.limits.panelSize(height);
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
  window.limitsMacPanel = { measure, report };
  await report();
});
