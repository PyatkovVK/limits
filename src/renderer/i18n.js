'use strict';
(function (root) {
  const strings = {
    ru: {
      accounts: 'Аккаунты', addAccount: '+ Добавить', inWidget: 'В виджете', useWidget: 'В виджет',
      nickname: 'Имя в Limits', editAccount: 'Имя и подключение', save: 'Сохранить', removeAccount: 'Отключить', cancelLogin: 'Отменить вход',
      accountsHint: 'В виджете — выбранный аккаунт. При добавлении выберите нужный аккаунт в браузере. Имя можно задать здесь.',
      loginBusy: 'Завершите или отмените текущий вход перед подключением другого аккаунта.',
      accountActionFailed: 'Не удалось изменить аккаунт. Попробуйте ещё раз.',
      short: 'Пятичасовой лимит', weekly: 'Недельный лимит', shortCompact: '5 ч', weeklyCompact: 'Неделя',
      connecting: 'Подключение', online: 'В сети', stale: 'Нет свежих данных', demo: 'ДЕМО',
      signingIn: 'Вход в браузере', signedOut: 'Нужен вход', account: 'Аккаунт Codex',
      connectAccount: 'Подключите аккаунт ChatGPT', login: 'Войти через ChatGPT ↗', switchAccount: 'Сменить аккаунт ↗',
      finishLogin: 'Завершите вход в браузере', refresh: 'Обновить', details: 'Открыть подробности',
      close: 'Закрыть подробности', drag: 'Перетащите аккаунт, чтобы передвинуть блок',
      footnote: 'Перетащите аккаунт, чтобы передвинуть блок на панели задач.',
      demoNotice: 'Демо · показаны примерные данные', bucket: 'Лимит', language: 'Язык',
      showWidget: 'Показывать блок на панели задач', resetPosition: 'Вернуть блок к системному трею',
      width: 'Ширина блока', startup: 'Запускать при входе в Windows', quit: 'Выйти из приложения',
      displayMode: 'Отображение', widgetMode: 'Виджет на панели задач', trayMode: 'Два значка в трее',
      trayFootnote: 'Наведите на значок для подробностей. Нажмите, чтобы открыть лимиты.', resetsAt: 'Сброс',
      tooltip: 'Limits · панель задач', lowTitle: 'Codex: лимит заканчивается',
      unsupported: 'Лимиты подписки доступны при входе через ChatGPT. Сейчас используется другой способ авторизации.',
      noLimits: 'Сервис пока не вернул данные о лимитах.', cached: 'Показаны последние полученные данные. Ожидаем обновление.',
      waiting: 'Ожидаем данные', updated: 'Обновлено в', noData: 'нет данных', minutes: 'мин',
      resetIn: 'До сброса', hoursMinutes: 'ч:мин', resetUnknown: 'Время сброса пока неизвестно', resetPending: 'Ожидаем подтверждения сброса от сервера',
      codexMissing: 'Не найден Codex. Установите приложение Codex или Codex CLI, затем перезапустите Limits.',
      taskbarMissing: 'Панель задач временно недоступна. Восстанавливаем виджет.',
      loginUnavailable: 'Codex недоступен. Установите Codex и перезапустите приложение.',
      loginFailed: 'Не удалось открыть вход. Проверьте Codex и попробуйте ещё раз.',
      loginIncomplete: 'Вход не завершён. Попробуйте ещё раз.',
      disconnected: 'Связь с Codex потеряна. Повторяем подключение.',
      refreshFailed: 'Не удалось получить лимиты. Проверьте интернет и вход в Codex. Повторяем автоматически.'
    },
    en: {
      accounts: 'Accounts', addAccount: '+ Add', inWidget: 'In widget', useWidget: 'Use in widget',
      nickname: 'Name in Limits', editAccount: 'Name and connection', save: 'Save', removeAccount: 'Disconnect', cancelLogin: 'Cancel sign-in',
      accountsHint: 'The widget shows the selected account. Choose the right account in your browser when adding one. Set its name here.',
      loginBusy: 'Complete or cancel the current sign-in before connecting another account.',
      accountActionFailed: 'Could not update the account. Try again.',
      short: 'Five-hour limit', weekly: 'Weekly limit', shortCompact: '5 h', weeklyCompact: 'Week',
      connecting: 'Connecting', online: 'Online', stale: 'Data is out of date', demo: 'DEMO',
      signingIn: 'Signing in via browser', signedOut: 'Sign-in required', account: 'Codex account',
      connectAccount: 'Connect your ChatGPT account', login: 'Sign in with ChatGPT ↗', switchAccount: 'Switch account ↗',
      finishLogin: 'Complete sign-in in your browser', refresh: 'Refresh', details: 'Open details',
      close: 'Close details', drag: 'Drag the account to move the widget',
      footnote: 'Drag the account to move the widget along the taskbar.',
      demoNotice: 'Demo · sample data', bucket: 'Limit', language: 'Language',
      showWidget: 'Show widget on taskbar', resetPosition: 'Move widget back beside the tray',
      width: 'Widget width', startup: 'Launch at Windows sign-in', quit: 'Quit application',
      displayMode: 'Display', widgetMode: 'Taskbar widget', trayMode: 'Two tray icons',
      trayFootnote: 'Hover over an icon for details. Click to open your limits.', resetsAt: 'Resets at',
      tooltip: 'Limits · taskbar', lowTitle: 'Codex: limit running low',
      unsupported: 'Subscription limits require ChatGPT sign-in. Codex currently uses another authentication method.',
      noLimits: 'The service has not returned limit data yet.', cached: 'Showing the last received data. Waiting for an update.',
      waiting: 'Waiting for data', updated: 'Updated at', noData: 'no data', minutes: 'min',
      resetIn: 'Resets in', hoursMinutes: 'h:min', resetUnknown: 'Reset time is not available yet', resetPending: 'Waiting for the server to confirm the reset',
      codexMissing: 'Codex was not found. Install the Codex app or Codex CLI, then restart Limits.',
      taskbarMissing: 'The taskbar is temporarily unavailable. Restoring the widget.',
      loginUnavailable: 'Codex is unavailable. Install Codex and restart this application.',
      loginFailed: 'Could not open sign-in. Check Codex and try again.',
      loginIncomplete: 'Sign-in was not completed. Try again.',
      disconnected: 'Connection to Codex was lost. Reconnecting.',
      refreshFailed: 'Could not read limits. Check your connection and Codex sign-in. Retrying automatically.'
    }
  };
  const api = {
    languages: Object.keys(strings),
    t(language, key) { return (strings[language] || strings.ru)[key] || key; },
    apply(language, doc) {
      doc.documentElement.lang = language;
      doc.querySelectorAll('[data-i18n]').forEach(el => { const text = api.t(language, el.dataset.i18n); if (el.textContent !== text) el.textContent = text; });
      doc.querySelectorAll('[data-i18n-title]').forEach(el => { const text = api.t(language, el.dataset.i18nTitle); if (el.title !== text) el.title = text; });
      doc.querySelectorAll('[data-i18n-aria]').forEach(el => { const text = api.t(language, el.dataset.i18nAria); if (el.getAttribute('aria-label') !== text) el.setAttribute('aria-label', text); });
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsI18n = api;
})(globalThis);
