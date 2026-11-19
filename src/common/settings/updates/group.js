'use strict';
(() => {
  const words = {
    ru: {
      title: 'Обновления', version: 'Версия', check: 'Проверить', checking: 'Проверяем обновления…',
      idle: 'Проверка ещё не выполнялась', current: 'У вас актуальная версия', available: 'Доступна версия',
      installed: 'Версия Limits', installedDescription: 'Установлена на этом компьютере', checkTitle: 'Проверка обновлений',
      newVersion: 'Доступна новая версия', downloadReady: 'Готова к скачиванию', restartHint: 'После установки Limits перезапустится',
      openRelease: 'Открыть релиз', manual: 'Скачивание и установка вручную',
      lastCheck: 'Последняя проверка', update: 'Обновить', later: 'Позже', offer: 'Доступно обновление Limits',
      hint: 'Кнопка «Обновить» откроет релиз на GitHub. Скачайте и установите подходящий файл вручную.',
      checkFailed: 'Не удалось проверить обновления. Проверьте интернет и попробуйте ещё раз.',
      timeout: 'GitHub не ответил вовремя. Попробуйте ещё раз.', rateLimited: 'GitHub ограничил запросы. Повторите проверку позже.',
      invalidResponse: 'Не удалось прочитать список релизов GitHub. Попробуйте позже.', noRelease: 'Опубликованные стабильные версии пока не найдены.',
      openFailed: 'Не удалось открыть релиз в браузере. Попробуйте ещё раз.', unavailable: 'Действие сейчас недоступно. Повторите проверку.',
      simulated: 'Демо: открытие релиза показано без запуска браузера.',
    },
    en: {
      title: 'Updates', version: 'Version', check: 'Check', checking: 'Checking for updates…',
      idle: 'Updates have not been checked yet', current: 'You have the latest version', available: 'Version available:',
      installed: 'Limits version', installedDescription: 'Installed on this computer', checkTitle: 'Check for updates',
      newVersion: 'A new version is available', downloadReady: 'Ready to download', restartHint: 'Limits will restart after installation',
      openRelease: 'Open release', manual: 'Download and install manually',
      lastCheck: 'Last check', update: 'Update', later: 'Later', offer: 'A Limits update is available',
      hint: 'Update opens the release on GitHub. Download and install the appropriate file manually.',
      checkFailed: 'Could not check for updates. Check your connection and try again.',
      timeout: 'GitHub did not respond in time. Try again.', rateLimited: 'GitHub has limited requests. Check again later.',
      invalidResponse: 'Could not read the GitHub release list. Try again later.', noRelease: 'No published stable versions were found yet.',
      openFailed: 'Could not open the release in your browser. Try again.', unavailable: 'This action is unavailable right now. Check again.',
      simulated: 'Demo: the release action was simulated without opening a browser.',
    },
  };
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  const section = make('section', window.limitsSettings.extensions, 'settings-group updates-section');
  const title = make('h3', section); title.id = 'updates-settings-title';
  section.setAttribute('aria-labelledby', title.id);
  const card = make('div', section, 'settings-group-card');
  function row() {
    const element = make('div', card, 'settings-item');
    const copy = make('div', element, 'settings-item-copy');
    return { element, title: make('div', copy, 'updates-label'), description: make('p', copy, 'settings-item-description') };
  }
  const installed = row();
  const version = make('span', installed.element); version.id = 'updates-version';
  const verification = row();
  const result = verification.description; result.id = 'updates-result'; result.setAttribute('role', 'status');
  const checked = make('p', result.parentElement, 'settings-item-description'); checked.id = 'updates-checked';
  const check = make('button', verification.element, 'refresh-button'); check.id = 'updates-check'; check.type = 'button';
  const release = row(); release.element.id = 'updates-release'; release.element.hidden = true;
  release.description.setAttribute('role', 'status');
  const open = make('button', release.element, 'refresh-button'); open.id = 'updates-open'; open.type = 'button'; open.hidden = true;
  const percent = make('span', release.element, 'updates-percent'); percent.hidden = true; percent.setAttribute('aria-hidden', 'true');
  const progress = make('progress', release.element, 'updates-progress'); progress.id = 'updates-progress'; progress.max = 100; progress.hidden = true;
  const actionMessage = make('p', card, 'settings-item-error'); actionMessage.setAttribute('role', 'status'); actionMessage.hidden = true;

  const dialog = make('dialog', document.body, 'updates-dialog'); dialog.id = 'updates-dialog'; dialog.setAttribute('aria-labelledby', 'updates-title');
  const dialogTitle = make('h2', dialog); dialogTitle.id = 'updates-title';
  const dialogVersion = make('p', dialog, 'updates-version'); dialogVersion.id = 'updates-offer-version';
  const dialogHint = make('p', dialog);
  const dialogError = make('p', dialog, 'updates-result warning'); dialogError.setAttribute('role', 'status'); dialogError.hidden = true;
  const dialogActions = make('div', dialog, 'updates-actions');
  const later = make('button', dialogActions, 'refresh-button'); later.id = 'updates-later'; later.type = 'button';
  const update = make('button', dialogActions, 'refresh-button'); update.id = 'updates-install'; update.type = 'button';
  let current, messageKey = null, opening = false, dismissing = false;
  const text = () => ({ ...(words[current?.language] || words.en), ...window.limitsInstallation?.words(current) });
  function activeHost() {
    return window.limitsPlatform?.activeHost?.(current) ?? true;
  }
  function maybeOffer() {
    const offer = current?.updates?.offer;
    if (!offer || !activeHost()) { if (dialog.open) dialog.close(); return; }
    if (dialog.open) {
      dialog.dataset.version = offer.version;
      return;
    }
    if (document.hidden || dismissing || document.querySelector('dialog[open]')) return;
    dialog.dataset.version = offer.version;
    dialogVersion.textContent = `${text().available} ${offer.version}`;
    dialog.showModal();
  }
  function render(next) {
    current = next;
    const value = next.updates;
    if (!value) return;
    const t = text();
    const installation = window.limitsInstallation?.presentation(next);
    title.textContent = t.title;
    installed.title.textContent = t.installed; installed.description.textContent = t.installedDescription;
    version.textContent = value.currentVersion;
    verification.title.textContent = t.checkTitle;
    const checkResult = value.status === 'available' ? t.newVersion : value.status === 'error' ? t[value.error] || t.checkFailed : t[value.status] || t.idle;
    if (result.textContent !== checkResult) result.textContent = checkResult;
    result.classList.toggle('warning', value.status === 'error');
    checked.hidden = value.checkedAt === null;
    checked.textContent = value.checkedAt === null ? '' : `${t.lastCheck}: ${new Date(value.checkedAt).toLocaleString(next.language === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
    check.textContent = value.status === 'checking' ? t.checking : t.check;
    check.disabled = value.status === 'checking' || Boolean(installation?.disabled) || opening;
    const phase = installation?.status;
    const downloading = phase === 'downloading';
    release.element.hidden = !value.release;
    release.title.textContent = value.release ? `${t.version} ${value.release.version}` : '';
    const releaseStatus = phase === 'ready' ? t.restartHint
      : t[phase] && installation.disabled ? t[phase]
      : installation ? installation.result || t.downloadReady : t.manual;
    if (release.description.textContent !== releaseStatus) release.description.textContent = releaseStatus;
    release.description.classList.toggle('warning', Boolean(installation?.error));
    progress.hidden = !downloading && phase !== 'verifying';
    progress.setAttribute('aria-label', release.description.textContent);
    const amount = downloading && Number.isFinite(installation.progress) ? installation.progress : null;
    if (amount === null) progress.removeAttribute('value'); else progress.value = amount;
    percent.hidden = amount === null; percent.textContent = amount === null ? '' : `${amount}%`;
    open.textContent = phase === 'ready' ? t.update : installation?.button || t.openRelease;
    open.hidden = !value.release || Boolean(installation?.disabled);
    update.textContent = installation?.button || t.update;
    open.disabled = update.disabled = opening || Boolean(installation?.disabled); later.disabled = dismissing;
    dialogHint.textContent = installation?.hint || t.hint;
    dialogTitle.textContent = t.offer; later.textContent = t.later;
    dialogVersion.textContent = `${t.available} ${value.offer?.version || value.release?.version || ''}`;
    actionMessage.hidden = !messageKey; actionMessage.textContent = t[messageKey] || '';
    dialogError.hidden = !messageKey || messageKey === 'simulated'; dialogError.textContent = t[messageKey] || '';
    maybeOffer();
  }
  async function checkUpdates() {
    messageKey = null;
    try {
      const value = await window.limits.checkUpdates();
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
  check.onclick = () => void checkUpdates();
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
  window.limitsUpdatesReady = window.renderReady.then(() => {
    document.getElementById('general-settings-title')?.closest('section').after(section);
    return window.limits.get();
  }).then(render);
})();
