const { app, BrowserWindow, screen, ipcMain, Tray, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

let autoHiddenByGame = false;

// 关闭不必要的安全警告输出，保持控制台整洁
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function logDebug(msg) {
    try {
        let logDir;
        if (app.isPackaged) {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            logDir = path.join(appData, 'RumiaDesktopPet', 'logs');
        } else {
            logDir = path.join(__dirname, 'logs');
        }
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(path.join(logDir, 'electron_debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
    } catch(e) {}
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
                autoHiddenByGame = false;
                win.show();
                win.webContents.send('window-state-changed', 'restored');
            }
        },
        {
            label: '打开日志目录',
            click: () => {
                const { shell } = require('electron');
                const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
                const logDir = path.join(appData, 'RumiaDesktopPet', 'logs');
                if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                shell.openPath(logDir);
            }
        },
        {
            type: 'separator'
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
        autoHiddenByGame = false;
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
        if (win.isImmersiveMode) return; // 沉浸模式下禁用拖拽吸附
        if (win.petIsHidden) {
            win.petIsHidden = false; // 用户主动拖动时，解除隐藏状态
            win.webContents.send('pet-restore');
        }
        const bounds = win.getBounds();
        // 强制锁定宽高，防止 Windows 下多屏幕/DPI 拖动导致的自动放大 Bug
        win.setBounds({
            x: Math.round(bounds.x + deltaX),
            y: Math.round(bounds.y + deltaY),
            width: 400,
            height: 600
        });
    }
});

// 监听进入沉浸模式
ipcMain.on('enter-immersive-mode', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (!win.isImmersiveMode) {
            win.normalBounds = win.getBounds();
        }
        win.isImmersiveMode = true;
        const display = screen.getDisplayMatching(win.getBounds());
        win.setBounds(display.bounds);
        // 恢复锁屏/屏保级最顶层优先级
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setIgnoreMouseEvents(false);
        win.webContents.send('immersive-mode-state', true);
    }
});

// 监听退出沉浸模式
ipcMain.on('exit-immersive-mode', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.isImmersiveMode = false;
        if (win.normalBounds) {
            win.setBounds(win.normalBounds);
        } else {
            const { width, height } = screen.getPrimaryDisplay().workAreaSize;
            win.setBounds({
                x: width - 450,
                y: height - 650,
                width: 400,
                height: 600
            });
        }
        win.setAlwaysOnTop(true, 'screen-saver');
        win.webContents.send('immersive-mode-state', false);
    }
});

// 监听沉浸模式一键超高清截屏请求
ipcMain.handle('capture-immersive-screenshot', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, message: 'Window not found' };

    try {
        const image = await win.webContents.capturePage();
        clipboard.writeImage(image);

        const desktopPath = app.getPath('desktop');
        const now = new Date();
        const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const filename = `DeskPet_Immersive_${timestamp}.png`;
        const filePath = path.join(desktopPath, filename);

        fs.writeFileSync(filePath, image.toPNG());
        return { success: true, filePath: filePath, filename: filename };
    } catch (e) {
        console.error("截屏失败:", e);
        return { success: false, message: e.toString() };
    }
});

// 开机自启动管理
function applyAutoStartSetting(enable) {
    try {
        const exePath = app.isPackaged ? process.execPath : process.argv[0];
        const args = app.isPackaged ? [] : [path.join(__dirname, 'main.js')];
        app.setLoginItemSettings({
            openAtLogin: !!enable,
            openAsHidden: false,
            path: exePath,
            args: args
        });
        logDebug(`[AUTOSTART] setLoginItemSettings openAtLogin=${enable}, path=${exePath}`);
        return app.getLoginItemSettings().openAtLogin;
    } catch(e) {
        logDebug(`[AUTOSTART ERROR] ${e.message}`);
        return false;
    }
}

