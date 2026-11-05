'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  getState: () => ipcRenderer.invoke('state:get'),
  getPet: (id) => ipcRenderer.invoke('pet:get', id),
  ack: () => ipcRenderer.send('state:ack'),
  installHooks: () => ipcRenderer.invoke('hooks:install'),
  onState: (fn) => ipcRenderer.on('state', (_e, snap) => fn(snap)),
  onPetChanged: (fn) => ipcRenderer.on('pet:changed', () => fn()),
  onTune: (fn) => ipcRenderer.on('tune', () => fn()),
  setScale: (scale, persist) => ipcRenderer.send('scale:set', scale, persist),
  onCard: (fn) => ipcRenderer.on('card', (_e, card) => fn(card)),
  onVoiceProgress: (fn) => ipcRenderer.on('voice:progress', (_e, percent) => fn(percent)),
  voiceAccess: () => ipcRenderer.invoke('voice:access'),
  transcribe: (samples) => ipcRenderer.invoke('voice:transcribe', samples),
  runPrompt: (prompt) => ipcRenderer.invoke('prompt:run', prompt),
  claudeLogin: () => ipcRenderer.send('claude:login'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('mouse:ignore', ignore),
  dragStart: () => ipcRenderer.send('drag:start'),
  dragEnd: () => ipcRenderer.send('drag:end'),
  openMenu: () => ipcRenderer.send('menu:open'),
  setTrayIcon: (dataUrl) => ipcRenderer.send('tray:icon', dataUrl),
  copy: (text) => ipcRenderer.send('clipboard:write', text),
});
