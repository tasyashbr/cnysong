const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => ipcRenderer.on(channel, (_e, payload) => cb(payload));

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('app:getState'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  connect: (clientId) => ipcRenderer.invoke('auth:connect', clientId),
  hide: () => ipcRenderer.invoke('window:hide'),
  onPlayer: (cb) => on('player:update', cb),
  onLyrics: (cb) => on('lyrics:update', cb),
  onSettings: (cb) => on('settings:update', cb),
  onSetup: (cb) => on('ui:setup', cb)
});
