'use strict';
(() => {
  const words = {
    ru: {
      downloading: 'Скачиваем обновление', verifying: 'Проверяем обновление…', ready: 'Обновление готово к установке.',
      installing: 'Устанавливаем обновление…', download: 'Скачать обновление', restart: 'Установить и перезапустить', retry: 'Повторить скачивание',
      downloadHint: 'Нажмите «Скачать обновление», чтобы начать загрузку. После проверки файла можно выбрать «Установить и перезапустить». Данные и настройки сохранятся.',
      downloadFailed: 'Не удалось скачать обновление. Проверьте подключение и повторите скачивание.',
      invalidPackage: 'Пакет не прошёл проверку. Установка отменена. Попробуйте скачать обновление ещё раз.',
      moveToApplications: 'Переместите Limits в папку «Программы» и перезапустите приложение для обновлений из приложения.',
      installFailed: 'Не удалось установить обновление. Предыдущая версия сохранена. Повторите попытку.',
      installLocation: 'Папка приложения недоступна для обновления. Выберите доступную для записи папку или переустановите Limits.',
      packageManagerMissing: 'Для установки DEB нужны dpkg и системный запрос прав pkexec. Установите их или используйте AppImage.',
    },
    en: {
      downloading: 'Downloading update', verifying: 'Verifying update…', ready: 'The update is ready to install.',
      installing: 'Installing update…', download: 'Download update', restart: 'Install and restart', retry: 'Retry download',
      downloadHint: 'Choose Download update to start downloading. After verification, choose Install and restart when convenient. Your accounts and settings are preserved.',
      downloadFailed: 'Could not download the update. Check your connection and retry.',
      invalidPackage: 'Package verification failed. Installation was cancelled. Try downloading the update again.',
      moveToApplications: 'Move Limits to Applications and restart it to enable in-app updates.',
      installFailed: 'Could not install the update. The previous version was preserved. Try again.',
      installLocation: 'The application location cannot be updated. Use a writable directory or reinstall Limits.',
      packageManagerMissing: 'DEB updates require dpkg and the system authorization tool pkexec. Install them or use AppImage.',
    },
  };
  window.limitsInstallation = {
    words(next) {
      if (!['darwin', 'win32', 'linux'].includes(next?.platform)) return {};
      const t = { ...(words[next.language] || words.en) };
      if (next.platform === 'win32') t.installFailed = next.language === 'ru' ? 'Не удалось завершить установку. Повторите попытку.' : 'Could not complete installation. Try again.';
      if (next.platform === 'linux') t.installFailed = next.language === 'ru' ? 'Не удалось установить обновление. Перезапустите приложение и повторите попытку.' : 'Could not install the update. Restart the application and retry.';
      return t;
    },
    presentation(next) {
      const value = next.updates?.installation;
      if (!['darwin', 'win32', 'linux'].includes(next.platform) || !value?.enabled) return null;
      const t = this.words(next);
      const differentVersion = value.version && next.updates.release && value.version !== next.updates.release.version;
      const status = differentVersion && value.status !== 'installing' ? 'idle' : value.status;
      const busy = ['downloading', 'verifying', 'installing'].includes(status);
      const presentation = { button: status === 'ready' ? t.restart : status === 'error' ? t.retry : busy ? t[status] : t.download,
        disabled: busy, hint: t.downloadHint };
      if (next.updates.status === 'checking' || next.updates.status === 'error') return presentation;
      return { ...presentation,
        result: status === 'downloading' ? `${t.downloading}${value.progress == null ? '…' : ` · ${value.progress}%`}` : status === 'error' ? t[value.error] : t[status],
        error: status === 'error' };
    },
  };
})();