function syncInitialAutoStart() {
    try {
        let globalConfigPath;
        if (app.isPackaged) {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            globalConfigPath = path.join(appData, 'RumiaDesktopPet', 'global_config.json');
        } else {
            globalConfigPath = path.join(__dirname, 'services', 'global_config.json');
        }
        if (fs.existsSync(globalConfigPath)) {
            const cfg = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
            if (cfg.auto_start_on_boot !== undefined) {
                applyAutoStartSetting(!!cfg.auto_start_on_boot);
            }
        }
    } catch(e) {
        logDebug(`[AUTOSTART SYNC WARN] ${e.message}`);
    }
}

ipcMain.handle('set-autostart', (event, enable) => {
    return applyAutoStartSetting(enable);
});

ipcMain.handle('get-autostart', (event) => {
    try {
        return app.getLoginItemSettings().openAtLogin;
    } catch(e) {
        return false;
    }
});



// 监听由点击触发的恢复事件（点出来）
ipcMain.on('pet-click-restore', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.petIsHidden) {
        win.petIsHidden = false;
        win.setBounds({
            x: win.petRestoreX,
            y: win.petRestoreY,
            width: 400,
            height: 600
        });
        win.webContents.send('pet-restore');
    }
});

ipcMain.on('window-drag-end', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isImmersiveMode) return;
    
    const bounds = win.getBounds();
    const workArea = screen.getDisplayMatching(bounds).workArea;
    const snapDistance = -150; // 距离边缘多少像素触发吸附（负数表示需要把窗口拖出屏幕该像素值，实现“压入身子”再触发）
    const exposedPixels = 240; // 吸附后露出的宽度（确保莉莉与露米娅等桌宠在侧边探头时身体与表情清晰可见，不致潜入边缘过深）
    
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
            newX = workArea.x - 400 + exposedPixels; // 固定宽度 400
            side = 'left';
        } else {
            // 滑向右边
            newX = workArea.x + workArea.width - exposedPixels;
            side = 'right';
        }
        win.petRestoreX = (side === 'left') ? workArea.x : (workArea.x + workArea.width - 400);
        win.petRestoreY = bounds.y; // 保持原有高度
        hidden = true;
    } 
    // 正常的左右吸附
    else if (bounds.x <= workArea.x + snapDistance) {
        newX = workArea.x - 400 + exposedPixels;
        win.petRestoreX = workArea.x;
        win.petRestoreY = bounds.y;
        hidden = true;
        side = 'left';
    } else if (bounds.x + bounds.width >= workArea.x + workArea.width - snapDistance) {
        newX = workArea.x + workArea.width - exposedPixels;
        win.petRestoreX = workArea.x + workArea.width - 400;
        win.petRestoreY = bounds.y;
        hidden = true;
        side = 'right';
    }
    
    if (hidden) {
        win.petIsHidden = true;
        win.petMouseLeft = false; // 必须等鼠标先离开，才能触发悬浮弹回
        win.petHideSide = side; // 记录隐藏在哪一侧
        win.setBounds({
            x: newX,
            y: newY,
            width: 400,
            height: 600
        });
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

    function loadDashboardPage() {
        if (!settingsWin || settingsWin.isDestroyed()) return;
        const dashboardUrl = 'http://127.0.0.1:5000/dashboard?t=' + Date.now();
        settingsWin.loadURL(dashboardUrl).catch(err => {
            logDebug(`[SETTINGS] Dashboard load failed, retrying in 1.5s: ${err.message}`);
            setTimeout(() => {
                if (settingsWin && !settingsWin.isDestroyed()) {
                    loadDashboardPage();
                }
            }, 1500);
        });
    }
    loadDashboardPage();
    
    settingsWin.on('closed', () => {
        settingsWin = null;
    });
});


