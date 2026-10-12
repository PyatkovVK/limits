const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('limits', {
  get: () => ipcRenderer.invoke('limits:get'),
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
  login: id => ipcRenderer.invoke('limits:login', id),
  addAccount: () => ipcRenderer.invoke('limits:profile-add'),
  accountAction: (action, id, value) => ipcRenderer.invoke('limits:profile-action', action, id, value),
  select: id => ipcRenderer.invoke('limits:select', id),
  language: language => ipcRenderer.invoke('limits:language', language),
  displayMode: mode => ipcRenderer.invoke('limits:display-mode', mode),
  preference: (key, value) => ipcRenderer.invoke('limits:preference', key, value),
  onSettingsOpen: callback => {
    const listener = () => callback();
    ipcRenderer.on('limits:open-settings', listener);
    return () => ipcRenderer.removeListener('limits:open-settings', listener);
  },
  panelSize: height => ipcRenderer.invoke('limits:panel-size', height),
  hide: () => ipcRenderer.invoke('limits:hide'),
  open: () => ipcRenderer.invoke('limits:open'),
  quit: () => ipcRenderer.invoke('limits:quit'),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('limits:state', listener);
    return () => ipcRenderer.removeListener('limits:state', listener);
  }
});
