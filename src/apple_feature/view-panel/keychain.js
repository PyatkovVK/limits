'use strict';
(() => {
  function createNotice(container, key, action) {
    const notice = document.createElement('div');
    notice.className = 'apple-keychain-notice';
    notice.dataset.key = key;
    const message = document.createElement('span');
    const button = document.createElement('button');
    button.className = 'refresh-button';
    button.type = 'button';
    const failure = document.createElement('span');
    failure.hidden = true;
    button.onclick = async () => {
      button.disabled = true;
      try { failure.hidden = await action(); }
      catch { failure.hidden = false; }
      finally { button.disabled = false; }
    };
    notice.append(message, button, failure);
    container.replaceChildren(notice);
    return notice;
  }

  window.limitsPlatformNotice = {
    render(container, key, language) {
      const permission = key === 'credentialStoragePermissionRequired';
      if (!permission && key !== 'credentialStorageUnavailable') return false;
      const t = name => window.limitsAppleI18n.t(language, name);
      const action = permission ? window.limits.requestCredentialStorage : window.limits.openCredentialStorage;
      const notice = container.querySelector(`[data-key="${key}"]`) || createNotice(container, key, action);
      const [message, button, failure] = notice.children;
      const copy = t(permission ? 'keychainAccessExplanation' : key);
      const text = !permission && container.closest('.key-connection') ? `${copy} ${t('credentialStorageNotSaved')}` : copy;
      if (message.textContent !== text) message.textContent = text;
      const buttonText = t(permission ? 'requestKeychainAccess' : 'openKeychain');
      const failureText = t(permission ? 'keychainAccessFailed' : 'keychainOpenFailed');
      if (button.textContent !== buttonText) button.textContent = buttonText;
      if (failure.textContent !== failureText) failure.textContent = failureText;
      container.hidden = false;
      return true;
    }
  };
})();