let splashWindow = null;

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 480,
        height: 290,
        center: true,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const splashFile = path.join(__dirname, 'services', 'templates', 'splash.html');
    splashWindow.loadFile(splashFile).catch(err => {
        logDebug(`[SPLASH] Load splash failed: ${err.message}`);
    });

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function createWindow(showImmediately = false) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (showImmediately) {
            mainWindow.show();
            mainWindow.focus();
        }
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        x: width - 450,
        y: height - 650,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        type: 'toolbar',
        resizable: false,
        show: showImmediately,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const win = mainWindow;
    createTray(win);
    
    // 强制把窗口层级提升到最高，避免被全屏游戏或应用遮挡
    win.setAlwaysOnTop(true, 'screen-saver');

    const petUrl = 'http://127.0.0.1:5000/pet?t=' + Date.now();
    let isTransitionDone = false;

    function finishStartupTransition() {
        if (isTransitionDone) return;
        isTransitionDone = true;

        if (splashWindow && !splashWindow.isDestroyed()) {
            try {
                splashWindow.webContents.send('splash-progress', {
                    percent: 100,
                    message: "准备就绪，欢迎回来！",
                    step: "ready"
                });
                splashWindow.webContents.send('splash-close');
            } catch(e) {}

            setTimeout(() => {
                if (splashWindow && !splashWindow.isDestroyed()) {
                    splashWindow.close();
                    splashWindow = null;
                }
                if (win && !win.isDestroyed()) {
                    win.show();
                    win.focus();
                    logDebug(`[ELECTRON] Splash transition finished, pet window shown`);
                }
            }, 450);
        } else {
            if (win && !win.isDestroyed()) {
                win.show();
                win.focus();
            }
        }
    }

    function loadPetPage() {
        win.webContents.session.clearCache().then(() => {
            win.loadURL(petUrl).then(() => {
                try {
                    win.webContents.setVisualZoomLevelLimits(1, 1);
                    win.webContents.setZoomFactor(1.0);
                } catch(e) {}
                logDebug(`[ELECTRON] Page loaded successfully`);
                setTimeout(finishStartupTransition, 300);
            }).catch(err => {
                logDebug(`[ELECTRON] Page load failed, retrying in 1.5s...`);
                setTimeout(loadPetPage, 1500);
            });
        });
    }
    loadPetPage();

    // 15 秒超时保底，防止极端异常卡在启动屏
    setTimeout(() => {
        if (!isTransitionDone) {
            finishStartupTransition();
        }
    }, 15000);

    const mouseTimer = setInterval(() => {
        if (win && !win.isDestroyed()) {
            const point = screen.getCursorScreenPoint();
            win.webContents.send('global-mouse-move', point);
        }
    }, 50);

    const gameCheckTimer = setInterval(() => {
        if (!win || win.isDestroyed()) return;

        http.get('http://127.0.0.1:5000/api/system/check_fullscreen_game', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'success') {
                        const isFullscreen = !!json.is_fullscreen;
                        const isEnabled = json.auto_minimize_enabled !== false;

                        if (isEnabled && isFullscreen) {
                            if (win.isVisible() && !autoHiddenByGame) {
                                autoHiddenByGame = true;
                                win.hide();
                                win.webContents.send('window-state-changed', 'minimized');
                                logDebug('[GAME MODE] 检测到前台全屏游戏运行，桌宠已自动隐身至系统托盘');
                            }
                        } else if (autoHiddenByGame) {
                            autoHiddenByGame = false;
                            win.show();
                            win.webContents.send('window-state-changed', 'restored');
                            logDebug('[GAME MODE] 全屏游戏已退出/切出，桌宠恢复展示');
                        }
                    }
                } catch(e) {}
            });
        }).on('error', () => {});
    }, 1500);

    win.on('closed', () => {
        clearInterval(mouseTimer);
        clearInterval(gameCheckTimer);
        mainWindow = null;
    });

    if (!app.isPackaged) {
        win.webContents.openDevTools({ mode: 'detach' });
    }
}

let backendProcess = null;

