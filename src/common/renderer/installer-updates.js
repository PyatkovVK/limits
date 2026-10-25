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
      installFailed: 'Не удалось установить обновление. Перезапустите приложение и повторите попытку.',
      installLocation: 'Папка приложения недоступна для обновления. Выберите доступную для записи папку или переустановите Limits.',
      packageManagerMissing: 'Для установки DEB нужны dpkg и системный запрос прав pkexec. Установите их или используйте AppImage.',
    },
    en: {
      downloading: 'Downloading update', verifying: 'Verifying update…', ready: 'The update is ready to install.',
      installing: 'Installing update…', restart: 'Install and restart', retry: 'Retry download',
      automaticHint: 'Updates download automatically. Choose Install and restart when convenient. Your accounts and settings are preserved.',
      downloadFailed: 'Could not download the update. Check your connection and retry.',
      invalidPackage: 'Package verification failed. Installation was cancelled. Try downloading the update again.',
      moveToApplications: 'Move Limits to Applications and restart it to enable automatic updates.',
      installFailed: 'Could not install the update. Restart the application and retry.',
      installLocation: 'The application location cannot be updated. Use a writable directory or reinstall Limits.',
      packageManagerMissing: 'DEB updates require dpkg and the system authorization tool pkexec. Install them or use AppImage.',
    },
  };
  window.limitsInstallerUpdates = {
    words(next) { return words[next?.language] || words.en; },
    presentation(next) {
      const value = next.updates?.installation;
      if (!value?.enabled) return null;
      const t = words[next.language] || words.en;
      const busy = ['downloading', 'verifying', 'installing'].includes(value.status);
      if (next.updates.status === 'checking' || next.updates.status === 'error') return { hint: t.automaticHint, disabled: busy };
      return { result: value.status === 'downloading' ? `${t.downloading}${value.progress == null ? '…' : ` · ${value.progress}%`}` : value.status === 'error' ? t[value.error] : t[value.status],
        button: value.status === 'ready' ? t.restart : value.status === 'error' ? t.retry : busy ? t[value.status] : null,
        disabled: busy, error: value.status === 'error', hint: t.automaticHint };
    },
  };
})();
