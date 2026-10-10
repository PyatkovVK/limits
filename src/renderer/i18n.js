'use strict';
(function (root) {
  const strings = {
    ru: {
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
      tooltip: 'Codex Limits · панель задач', lowTitle: 'Codex: лимит заканчивается',
      unsupported: 'Лимиты подписки доступны при входе через ChatGPT. Сейчас используется другой способ авторизации.',
      noLimits: 'Сервис пока не вернул данные о лимитах.', cached: 'Показаны последние полученные данные. Ожидаем обновление.',
      waiting: 'Ожидаем данные', updated: 'Обновлено в', noData: 'нет данных', minutes: 'мин',
      codexMissing: 'Не найден Codex. Установите приложение Codex или Codex CLI, затем перезапустите Codex Limits.',
      taskbarMissing: 'Панель задач временно недоступна. Восстанавливаем виджет.',
      loginUnavailable: 'Codex недоступен. Установите Codex и перезапустите приложение.',
      loginFailed: 'Не удалось открыть вход. Проверьте Codex и попробуйте ещё раз.',
      loginIncomplete: 'Вход не завершён. Попробуйте ещё раз.',
      disconnected: 'Связь с Codex потеряна. Повторяем подключение.',
      refreshFailed: 'Не удалось получить лимиты. Проверьте интернет и вход в Codex. Повторяем автоматически.'
    },
    en: {
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
      tooltip: 'Codex Limits · taskbar', lowTitle: 'Codex: limit running low',
      unsupported: 'Subscription limits require ChatGPT sign-in. Codex currently uses another authentication method.',
      noLimits: 'The service has not returned limit data yet.', cached: 'Showing the last received data. Waiting for an update.',
      waiting: 'Waiting for data', updated: 'Updated at', noData: 'no data', minutes: 'min',
      codexMissing: 'Codex was not found. Install the Codex app or Codex CLI, then restart Codex Limits.',
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
      doc.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = api.t(language, el.dataset.i18n); });
      doc.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = api.t(language, el.dataset.i18nTitle); });
      doc.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', api.t(language, el.dataset.i18nAria)); });
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsI18n = api;
})(globalThis);
