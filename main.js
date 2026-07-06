const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// 监听渲染进程发送的穿透事件，动态切换鼠标忽略状态
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setIgnoreMouseEvents(ignore, options);
    }
});

// 监听渲染进程发送的拖拽事件，动态移动窗口位置
ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
});

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
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 加载 Flask/FastAPI 的桌宠页面 (支持后台慢启动无限重试直到连接成功)
    const petUrl = 'http://127.0.0.1:5000/pet';
    function loadPetPage() {
        win.loadURL(petUrl).then(() => {
            console.log(`[ELECTRON] 成功连接并加载桌宠页面！`);
        }).catch(err => {
            console.log(`[ELECTRON] 页面请求拒绝 (后端尚未就绪)，在 1.5 秒后继续自动重试...`);
            setTimeout(loadPetPage, 1500);
        });
    }
    loadPetPage();

    // 开发时可以打开控制台调试 CSS
    win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
