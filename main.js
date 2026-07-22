const { app, BrowserWindow, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 关闭不必要的安全警告输出，保持控制台整洁
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

function logDebug(msg) {
    fs.appendFileSync(path.join(__dirname, 'edge_debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
}

// 保持对 window 对象的全局引用
let mainWindow;
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
        if (win.petIsHidden) {
            win.petIsHidden = false; // 用户主动拖动时，解除隐藏状态
            win.webContents.send('pet-restore');
        }
        const [x, y] = win.getPosition();
        win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
});



// 监听由点击触发的恢复事件（点出来）
ipcMain.on('pet-click-restore', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.petIsHidden) {
        win.petIsHidden = false;
        win.setPosition(win.petRestoreX, win.petRestoreY);
        win.webContents.send('pet-restore');
    }
});

ipcMain.on('window-drag-end', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    
    const bounds = win.getBounds();
    const workArea = screen.getDisplayMatching(bounds).workArea;
    const snapDistance = -150; // 距离边缘多少像素触发吸附（负数表示需要把窗口拖出屏幕该像素值，实现“压入身子”再触发）
    const exposedPixels = 140; // 吸附后露出的宽度（保证“暗中观察”图能看清）
    
    let newX = bounds.x;
    let newY = bounds.y;
    let hidden = false;
    let side = '';
    
    // 如果拖到了最上方（因为窗口高600且宠物在底部，增加容错，只有大半个窗口都出去了才算拖到顶部）
    if (bounds.y <= workArea.y - 450) {
        const center = bounds.x + bounds.width / 2;
        const workAreaCenter = workArea.x + workArea.width / 2;
        if (center < workAreaCenter) {
            // 滑向左边
            newX = workArea.x - bounds.width + exposedPixels;
            side = 'left';
        } else {
            // 滑向右边
            newX = workArea.x + workArea.width - exposedPixels;
            side = 'right';
        }
        win.petRestoreX = (side === 'left') ? workArea.x : (workArea.x + workArea.width - bounds.width);
        win.petRestoreY = bounds.y; // 保持原有高度
        hidden = true;
    } 
    // 正常的左右吸附
    else if (bounds.x <= workArea.x + snapDistance) {
        newX = workArea.x - bounds.width + exposedPixels;
        win.petRestoreX = workArea.x;
        win.petRestoreY = bounds.y;
        hidden = true;
        side = 'left';
    } else if (bounds.x + bounds.width >= workArea.x + workArea.width - snapDistance) {
        newX = workArea.x + workArea.width - exposedPixels;
        win.petRestoreX = workArea.x + workArea.width - bounds.width;
        win.petRestoreY = bounds.y;
        hidden = true;
        side = 'right';
    }
    
    if (hidden) {
        win.petIsHidden = true;
        win.petMouseLeft = false; // 必须等鼠标先离开，才能触发悬浮弹回
        win.petHideSide = side; // 记录隐藏在哪一侧
        win.setPosition(newX, newY);
        // 通知前端切换探头素材
        win.webContents.send('pet-hide-edge', side);
        
        logDebug(`HIDDEN on ${side}. newX=${newX}, bounds=${JSON.stringify(win.getBounds())}, cursor=${JSON.stringify(screen.getCursorScreenPoint())}`);
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
        if (settingsWin.isMinimized()) {
            settingsWin.restore();
        }
        settingsWin.show(); // 确保窗口不仅focus，还能正确置顶显示
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
            
            // 悬浮弹回逻辑已根据用户要求移除，现在只能通过点击或拖拽出来
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
