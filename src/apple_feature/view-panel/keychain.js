'use strict';
(() => {
  function createNotice(container) {
    const notice = document.createElement('div');
    notice.className = 'apple-keychain-notice';
    const message = document.createElement('span');
    const button = document.createElement('button');
    button.className = 'refresh-button';
    button.type = 'button';
    const failure = document.createElement('span');
    failure.hidden = true;
    button.onclick = async () => {
      button.disabled = true;
      try { failure.hidden = await window.limits.openCredentialStorage(); }
      catch { failure.hidden = false; }
      finally { button.disabled = false; }
    };
    notice.append(message, button, failure);
    container.replaceChildren(notice);
    return notice;
  }

  window.limitsPlatformNotice = {
    render(container, key, language) {
      if (key !== 'credentialStorageUnavailable') return false;
      const t = name => window.limitsAppleI18n.t(language, name);
      const notice = container.querySelector('.apple-keychain-notice') || createNotice(container);
      const [message, button, failure] = notice.children;
      const copy = t(key);
      const text = container.closest('.key-connection') ? `${copy} ${t('credentialStorageNotSaved')}` : copy;
      if (message.textContent !== text) message.textContent = text;
      if (button.textContent !== t('openKeychain')) button.textContent = t('openKeychain');
      if (failure.textContent !== t('keychainOpenFailed')) failure.textContent = t('keychainOpenFailed');
      container.hidden = false;
      return true;
    }
  };
})();
