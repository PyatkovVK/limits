const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('limits', {
  get: () => ipcRenderer.invoke('limits:get'),
  platformAssets: () => ipcRenderer.invoke('limits:platform-assets'),
  appearance: () => ipcRenderer.invoke('limits:appearance-get'),
  setAppearance: value => ipcRenderer.invoke('limits:appearance-set', value),
  chooseBackground: () => ipcRenderer.invoke('limits:appearance-choose'),
  backgroundImage: () => ipcRenderer.invoke('limits:appearance-image'),
  onAppearance: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('limits:appearance-state', listener);
    return () => ipcRenderer.removeListener('limits:appearance-state', listener);
  },
  refresh: () => ipcRenderer.invoke('limits:refresh'),
  checkUpdates: () => ipcRenderer.invoke('limits:updates-check'),
  openRelease: () => ipcRenderer.invoke('limits:updates-open'),
  dismissUpdate: version => ipcRenderer.invoke('limits:updates-dismiss', version),
  demoUpdate: scenario => ipcRenderer.invoke('limits:updates-demo', scenario),
  setResetNotifications: enabled => ipcRenderer.invoke('limits:reset-notifications-set', enabled),
  openResetLink: kind => ipcRenderer.invoke('limits:reset-notifications-open', kind),
  demoReset: scenario => ipcRenderer.invoke('limits:reset-notifications-demo', scenario),
  login: id => ipcRenderer.invoke('limits:login', id),
  addAccount: providerId => ipcRenderer.invoke('limits:profile-add', providerId),
  submitApiKey: (id, key) => ipcRenderer.invoke('limits:key-submit', id, key),
  cancelApiKey: id => ipcRenderer.invoke('limits:key-cancel', id),
  openKeyBrowser: id => ipcRenderer.invoke('limits:key-browser', id),
  openCredentialStorage: () => ipcRenderer.invoke('limits:credential-storage-open'),
  accountAction: (action, id, value) => ipcRenderer.invoke('limits:profile-action', action, id, value),
  subscriptionMode: mode => ipcRenderer.invoke('limits:subscriptions-mode', mode),
  select: id => ipcRenderer.invoke('limits:select', id),
  language: language => ipcRenderer.invoke('limits:language', language),
  displayMode: mode => ipcRenderer.invoke('limits:display-mode', mode),
  dismissNotification: id => ipcRenderer.invoke('limits:notification-dismiss', id),
  openNotification: id => ipcRenderer.invoke('limits:notification-open', id),
  preference: (key, value) => ipcRenderer.invoke('limits:preference', key, value),
  onSettingsOpen: callback => {
    const listener = () => callback();
    ipcRenderer.on('limits:open-settings', listener);
    return () => ipcRenderer.removeListener('limits:open-settings', listener);
  },
  panelSize: (height, surface) => ipcRenderer.invoke('limits:panel-size', height, surface),
  hide: () => ipcRenderer.invoke('limits:hide'),
  open: () => ipcRenderer.invoke('limits:open'),
  toggleDetails: () => ipcRenderer.invoke('limits:toggle-details'),
  quit: () => ipcRenderer.invoke('limits:quit'),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('limits:state', listener);
    return () => ipcRenderer.removeListener('limits:state', listener);
  }
});
