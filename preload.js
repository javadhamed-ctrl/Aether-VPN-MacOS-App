const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  serversList: () => ipcRenderer.invoke('avpn-servers'),
  connect: (id) => ipcRenderer.invoke('avpn-connect', id),
  disconnect: () => ipcRenderer.invoke('avpn-disconnect'),
  status: () => ipcRenderer.invoke('avpn-status'),
  login: (email) => ipcRenderer.invoke('avpn-login', email),
  keys: () => ipcRenderer.invoke('avpn-keys'),
  help: () => ipcRenderer.invoke('avpn-help')
});