function startBackendService() {
    if (app.isPackaged) {
        const { execSync, spawn } = require('child_process');
        try {
            execSync('powershell -Command "Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' });
        } catch(e) {}
        
        const baseDir = process.resourcesPath;
        const rootDir = path.dirname(baseDir);
        const exePaths = [
            path.join(rootDir, 'dist', 'backend', 'web_interface.exe'),
            path.join(rootDir, 'backend', 'web_interface.exe'),
            path.join(baseDir, 'dist', 'backend', 'web_interface.exe'),
            path.join(baseDir, 'backend', 'web_interface.exe')
        ];
        
        let foundBackendExe = null;
        for (const p of exePaths) {
            if (fs.existsSync(p)) {
                foundBackendExe = p;
                break;
            }
        }
        
        if (foundBackendExe) {
            logDebug(`[PACKAGED] Spawning precompiled backend EXE: ${foundBackendExe}`);
            backendProcess = spawn(foundBackendExe, [], {
                cwd: path.dirname(foundBackendExe),
                detached: true,
                stdio: 'ignore'
            });
            backendProcess.unref();
        } else {
            logDebug(`[PACKAGED ERROR] Backend EXE not found in paths: ${JSON.stringify(exePaths)}`);
        }
    } else {
        if (process.env.RUMIA_BACKEND_SPAWNED === "1") {
            // 后端已由 run.py 并行拉起，无需重复拉起
            return;
        }
        const { spawn } = require('child_process');
        const req = http.get('http://127.0.0.1:5000/api/characters/list', (res) => {
            // Already running
        });
        req.on('error', () => {
            console.log('[DEV AUTO-START] Python 后端服务未运行，正在自动拉起 services/web_interface.py...');
            backendProcess = spawn('python', ['services/web_interface.py'], {
                cwd: __dirname,
                stdio: 'inherit'
            });
        });
        req.setTimeout(600, () => req.destroy());
    }
}

function updateSplashLoading(count) {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    const p = Math.min(80, 20 + count * 4.5);
    let msg = "正在唤醒神经中枢 (FastAPI)...";
    let step = "core";
    if (p > 45) {
        msg = "正在载入向量记忆库 (Qdrant & Mem0)...";
        step = "memory";
    }
    try {
        splashWindow.webContents.send('splash-progress', {
            percent: p,
            message: msg,
            step: step
        });
    } catch(e) {}
}

app.whenReady().then(() => {
    // 1. 毫秒级展示启动加载界面 (Splash Screen)
    createSplashWindow();

    // 2. 拉起后端服务
    startBackendService();

    // 3. 轮询健康检测与进度流转
    let pollCount = 0;
    let backendReady = false;

    const pollInterval = setInterval(() => {
        pollCount++;
        http.get('http://127.0.0.1:5000/api/characters/list', (res) => {
            if (res.statusCode === 200 && !backendReady) {
                backendReady = true;
                clearInterval(pollInterval);

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let activeChar = null;
                    try {
                        const json = JSON.parse(data);
                        if (json.characters && json.characters.length > 0) {
                            const activeId = json.active_character || json.characters[0].character_id;
                            activeChar = json.characters.find(c => c.character_id === activeId);
                        }
                    } catch(e) {}

                    if (splashWindow && !splashWindow.isDestroyed()) {
                        splashWindow.webContents.send('splash-progress', {
                            percent: 88,
                            message: "正在初始化 Live2D 渲染视界...",
                            step: "render",
                            character: activeChar ? { name: activeChar.character_name, avatar: activeChar.avatar_url } : null
                        });
                    }

                    // 后端就绪，创建并预载桌宠窗口
                    createWindow(false);
                });
            } else if (!backendReady) {
                updateSplashLoading(pollCount);
            }
        }).on('error', () => {
            if (!backendReady) updateSplashLoading(pollCount);
        });

        // 超过 20 秒超时兜底
        if (pollCount > 40 && !backendReady) {
            clearInterval(pollInterval);
            createWindow(true);
        }
    }, 450);

    syncInitialAutoStart();
});

app.on('will-quit', () => {
    if (backendProcess) {
        try { backendProcess.kill(); } catch(e) {}
    }
    if (app.isPackaged) {
        const { execSync } = require('child_process');
        try {
            execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :5000\') do taskkill /f /t /pid %a', { shell: 'cmd.exe', stdio: 'ignore' });
        } catch(e) {}
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
