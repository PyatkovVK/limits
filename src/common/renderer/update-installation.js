'use strict';
(() => {
  const words = {
    ru: {
      downloading: 'Скачиваем обновление', verifying: 'Проверяем обновление…', ready: 'Обновление готово к установке.',
      installing: 'Устанавливаем обновление…', restart: 'Установить и перезапустить', retry: 'Повторить скачивание',
      automaticHint: 'Обновление скачивается автоматически. Нажмите «Установить и перезапустить», когда удобно. Данные и настройки сохранятся.',
      downloadFailed: 'Не удалось скачать обновление. Проверьте подключение и повторите скачивание.',
      invalidPackage: 'Пакет не прошёл проверку. Установка отменена. Попробуйте скачать обновление ещё раз.',
      moveToApplications: 'Переместите Limits в папку «Программы» и перезапустите приложение для автообновлений.',
      installFailed: 'Не удалось установить обновление. Предыдущая версия сохранена. Повторите попытку.',
    },
    en: {
      downloading: 'Downloading update', verifying: 'Verifying update…', ready: 'The update is ready to install.',
      installing: 'Installing update…', restart: 'Install and restart', retry: 'Retry download',
      automaticHint: 'Updates download automatically. Choose Install and restart when convenient. Your accounts and settings are preserved.',
      downloadFailed: 'Could not download the update. Check your connection and retry.',
      invalidPackage: 'Package verification failed. Installation was cancelled. Try downloading the update again.',
      moveToApplications: 'Move Limits to Applications and restart it to enable automatic updates.',
      installFailed: 'Could not install the update. The previous version was preserved. Try again.',
    },
  };
  window.limitsInstallation = {
    words(next) {
      if (!['darwin', 'win32'].includes(next?.platform)) return {};
      const t = { ...(words[next.language] || words.en) };
      if (next.platform === 'win32') t.installFailed = next.language === 'ru' ? 'Не удалось завершить установку. Повторите попытку.' : 'Could not complete installation. Try again.';
      return t;
    },
    presentation(next) {
      const value = next.updates?.installation;
      if (!['darwin', 'win32'].includes(next.platform) || !value?.enabled) return null;
      const t = this.words(next);
      const busy = ['downloading', 'verifying', 'installing'].includes(value.status);
      if (next.updates.status === 'checking' || next.updates.status === 'error') return { hint: t.automaticHint, disabled: busy };
      return { result: value.status === 'downloading' ? `${t.downloading}${value.progress == null ? '…' : ` · ${value.progress}%`}` : value.status === 'error' ? t[value.error] : t[value.status],
        button: value.status === 'ready' ? t.restart : value.status === 'error' ? t.retry : busy ? t[value.status] : null,
        disabled: busy, error: value.status === 'error', hint: t.automaticHint };
    },
  };
})();
