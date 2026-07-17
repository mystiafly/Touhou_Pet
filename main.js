const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let tray = null;

function createTray(win) {
    if (tray) return;
    tray = new Tray(path.join(__dirname, 'rumia_tray.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示桌宠',
            click: () => {
                win.show();
                win.webContents.send('window-state-changed', 'restored');
            }
        },
        {
            label: '退出游戏',
            click: () => {
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Pet Engine (托盘)');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        win.show();
        win.webContents.send('window-state-changed', 'restored');
    });
}

// 监听渲染进程发送的穿透事件，动态切换鼠标忽略状态
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setIgnoreMouseEvents(ignore, options);
    }
});

// 监听渲染进程发送的拖拽事件
ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
});

// 监听渲染进程发送的退出事件，直接结束 Electron 进程
ipcMain.on('exit-app', () => {
    app.quit();
});

// 监听重启事件，脱离当前进程启动脚本后关闭自身
ipcMain.on('restart-app', () => {
    const { spawn } = require('child_process');
    // 使用独立的 VBScript 进行重启，彻底摆脱控制台句柄继承问题
    const cp = spawn('wscript', ['restart.vbs'], {
        cwd: path.join(__dirname),
        detached: true,
        stdio: 'ignore'
    });
    cp.unref();
    app.quit();
});

// 监听最小化到系统托盘事件
ipcMain.on('minimize-to-tray', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.hide();
        createTray(win); // 确保托盘已创建
        win.webContents.send('window-state-changed', 'minimized');
    }
});

let settingsWin = null;
ipcMain.on('open-settings-window', (event) => {
    if (settingsWin) {
        settingsWin.focus();
        return;
    }
    
    settingsWin = new BrowserWindow({
        width: 1000,
        height: 700,
        title: "大贤者控制台 (Dashboard)",
        autoHideMenuBar: true,
        backgroundColor: '#1e1e28',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const dashboardUrl = 'http://127.0.0.1:5000/dashboard?t=' + Date.now();
    settingsWin.loadURL(dashboardUrl);
    
    settingsWin.on('closed', () => {
        settingsWin = null;
    });
});


function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 閸掓稑缂撳ù蹇氼潔閸ｃ劎鐛ラ崣?
    const win = new BrowserWindow({
        width: 400,  // 濡楀苯鐤囩粣妤€褰涚€硅棄瀹?
        height: 600, // 濡楀苯鐤囩粣妤€褰涙妯哄 (娴?500px 鐠嬪啫銇囬懛?600px 娴犮儳鏆€閸戠儤娲挎径姘嚠鐠囨繄鈹栭梻?
        x: width - 450, // 姒涙顓婚崙铏瑰箛閸︺劌褰告稉瀣潡
        y: height - 650, // 鎼存洟鍎寸€靛綊缍堟担宥囩枂闁倿鍘ょ拫鍐彯 100px
        frame: false,       // 閺冪姾绔熷?
        transparent: true,  // 闁繑妲戦懗灞炬珯
        alwaysOnTop: true,  // 婵绮撶純顕€銆?
        skipTaskbar: false, // 閺勵垰鎯侀崷銊ゆ崲閸斺剝鐖弰鍓с仛閿涘澅rue閸掓瑩娈ｉ挊蹇ョ礆
        resizable: false,   // 缁備焦顒涢弨鐟板綁婢堆冪毈
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 閸旂姾娴?Flask/FastAPI 閻ㄥ嫭顢戠€圭娀銆夐棃?(閺€顖涘瘮閸氬骸褰撮幈銏犳儙閸斻劍妫ら梽鎰板櫢鐠囨洜娲块崚鎷岀箾閹恒儲鍨氶崝?
    const petUrl = 'http://127.0.0.1:5000/pet?t=' + Date.now();
    function loadPetPage() {
        win.webContents.session.clearCache().then(() => {
            win.loadURL(petUrl).then(() => {
                console.log(`[ELECTRON] Page loaded successfully`);
            }).catch(err => {
                console.log(`[ELECTRON] Page load failed, retrying in 1.5s...`);
                setTimeout(loadPetPage, 1500);
            });
        });
    }
    loadPetPage();

    // 定时向渲染进程推送系统级全局鼠标坐标 (每 50ms 一次，解决 Windows 11 下 setIgnoreMouseEvents 导致 mousemove 停止触发的系统 Bug)
    const mouseTimer = setInterval(() => {
        if (win && !win.isDestroyed()) {
            const point = screen.getCursorScreenPoint();
            win.webContents.send('global-mouse-move', point);
        }
    }, 50);

    win.on('closed', () => {
        clearInterval(mouseTimer);
    });

    win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
