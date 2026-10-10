const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('limits', {
  get: () => ipcRenderer.invoke('limits:get'),
  refresh: () => ipcRenderer.invoke('limits:refresh'),
  login: () => ipcRenderer.invoke('limits:login'),
  select: id => ipcRenderer.invoke('limits:select', id),
  hide: () => ipcRenderer.invoke('limits:hide'),
  open: () => ipcRenderer.invoke('limits:open'),
  quit: () => ipcRenderer.invoke('limits:quit'),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('limits:state', listener);
    return () => ipcRenderer.removeListener('limits:state', listener);
  }
});
