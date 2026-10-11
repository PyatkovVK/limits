'use strict';
(function (root) {
  const api = {
    // Minute precision, rounded up. Percentages still change only from server data.
    format(unix, now = Date.now()) {
      if (typeof unix !== 'number' || !Number.isFinite(unix) || unix <= 0) return '—';
      const minutes = Math.max(0, Math.ceil((unix * 1000 - now) / 60000));
      return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    },
    render(element, unix, language, now = Date.now()) {
      const text = api.format(unix, now);
      const t = key => root.limitsI18n.t(language, key);
      const title = text === '—' ? t('resetUnknown') : text === '0:00' ? t('resetPending') : `${t('resetIn')}: ${text} (${t('hoursMinutes')})`;
      if (element.textContent !== text) element.textContent = text;
      if (element.title !== title) element.title = title;
      const dateTime = typeof unix === 'number' && Number.isFinite(unix) && unix > 0 && unix < 8640000000000 ? new Date(unix * 1000).toISOString() : '';
      if (element.dateTime !== dateTime) element.dateTime = dateTime;
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsCountdown = api;
})(globalThis);
