const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// 閻╂垵鎯夊〒鍙夌厠鏉╂稓鈻奸崣鎴︹偓浣烘畱缁屽潡鈧繋绨ㄦ禒璁圭礉閸斻劍鈧礁鍨忛幑銏ょ炊閺嶅洤鎷烽悾銉уЦ閹?
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setIgnoreMouseEvents(ignore, options);
    }
});

// 閻╂垵鎯夊〒鍙夌厠鏉╂稓鈻奸崣鎴︹偓浣烘畱閹锋牗瀚挎禍瀣╂閿涘苯濮╅幀浣盒╅崝銊х崶閸欙絼缍呯純?
ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
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
    const petUrl = 'http://127.0.0.1:5000/pet';
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
