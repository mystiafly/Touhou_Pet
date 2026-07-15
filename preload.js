// preload.js — 在预加载脚本中获取 ipcRenderer 并暴露给页面
// preload 脚本在 BrowserWindow 加载页面前执行，require 始终可用
const { ipcRenderer } = require('electron');

// contextIsolation: false 时，直接挂到 window 即可被页面访问
window.__petIPC = {
    sendSetIgnoreMouseEvents: (ignore, options) => {
        ipcRenderer.send('set-ignore-mouse-events', ignore, options);
    },
    sendWindowDrag: (deltaX, deltaY) => {
        ipcRenderer.send('window-drag', { deltaX, deltaY });
    },
    onGlobalMouseMove: (callback) => {
        ipcRenderer.on('global-mouse-move', (event, point) => callback(point));
    },
    sendExitApp: () => {
        ipcRenderer.send('exit-app');
    },
    sendMinimizeToTray: () => {
        ipcRenderer.send('minimize-to-tray');
    },
    onWindowStateChanged: (callback) => {
        ipcRenderer.on('window-state-changed', (event, state) => callback(state));
    }
};

console.log('[PRELOAD] Pet IPC bridge ready');
