'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  getState: () => ipcRenderer.invoke('launcher:get-state'),
  checkForUpdate: () => ipcRenderer.invoke('launcher:check-for-update'),
  installUpdate: () => ipcRenderer.invoke('launcher:install-update'),
  launchFormalApp: () => ipcRenderer.invoke('launcher:launch-formal-app'),
  quit: () => ipcRenderer.invoke('launcher:quit'),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('launcher:update-progress', listener);
    return () => ipcRenderer.removeListener('launcher:update-progress', listener);
  },
});
