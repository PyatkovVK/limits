'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('limitsWindows', {
  panelSize: height => ipcRenderer.invoke('limits:windows-panel-size', height),
  widgetDrag: phase => ipcRenderer.invoke('limits:widget-drag', phase),
});
