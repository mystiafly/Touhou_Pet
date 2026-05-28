const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 创建浏览器窗口
    const win = new BrowserWindow({
        width: 400,  // 桌宠窗口宽度
        height: 600, // 桌宠窗口高度 (从 500px 调大至 600px 以留出更多对话空间)
        x: width - 450, // 默认出现在右下角
        y: height - 650, // 底部对齐位置适配调高 100px
        frame: false,       // 无边框
        transparent: true,  // 透明背景
        alwaysOnTop: true,  // 始终置顶
        skipTaskbar: false, // 是否在任务栏显示（true则隐藏）
        resizable: false,   // 禁止改变大小
        webPreferences: {
            nodeIntegration: true
        }
    });

    // 加载 Flask 的桌宠页面
    // 注意：这里假设你的 Flask 运行在 5000 端口
    win.loadURL('http://127.0.0.1:5000/pet');

    // 开发时可以打开控制台调试 CSS
    // win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
