'use strict';
(() => {
  const words = {
    ru: {
      title: 'Обновления', version: 'Версия', check: 'Проверить обновления', checking: 'Проверяем обновления…',
      idle: 'Проверка ещё не выполнялась.', current: 'Установлена актуальная версия.', available: 'Доступна версия',
      lastCheck: 'Последняя проверка', update: 'Обновить', later: 'Позже', offer: 'Доступно обновление Limits',
      hint: 'Кнопка «Обновить» откроет релиз на GitHub. Скачайте и установите подходящий файл вручную.',
      checkFailed: 'Не удалось проверить обновления. Проверьте интернет и попробуйте ещё раз.',
      timeout: 'GitHub не ответил вовремя. Попробуйте ещё раз.', rateLimited: 'GitHub ограничил запросы. Повторите проверку позже.',
      invalidResponse: 'Не удалось прочитать список релизов GitHub. Попробуйте позже.', noRelease: 'Опубликованные стабильные версии пока не найдены.',
      openFailed: 'Не удалось открыть релиз в браузере. Попробуйте ещё раз.', unavailable: 'Действие сейчас недоступно. Повторите проверку.',
      demo: 'Результат в демо', demoCurrent: 'Актуальная версия', demoAvailable: 'Новая версия', demoError: 'Ошибка проверки',
      simulated: 'Демо: открытие релиза показано без запуска браузера.',
    },
    en: {
      title: 'Updates', version: 'Version', check: 'Check for updates', checking: 'Checking for updates…',
      idle: 'Updates have not been checked yet.', current: 'You have the latest version.', available: 'Version available:',
      lastCheck: 'Last check', update: 'Update', later: 'Later', offer: 'A Limits update is available',
      hint: 'Update opens the release on GitHub. Download and install the appropriate file manually.',
      checkFailed: 'Could not check for updates. Check your connection and try again.',
      timeout: 'GitHub did not respond in time. Try again.', rateLimited: 'GitHub has limited requests. Check again later.',
      invalidResponse: 'Could not read the GitHub release list. Try again later.', noRelease: 'No published stable versions were found yet.',
      openFailed: 'Could not open the release in your browser. Try again.', unavailable: 'This action is unavailable right now. Check again.',
      demo: 'Demo result', demoCurrent: 'Current version', demoAvailable: 'New version', demoError: 'Check failed',
      simulated: 'Demo: the release action was simulated without opening a browser.',
    },
  };
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  const section = make('section', window.limitsSettings.extensions, 'updates-section');
  const title = make('h3', section);
  const version = make('p', section, 'updates-version'); version.id = 'updates-version';
  const result = make('p', section, 'updates-result'); result.id = 'updates-result'; result.setAttribute('role', 'status');
  const checked = make('p', section, 'footnote'); checked.id = 'updates-checked';
  const actions = make('div', section, 'updates-actions');
  const check = make('button', actions, 'refresh-button'); check.id = 'updates-check'; check.type = 'button';
  const open = make('button', actions, 'refresh-button'); open.id = 'updates-open'; open.type = 'button'; open.hidden = true;
  const hint = make('p', section, 'footnote');
  const demoRow = make('label', section, 'settings-row'); const demoLabel = make('span', demoRow);
  const demoSelect = make('select', demoRow); demoSelect.id = 'updates-demo';
  for (const scenario of ['current', 'available', 'error']) { const option = make('option', demoSelect); option.value = scenario; }
  const actionMessage = make('p', section, 'updates-result'); actionMessage.setAttribute('role', 'status'); actionMessage.hidden = true;

  const dialog = make('dialog', document.body, 'updates-dialog'); dialog.id = 'updates-dialog'; dialog.setAttribute('aria-labelledby', 'updates-title');
  const dialogTitle = make('h2', dialog); dialogTitle.id = 'updates-title';
  const dialogVersion = make('p', dialog, 'updates-version'); dialogVersion.id = 'updates-offer-version';
  const dialogHint = make('p', dialog);
  const dialogError = make('p', dialog, 'updates-result warning'); dialogError.setAttribute('role', 'status'); dialogError.hidden = true;
  const dialogActions = make('div', dialog, 'updates-actions');
  const later = make('button', dialogActions, 'refresh-button'); later.id = 'updates-later'; later.type = 'button';
  const update = make('button', dialogActions, 'refresh-button'); update.id = 'updates-install'; update.type = 'button';
  let current, messageKey = null, opening = false, dismissing = false;
  const text = () => words[current?.language] || words.en;
  function activeHost() {
    const notch = document.body.classList.contains('apple-notch');
    return current?.displayMode === 'notch' ? notch && current.appleNotch?.phase === 'expanded' : !notch;
  }
  function maybeOffer() {
    const offer = current?.updates?.offer;
    if (!offer || !activeHost() || document.hidden) { if (dialog.open) dialog.close(); return; }
    if (dialog.open || dismissing || document.querySelector('dialog[open]')) return;
    dialog.dataset.version = offer.version;
    dialogVersion.textContent = `${text().available} ${offer.version}`;
    dialog.showModal();
  }
  function render(next) {
    current = next;
    const value = next.updates;
    if (!value) return;
    const t = text();
    title.textContent = t.title; version.textContent = `${t.version} ${value.currentVersion}`;
    result.textContent = value.status === 'available' ? `${t.available} ${value.release.version}` : value.status === 'error' ? t[value.error] || t.checkFailed : t[value.status] || t.idle;
    result.classList.toggle('warning', value.status === 'error');
    checked.hidden = value.checkedAt === null;
    checked.textContent = value.checkedAt === null ? '' : `${t.lastCheck}: ${new Date(value.checkedAt).toLocaleString(next.language === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
    check.textContent = value.status === 'checking' ? t.checking : t.check;
    check.disabled = demoSelect.disabled = value.status === 'checking';
    open.textContent = update.textContent = t.update; open.hidden = !value.release;
    open.disabled = update.disabled = opening; later.disabled = dismissing;
    hint.textContent = dialogHint.textContent = t.hint;
    demoRow.hidden = !value.demo; demoLabel.textContent = t.demo; demoSelect.value = value.demoScenario;
    for (const option of demoSelect.options) option.textContent = t[{ current: 'demoCurrent', available: 'demoAvailable', error: 'demoError' }[option.value]];
    dialogTitle.textContent = t.offer; later.textContent = t.later;
    dialogVersion.textContent = `${t.available} ${value.offer?.version || value.release?.version || ''}`;
    actionMessage.hidden = !messageKey; actionMessage.textContent = t[messageKey] || '';
    dialogError.hidden = !messageKey || messageKey === 'simulated'; dialogError.textContent = t[messageKey] || '';
    maybeOffer();
  }
  async function checkUpdates(scenario) {
    messageKey = null;
    try {
      const value = await (scenario ? window.limits.demoUpdate(scenario) : window.limits.checkUpdates());
      if (value.error && !value.currentVersion) messageKey = value.error;
      else current = { ...current, updates: value };
    } catch { messageKey = 'checkFailed'; }
    render(current);
  }
  async function openRelease() {
    if (opening) return;
    opening = true; messageKey = null; render(current);
    try {
      const outcome = await window.limits.openRelease();
      messageKey = outcome.error || (outcome.simulated ? 'simulated' : null);
      if (outcome.opened) current = await window.limits.get();
    } catch { messageKey = 'openFailed'; }
    opening = false; render(current);
  }
  async function dismissOffer() {
    if (dismissing) return;
    dismissing = true;
    try {
      const value = await window.limits.dismissUpdate(dialog.dataset.version);
      if (value.currentVersion) { current = { ...current, updates: value }; dialog.close(); }
      else messageKey = value.error;
    } catch { messageKey = 'unavailable'; }
    dismissing = false; render(current);
  }
  check.onclick = () => void checkUpdates(); demoSelect.onchange = () => void checkUpdates(demoSelect.value);
  open.onclick = update.onclick = () => void openRelease(); later.onclick = () => void dismissOffer();
  dialog.addEventListener('cancel', event => { event.preventDefault(); void dismissOffer(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) void dismissOffer();
  });
  document.addEventListener('close', maybeOffer, true);
  document.addEventListener('visibilitychange', maybeOffer);
  window.addEventListener('focus', maybeOffer);
  const modals = new MutationObserver(maybeOffer);
  modals.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  window.addEventListener('pagehide', () => modals.disconnect(), { once: true });
  window.limits.subscribe(render);
  window.limitsUpdatesReady = window.limits.get().then(render);
})();
