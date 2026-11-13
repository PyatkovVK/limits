'use strict';
(() => {
  const words = {
    ru: { title: 'Подключить', hint: 'Войдите в кабинет {name} в браузере, создайте API-ключ и вставьте его сюда.',
      codingPlanHint: 'Создайте ключ в разделе Personal Coding Plan в кабинете Z.ai и вставьте его сюда.',
      key: 'API-ключ', browser: 'Открыть кабинет ↗', connect: 'Подключить', checking: 'Проверяем ключ…', cancel: 'Отмена',
      stored: 'Ключ хранится на этом устройстве в зашифрованном виде.' },
    en: { title: 'Connect', hint: 'Sign in to the {name} platform in your browser, create an API key, and paste it here.',
      codingPlanHint: 'Create a key under Personal Coding Plan in Z.ai and paste it here.',
      key: 'API key', browser: 'Open platform ↗', connect: 'Connect', checking: 'Checking key…', cancel: 'Cancel',
      stored: 'The key is stored encrypted on this device.' }
  };
  let current, connectionId, actionError = null;
  const make = (tag, parent, className = '') => { const node = document.createElement(tag); node.className = className; parent?.append(node); return node; };
  const dialog = make('dialog', document.body, 'key-connection'); dialog.id = 'key-connection-dialog'; dialog.setAttribute('aria-labelledby', 'key-connection-title');
  const title = make('h2', dialog); title.id = 'key-connection-title';
  const hint = make('p', dialog, 'key-connection-hint'); hint.id = 'key-connection-hint';
  const browser = make('button', dialog, 'refresh-button'); browser.id = 'key-connection-browser'; browser.type = 'button';
  const label = make('label', dialog); label.htmlFor = 'key-connection-input';
  const input = make('input', dialog); input.id = 'key-connection-input'; input.type = 'password'; input.maxLength = 8192;
  input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'none'); input.setAttribute('aria-describedby', hint.id);
  const stored = make('p', dialog, 'key-connection-hint');
  const error = make('div', dialog, 'notice warning'); error.setAttribute('role', 'status'); error.hidden = true;
  const actions = make('div', dialog, 'key-connection-actions');
  const cancel = make('button', actions, 'refresh-button'); cancel.id = 'key-connection-cancel'; cancel.type = 'button';
  const connect = make('button', actions, 'login-button'); connect.id = 'key-connection-submit'; connect.type = 'button';
  function render(next) {
    current = next;
    const pending = next.keyConnection;
    if (!pending) {
      connectionId = null; input.value = ''; actionError = null;
      if (dialog.open) dialog.close();
      return;
    }
    if (connectionId !== pending.id) { connectionId = pending.id; input.value = ''; actionError = null; }
    const t = words[next.language] || words.en;
    title.textContent = `${t.title} ${pending.name}`;
    hint.textContent = pending.providerId === 'zai' ? t.codingPlanHint : t.hint.replace('{name}', pending.name);
    label.textContent = t.key; stored.textContent = t.stored;
    browser.textContent = t.browser; cancel.textContent = t.cancel;
    const checking = pending.phase === 'checking';
    input.disabled = checking; browser.disabled = checking;
    connect.textContent = checking ? t.checking : t.connect; connect.disabled = checking || !input.value.trim();
    dialog.setAttribute('aria-busy', String(checking));
    window.limitsI18n.notice(error, actionError, next.language);
    if (!dialog.open) { dialog.showModal(); input.focus(); }
  }
  async function submit() {
    if (connect.disabled || !connectionId) return;
    const id = connectionId;
    actionError = null; connect.disabled = true;
    try {
      const result = await window.limits.submitApiKey(id, input.value);
      if (connectionId === id) actionError = result.error || null;
    } catch { if (connectionId === id) actionError = 'accountActionFailed'; }
    render(await window.limits.get());
  }
  async function dismiss() {
    const id = connectionId;
    input.value = '';
    if (id) await window.limits.cancelApiKey(id);
    render(await window.limits.get());
  }
  input.addEventListener('input', () => render(current));
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } });
  connect.onclick = () => void submit();
  cancel.onclick = () => void dismiss();
  dialog.addEventListener('cancel', event => { event.preventDefault(); void dismiss(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  browser.onclick = async () => {
    const id = connectionId;
    const result = await window.limits.openKeyBrowser(id);
    if (id === connectionId) { actionError = result.error || null; render(await window.limits.get()); }
  };
  window.limitsKeyConnection = { open(result) {
    if (result.connection?.id === connectionId) { actionError = result.error || null; render(current); }
  }, dialog };
  window.limits.subscribe(render);
  window.limits.get().then(render);
})();
