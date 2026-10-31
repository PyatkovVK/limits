'use strict';
(function (root) {
  const words = {
    ru: {
      title: 'Сбросы Codex', enabled: 'Получать уведомления о сбросах', help: 'Об интеграции',
      description: 'Интеграция с codex-resets.com. После включения Limits проверяет API при запуске и каждый час: сообщает об объявленном будущем сбросе или активном прогнозе. Прогноз может не подтвердиться. О выполненных сбросах не уведомляем. Данные аккаунтов не отправляются.',
      thanks: 'Спасибо автору сайта, ', thanksEnd: ', за открытый API!', source: 'Источник: ',
      disabled: 'Уведомления выключены.', idle: 'Ожидаем проверки.', checking: 'Проверяем объявления…', quiet: 'Предстоящих сбросов и активных прогнозов нет.',
      lastCheck: 'Последняя проверка', scheduled: 'Объявлен будущий сброс Codex', banked: 'Объявлен будущий запасной сброс Codex',
      timeUnknown: 'Точное время пока не объявлено.', forecast: 'Прогноз: возможен сброс Codex', chance: 'Вероятность',
      forecastHint: 'Прогноз сайта, а не подтверждённое обещание OpenAI.', until: 'Действует до',
      checkFailed: 'Не удалось проверить объявления. Повторим проверку через час.', timeout: 'Сайт не ответил вовремя. Повторим через час.',
      rateLimited: 'Сайт ограничил запросы. Повторим проверку позже.', invalidResponse: 'Не удалось прочитать ответ сайта. Повторим через час.',
      saveFailed: 'Не удалось сохранить настройку или историю уведомлений.', notificationFailed: 'Не удалось показать уведомление. Проверьте разрешение на уведомления в системе.',
      unavailable: 'Действие сейчас недоступно.', openFailed: 'Не удалось открыть сайт в браузере.',
      demo: 'Результат в демо', demoQuiet: 'Нет объявлений', demoScheduled: 'Будущий сброс', demoForecast: 'Прогноз', demoError: 'Ошибка проверки',
      simulated: 'Демо: уведомления, запросы и открытие ссылок имитируются.',
    },
    en: {
      title: 'Codex resets', enabled: 'Receive reset notifications', help: 'About this integration',
      description: 'Integration with codex-resets.com. Once enabled, Limits checks the API at startup and every hour for an announced upcoming reset or an active forecast. Forecasts may not come true. Completed resets do not trigger notifications. No account data is sent.',
      thanks: 'Thanks to the site author, ', thanksEnd: ', for the public API!', source: 'Source: ',
      disabled: 'Notifications are off.', idle: 'Waiting for a check.', checking: 'Checking announcements…', quiet: 'No upcoming resets or active forecasts.',
      lastCheck: 'Last check', scheduled: 'An upcoming Codex reset was announced', banked: 'An upcoming banked Codex reset was announced',
      timeUnknown: 'The exact time has not been announced.', forecast: 'Forecast: a Codex reset is possible', chance: 'Chance',
      forecastHint: 'A forecast by the site, not a confirmed commitment from OpenAI.', until: 'Valid until',
      checkFailed: 'Could not check announcements. Retrying in an hour.', timeout: 'The site did not respond in time. Retrying in an hour.',
      rateLimited: 'The site has limited requests. Retrying later.', invalidResponse: 'Could not read the site response. Retrying in an hour.',
      saveFailed: 'Could not save the setting or notification history.', notificationFailed: 'Could not show a notification. Check system notification permissions.',
      unavailable: 'This action is unavailable right now.', openFailed: 'Could not open the site in your browser.',
      demo: 'Demo result', demoQuiet: 'No announcements', demoScheduled: 'Upcoming reset', demoForecast: 'Forecast', demoError: 'Check failed',
      simulated: 'Demo: notifications, requests and link opening are simulated.',
    },
  };
  function eventText(event, language) {
    const t = words[language] || words.en;
    const date = value => new Date(value).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
    if (event.kind === 'scheduled') return `${event.resetType === 'banked' ? t.banked : t.scheduled}. ${event.scheduledFor === null ? t.timeUnknown : date(event.scheduledFor)}`;
    return `${t.forecast}.${event.chance === null ? '' : ` ${t.chance}: ${event.chance}%.`} ${t.until}: ${date(event.expiresAt)}. ${t.forecastHint}`;
  }
  const api = { words, eventText };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsResetStrings = api;
})(globalThis);
