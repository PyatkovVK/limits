'use strict';
(function (root) {
  function date(unix) {
    if (typeof unix !== 'number' || !Number.isFinite(unix) || unix <= 0) return null;
    const value = new Date(unix * 1000);
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const locale = language => language === 'ru' ? 'ru-RU' : 'en-GB';
  const api = {
    countdown(unix, now = Date.now(), weekly = false) {
      if (!date(unix)) return '—';
      const minutes = Math.max(0, Math.ceil((unix * 1000 - now) / 60000));
      const hours = Math.floor(minutes / 60);
      const time = `${weekly ? String(hours % 24).padStart(2, '0') : hours}:${String(minutes % 60).padStart(2, '0')}`;
      return weekly ? `${Math.floor(hours / 24)}:${time}` : time;
    },
    renderWidget(element, unix, language, mode = 'clock', weekly = false, now = Date.now()) {
      element.hidden = mode === 'hidden';
      api.render(element, unix, language, now);
      if (mode === 'countdown') {
        const text = api.countdown(unix, now, weekly);
        if (element.textContent !== text) element.textContent = text;
      }
    },
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
  else {
    root.limitsWindowsResetClock = api;
    (root.limitsPlatform ??= {}).resetClock = api;
  }
})(globalThis);
