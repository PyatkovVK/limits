'use strict';
(() => {
  const words = {
    ru: {
      downloading: 'Скачиваем обновление', verifying: 'Проверяем обновление…', ready: 'Обновление готово к установке.',
      installing: 'Устанавливаем обновление…', restart: 'Установить и перезапустить', retry: 'Повторить скачивание',
      automaticHint: 'Limits сам скачивает ZIP для вашего Mac из GitHub Releases, собранный в Actions, и проверяет SHA-256. Установите обновление с перезапуском, когда удобно.',
      downloadFailed: 'Не удалось скачать обновление. Проверьте подключение и повторите скачивание.',
      invalidPackage: 'Пакет не прошёл проверку. Установка отменена. Попробуйте скачать обновление ещё раз.',
      moveToApplications: 'Переместите Limits в папку «Программы» и перезапустите приложение для автообновлений.',
      installFailed: 'Не удалось установить обновление. Предыдущая версия сохранена. Повторите попытку.',
    },
    en: {
      downloading: 'Downloading update', verifying: 'Verifying update…', ready: 'The update is ready to install.',
      installing: 'Installing update…', restart: 'Install and restart', retry: 'Retry download',
      automaticHint: 'Limits downloads the Actions-built ZIP for your Mac from GitHub Releases and verifies SHA-256. Install and restart when convenient.',
      downloadFailed: 'Could not download the update. Check your connection and retry.',
      invalidPackage: 'Package verification failed. Installation was cancelled. Try downloading the update again.',
      moveToApplications: 'Move Limits to Applications and restart it to enable automatic updates.',
      installFailed: 'Could not install the update. The previous version was preserved. Try again.',
    },
  };
  window.limitsAppleUpdates = {
    words(next) { return next?.platform === 'darwin' ? words[next.language] || words.en : {}; },
    presentation(next) {
      const value = next.updates?.installation;
      if (next.platform !== 'darwin' || !value?.enabled) return null;
      const t = words[next.language] || words.en;
      const busy = ['downloading', 'verifying', 'installing'].includes(value.status);
      if (next.updates.status === 'checking' || next.updates.status === 'error') return { hint: t.automaticHint, disabled: busy };
      return { result: value.status === 'downloading' ? `${t.downloading}${value.progress == null ? '…' : ` · ${value.progress}%`}` : value.status === 'error' ? t[value.error] : t[value.status],
        button: value.status === 'ready' ? t.restart : value.status === 'error' ? t.retry : busy ? t[value.status] : null,
        disabled: busy, error: value.status === 'error', hint: t.automaticHint };
    },
  };
})();
