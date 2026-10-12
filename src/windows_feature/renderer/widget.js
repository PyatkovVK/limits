'use strict';
const $ = id => document.getElementById(id);
let resetAt = null, language = 'ru';
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
function renderCountdown() { window.limitsCountdown.render($('short-reset'), resetAt, language); }
function render(next) {
  language = next.language || 'ru';
  const translate = (lang, key) => window.limitsWindowsI18n.t(lang, key) || window.limitsI18n.t(lang, key, 'win32');
  const t = key => translate(language, key);
  window.limitsI18n.apply(language, document, translate);
  const bucket = next.buckets.find(b => b.id === next.selectedId) || next.buckets.find(b => b.id === 'codex') || next.buckets[0];
  const stale = next.stale || !next.updatedAt || Date.now() - next.updatedAt > 90000;
  document.body.classList.toggle('stale', Boolean(stale));
  document.body.classList.toggle('low', !stale && [bucket?.short?.remaining, bucket?.weekly?.remaining].some(n => typeof n === 'number' && n <= 10));
  setText($('widget-account'), next.displayName || next.account?.email || t('connectAccount'));
  $('widget-account').title = next.account?.email || t('login');
  setText($('widget-plan'), next.demo ? t('demo') : `Codex${next.account?.planType ? ` · ${next.account.planType}` : ''}`);
  for (const kind of ['short', 'weekly']) {
    const quota = bucket?.[kind];
    setText($(`${kind}-value`), quota?.remaining == null ? '—' : String(quota.remaining));
    if ($(`${kind}-bar`).value !== (quota?.remaining ?? 0)) $(`${kind}-bar`).value = quota?.remaining ?? 0;
  }
  resetAt = bucket?.short?.resetsAt;
  renderCountdown();
}
const dragArea = document.body;
let drag = null, lastDragResult = Promise.resolve(false);
$('details').addEventListener('click', async event => {
  // The native cursor decides whether the gesture moved. Wait for pointerup's
  // result before opening details so a drag never also acts as a click.
  if (event.detail !== 0 && await lastDragResult) return;
  void window.limits.open();
});
dragArea.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  lastDragResult = Promise.resolve(false);
  drag = { pointer: event.pointerId, target: event.target };
  // Capture on the pressed element so a stationary click still reaches the
  // details button, including clicks on its labels, bars and percentages.
  drag.target.setPointerCapture(drag.pointer);
  void window.limitsWindows.widgetDrag('start');
});
dragArea.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.pointer) return;
  void window.limitsWindows.widgetDrag('move');
});
function finishDrag(event) {
  if (event.pointerId !== drag?.pointer) return;
  const completed = drag;
  drag = null;
  lastDragResult = window.limitsWindows.widgetDrag(event.type === 'pointerup' ? 'end' : 'cancel');
  if (completed.target.hasPointerCapture(completed.pointer)) completed.target.releasePointerCapture(completed.pointer);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) dragArea.addEventListener(type, finishDrag);
window.limits.subscribe(render);
window.renderReady = window.limits.get().then(render);
setInterval(renderCountdown, 1000);
