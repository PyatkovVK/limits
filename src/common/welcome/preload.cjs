'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('limitsWelcome', {
  get: () => ipcRenderer.invoke('limits:welcome:get'),
  finish: () => ipcRenderer.invoke('limits:welcome:finish'),
});
