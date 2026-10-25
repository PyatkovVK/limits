'use strict';
(function (root) {
  function date(unix) {
    if (typeof unix !== 'number' || !Number.isFinite(unix) || unix <= 0) return null;
    const value = new Date(unix * 1000);
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const locale = language => language === 'ru' ? 'ru-RU' : 'en-GB';
  const api = {
    format(unix, language = 'ru', now = Date.now()) {
      const value = date(unix);
      if (!value) return '—';
      const today = new Date(now);
      const time = value.toLocaleTimeString(locale(language), { hour: '2-digit', minute: '2-digit', hour12: false });
      return value.toDateString() === today.toDateString() ? time :
        `${value.toLocaleDateString(locale(language), { day: '2-digit', month: '2-digit' })} ${time}`;
    },
    render(element, unix, language = 'ru', now = Date.now()) {
      const value = date(unix);
      const text = api.format(unix, language, now);
      const t = key => root.limitsI18n.t(language, key);
      const title = value ? `${t('resetsAt')}: ${value.toLocaleString(locale(language), { dateStyle: 'full', timeStyle: 'short' })}${value.getTime() <= now ? ` · ${t('resetPending')}` : ''}` : t('resetUnknown');
      if (element.textContent !== text) element.textContent = text;
      if (element.title !== title) element.title = title;
      element.dateTime = value ? value.toISOString() : '';
    },
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsWindowsResetClock = api;
})(globalThis);
