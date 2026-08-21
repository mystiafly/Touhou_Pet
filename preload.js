// preload.js — 在预加载脚本中获取 ipcRenderer 并暴露给页面
// preload 脚本在 BrowserWindow 加载页面前执行，require 始终可用
const { ipcRenderer, webFrame } = require('electron');

try {
    webFrame.setZoomFactor(1.0);
    webFrame.setVisualZoomLevelLimits(1, 1);
} catch(e) {}

// 拦截 Ctrl + 滚轮 / Ctrl + +/- 快捷键，防止误触导致桌宠变形变小
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_' || e.key === '0')) {
        e.preventDefault();
        try {
            webFrame.setZoomFactor(1.0);
        } catch(err) {}
    }
}, { capture: true });

window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false, capture: true });

// contextIsolation: false 时，直接挂到 window 即可被页面访问
window.__petIPC = {
    sendSetIgnoreMouseEvents: (ignore, options) => {
        ipcRenderer.send('set-ignore-mouse-events', ignore, options);
    },
    sendWindowDrag: (deltaX, deltaY) => {
        ipcRenderer.send('window-drag', { deltaX, deltaY });
    },
    sendWindowDragEnd: () => {
        ipcRenderer.send('window-drag-end');
    },
    onGlobalMouseMove: (callback) => {
        ipcRenderer.on('global-mouse-move', (event, point) => callback(point));
    },
    onPetHideEdge: (callback) => {
        ipcRenderer.on('pet-hide-edge', (event, side) => callback(side));
    },
    onPetRestore: (callback) => {
        ipcRenderer.on('pet-restore', () => callback());
    },
    sendPetRestore: () => {
        ipcRenderer.send('pet-click-restore');
    },
    sendExitApp: () => {
        ipcRenderer.send('exit-app');
    },
    sendMinimizeToTray: () => {
        ipcRenderer.send('minimize-to-tray');
    },
    onWindowStateChanged: (callback) => {
        ipcRenderer.on('window-state-changed', (event, state) => callback(state));
    },
    openSettingsWindow: () => {
        ipcRenderer.send('open-settings-window');
    },
    sendEnterImmersiveMode: () => {
        ipcRenderer.send('enter-immersive-mode');
    },
    sendExitImmersiveMode: () => {
        ipcRenderer.send('exit-immersive-mode');
    },
    onImmersiveModeState: (callback) => {
        ipcRenderer.on('immersive-mode-state', (event, state) => callback(state));
    },
    captureImmersiveScreenshot: () => {
        return ipcRenderer.invoke('capture-immersive-screenshot');
    },
    setAutostart: (enable) => {
        return ipcRenderer.invoke('set-autostart', enable);
    },
    getAutostart: () => {
        return ipcRenderer.invoke('get-autostart');
    }
};

console.log('[PRELOAD] Pet IPC bridge ready');
