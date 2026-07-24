
// --- GLOBAL ALERT OVERRIDE TO PREVENT ELECTRON FOCUS BUG ---
window.alert = function(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = 'rgba(0,0,0,0.85)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '9999999';
    toast.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease';
    toast.style.transform = 'translateY(10px)';
    toast.style.opacity = '0';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontFamily = 'sans-serif';
    toast.style.fontSize = '14px';
    document.body.appendChild(toast);
    
    // trigger reflow
    void toast.offsetWidth;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};


// --- Global Async Confirm Override ---
window.asyncConfirm = function(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.zIndex = '99999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.backdropFilter = 'blur(4px)';

        const box = document.createElement('div');
        box.style.backgroundColor = 'var(--bg-secondary, #2a2a35)';
        box.style.padding = '30px';
        box.style.borderRadius = '12px';
        box.style.minWidth = '300px';
        box.style.maxWidth = '400px';
        box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        box.style.border = '1px solid rgba(255,255,255,0.1)';
        box.style.textAlign = 'center';
        box.style.fontFamily = 'system-ui, sans-serif';

        const msgEl = document.createElement('p');
        msgEl.style.color = '#fff';
        msgEl.style.fontSize = '16px';
        msgEl.style.marginBottom = '25px';
        msgEl.style.lineHeight = '1.5';
        msgEl.style.whiteSpace = 'pre-wrap';
        msgEl.textContent = message;

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.gap = '15px';

        const btnNo = document.createElement('button');
        btnNo.textContent = '取消';
        btnNo.className = 'action-btn';
        btnNo.style.padding = '8px 20px';

        const btnYes = document.createElement('button');
        btnYes.textContent = '确认';
        btnYes.className = 'action-btn danger';
        btnYes.style.padding = '8px 20px';

        btnYes.onclick = () => { overlay.remove(); resolve(true); };
        btnNo.onclick = () => { overlay.remove(); resolve(false); };

        btnContainer.appendChild(btnNo);
        btnContainer.appendChild(btnYes);
        box.appendChild(msgEl);
        box.appendChild(btnContainer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
};
// -----------------------------------------------------------

class DesktopPet {
    constructor() {
        this.input = document.getElementById('pet-input');
        this.bubble = document.getElementById('speech-bubble');
        this.bubbleContent = document.getElementById('bubble-content');
        this.img = document.getElementById('pet-img');
        this.favScore = document.getElementById('fav-score');
        this.favContainer = document.getElementById('fav-container');

        this.images = {};
        this.currentEmotion = 'normal';
        this.reactionLines = null;
        this.isPeeking = false; // [状态追踪] 边缘探头锁定
        
        
        this.currentChatLog = "";
        this.currentDiary = "";
        this.activeLogTab = "chat";
        this.isSleeping = false;
        this.isMinimized = false;
        this.sleepTimer = null;
        this.autoSpeakCount = 0;

        this.playerBar = document.getElementById('music-player-bar');
        this.inputBar = document.querySelector('.input-bar');
        this.musicTitle = document.getElementById('music-title');
        this.musicArtist = document.getElementById('music-artist');
        this.liveLyrics = document.getElementById('live-lyrics');
        this.musicToggleBtn = document.getElementById('music-toggle-btn');
        this.musicStopBtn = document.getElementById('music-stop-btn');

        this.musicAudio = new Audio();
        this.lyricsArray = [];
        this.musicIsPlaying = false;

        this.loadCharacterInfo().then(() => {
            this.preloadImages();
            this.init();
        });
    }


    async loadCharacterInfo() {
        try {
            const response = await fetch('/api/character_info');
            const data = await response.json();
            this.characterId = data.character_id;
            const prefix = data.image_path;
            
            if (data.theme_color) {
                this.applyPetThemeColor(data.theme_color);
            }

            this.charName = data.character_name || "她";
            document.body.className = `theme-${data.character_id}`;
            document.getElementById("pet-input").placeholder = `和${this.charName}说话...`; // e.g. /static/images/rumia/
            this.images = {
                'normal': [prefix + 'normal.png', prefix + 'normal_1.png', prefix + 'normal_2.png'],
                'angry': [prefix + 'angry.png', prefix + 'angry_1.png', prefix + 'angry_2.png'],
                'shy': [prefix + 'shy.png', prefix + 'shy_1.png', prefix + 'shy_2.png'],
                'crying': [prefix + 'crying.png', prefix + 'crying_1.png', prefix + 'crying_2.png'],
                'sleeping': [prefix + 'sleeping.png', prefix + 'sleeping_1.png', prefix + 'sleeping_2.png']
            };
            this.img.src = prefix + 'normal.png';
            this.enableGreeting = data.enable_greeting !== false;
            this.enableAutoSpeak = data.enable_auto_speak !== false;
            this.autoSpeakMultiplier = data.auto_speak_multiplier || 1.0;
            this.bubbleDurationMultiplier = data.bubble_duration_multiplier || 1.0;
            
            // set select value
            const charSelect = document.getElementById('character-select');
            if (charSelect) {
                charSelect.value = data.character_id;
                charSelect.addEventListener('change', async (e) => {
                    const confirmSwitch = await window.asyncConfirm(`确定要切换灵魂为 ${e.target.options[e.target.selectedIndex].text} 吗？\n这将导致程序退出，您需要手动重新打开！`);
                    if (confirmSwitch) {
                        await fetch('/api/switch_character', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ character_id: e.target.value })
                        });
                        if (typeof require !== 'undefined') {
                            const { ipcRenderer } = require('electron');
                            ipcRenderer.send('exit-app');
                        } else {
                            window.close();
                        }
                    } else {
                        e.target.value = data.character_id; // revert
                    }
                });
            }
            
            // Load reaction lines
            try {
                const reactionRes = await fetch('/api/pet_reactions');
                const reactionData = await reactionRes.json();
                if (reactionData.success) {
                    this.reactionLines = reactionData.reactions;
                }
            } catch(e) {
                console.error("Failed to load reaction lines", e);
            }
        } catch (e) {
            console.error("Failed to load character info", e);
        }
    }

    applyPetThemeColor(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return;
        
        let r = parseInt(hex.substring(1, 3), 16);
        let g = parseInt(hex.substring(3, 5), 16);
        let b = parseInt(hex.substring(5, 7), 16);
        
        let hr = Math.max(0, r - 32);
        let hg = Math.max(0, g - 32);
        let hb = Math.max(0, b - 32);
        
        document.documentElement.style.setProperty('--theme-main', hex);
        document.documentElement.style.setProperty('--theme-hover', `rgb(${hr}, ${hg}, ${hb})`);
        document.documentElement.style.setProperty('--theme-glow-02', `rgba(${r}, ${g}, ${b}, 0.2)`);
        document.documentElement.style.setProperty('--theme-glow-03', `rgba(${r}, ${g}, ${b}, 0.3)`);
        document.documentElement.style.setProperty('--theme-glow-04', `rgba(${r}, ${g}, ${b}, 0.4)`);
        document.documentElement.style.setProperty('--theme-glow-05', `rgba(${r}, ${g}, ${b}, 0.5)`);
        document.documentElement.style.setProperty('--theme-glow-09', `rgba(${r}, ${g}, ${b}, 0.9)`);
        document.documentElement.style.setProperty('--theme-bg-015', `rgba(${r}, ${g}, ${b}, 0.15)`);
        document.documentElement.style.setProperty('--theme-bg-035', `rgba(${r}, ${g}, ${b}, 0.35)`);
        document.documentElement.style.setProperty('--theme-text-light', hex);
        document.documentElement.style.setProperty('--theme-text-bright', hex);
        document.documentElement.style.setProperty('--theme-legend-pink', hex);
    }

    preloadImages() {
        Object.values(this.images).forEach(item => {
            if (Array.isArray(item)) {
                item.forEach(src => {
                    const img = new Image();
                    img.src = src;
                });
            } else {
                const img = new Image();
                img.src = item;
            }
        });
    }

    init() {
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        this.initSettings();
        this.initPresets();

        this.resetAutoSpeakTimer();

        // [鏂板] 缃戞槗浜戝濯掍綋鎾斁浜嬩欢缁戝畾
        if (this.musicToggleBtn) {
            this.musicToggleBtn.addEventListener('click', () => this.toggleMusic());
        }
        if (this.musicStopBtn) {
            this.musicStopBtn.addEventListener('click', () => this.stopMusic());
        }
        this.musicAudio.addEventListener('timeupdate', () => this.updateLyrics());
        this.musicAudio.addEventListener('ended', () => this.stopMusic());
        this.musicAudio.addEventListener('error', () => {
            const err = this.musicAudio.error;
            let errMsg = "未知播放错误";
            if (err) {
                errMsg = `Code ${err.code}: ${err.message || "Src Not Supported / Network Issue"}`;
            }
            console.error("音乐播放错误:", errMsg);
            this.liveLyrics.innerText = `播放出错: ${errMsg}`;
            this.musicIsPlaying = false;
            this.musicToggleBtn.innerHTML = '<i class="fas fa-play"></i>';
        });

        // 鐐瑰嚮韬綋浜掑姩 (鐜板湪淇敼涓猴細鐐瑰嚮涓嶅敜閱掞紝鍙兘閫氳繃鑱婂ぉ鍞ら啋)
        this.img.addEventListener('click', () => {
            // if (this.isSleeping) {
            //     this.wakeUp(false);
            // }
        });

        this.loadStatus();

        // [IPC] 动态穿透切换与JS拖拽窗口 — 优先使用 preload.js 注入的 IPC 桥，降级时回退至 window.require('electron')
        const petIPC = window.__petIPC || (() => {
            try {
                const { ipcRenderer } = window.require('electron');
                return {
                    sendSetIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
                    sendWindowDrag: (deltaX, deltaY) => ipcRenderer.send('window-drag', { deltaX, deltaY })
                };
            } catch (e) {
                return null;
            }
        })();
        if (petIPC) {
            // 监听窗口最小化/恢复状态，控制自言自语的暂停与启动
            if (typeof petIPC.onWindowStateChanged === 'function') {
                petIPC.onWindowStateChanged((state) => {
                    if (state === 'minimized') {
                        this.isMinimized = true;
                        if (this.autoSpeakTimer) {
                            clearTimeout(this.autoSpeakTimer);
                            this.autoSpeakTimer = null;
                        }
                        console.log("[WINDOW] Minimized to tray. Active speaking paused.");
                    } else if (state === 'restored') {
                        this.isMinimized = false;
                        this.resetAutoSpeakTimer();
                        console.log("[WINDOW] Restored from tray. Active speaking resumed.");
                    }
                });
            }

            let isDragging = false;
            let startX = 0, startY = 0;
            let mousedownX = 0, mousedownY = 0;
            let isIgnoring = false; // [状态追踪] 避免重复且无意义的高频 IPC 通信导致界面卡死

            // mousedown handler
            this.img.addEventListener('mousedown', (e) => {
                // if (this.isSleeping) {
                //     this.wakeUp(false);
                // }
                if (e.button === 0) { 
                    isDragging = true;
                    startX = e.screenX;
                    startY = e.screenY;
                    mousedownX = e.screenX;
                    mousedownY = e.screenY;
                    petIPC.sendSetIgnoreMouseEvents(false);
                    isIgnoring = false; // 同步状态
                    this.img.style.cursor = 'grabbing';
                }
            });

            this.img.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });

            // mousemove handler (仅用于拖动，因为 hover 判定已移至 global_mouse_move)
            window.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.screenX - startX;
                    const deltaY = e.screenY - startY;
                    startX = e.screenX;
                    startY = e.screenY;
                    petIPC.sendWindowDrag(deltaX, deltaY);
                }
            });

            // 监听系统全局鼠标坐标，用于无死角地进行 hover 和点击穿透判定
            if (typeof petIPC.onGlobalMouseMove === 'function') {
                petIPC.onGlobalMouseMove((point) => {
                    if (isDragging) return;

                    let isInteractive = false;

                    const checkHover = (element) => {
                        if (!element) return false;
                        const rect = element.getBoundingClientRect();
                        const mouseX = point.x - window.screenX;
                        const mouseY = point.y - window.screenY;
                        return (
                            mouseX >= rect.left &&
                            mouseX <= rect.right &&
                            mouseY >= rect.top &&
                            mouseY <= rect.bottom
                        );
                    };

                    try {
                        if (checkHover(this.img)) {
                            isInteractive = true;
                        } else if (checkHover(this.inputBar)) {
                            isInteractive = true;
                        } else if (this.favContainer && checkHover(this.favContainer)) {
                            isInteractive = true;
                        } else if (this.bubble && this.bubble.style.opacity === '1' && checkHover(this.bubble)) {
                            isInteractive = true;
                        } else if (this.settingsModal && !this.settingsModal.classList.contains('hidden') && checkHover(this.settingsModal)) {
                            isInteractive = true;
                        } else if (this.playerBar && !this.playerBar.classList.contains('hidden') && checkHover(this.playerBar)) {
                            isInteractive = true;
                        } else if (this.presetsPopup && !this.presetsPopup.classList.contains('hidden') && checkHover(this.presetsPopup)) {
                            isInteractive = true;
                        }
                    } catch (err) {
                        console.error('[MOUSE_EVENTS] Error in global hover check:', err);
                    }

                    if (isInteractive) {
                        if (isIgnoring) {
                            petIPC.sendSetIgnoreMouseEvents(false);
                            isIgnoring = false;
                        }
                    } else {
                        if (!isIgnoring) {
                            petIPC.sendSetIgnoreMouseEvents(true, { forward: true });
                            isIgnoring = true;
                        }
                    }

                    // 更新可视化调试面板显示
                    const dbMouse = document.getElementById('debug-mouse-val');
                    const dbRect = document.getElementById('debug-rect-val');
                    const dbInteractive = document.getElementById('debug-interactive-val');
                    const dbIgnoring = document.getElementById('debug-ignoring-val');

                    const rect = this.img ? this.img.getBoundingClientRect() : {};
                    const mouseX = point.x - window.screenX;
                    const mouseY = point.y - window.screenY;

                    if (dbMouse) dbMouse.innerText = `X:${Math.round(mouseX)}, Y:${Math.round(mouseY)} (Global: ${point.x}, ${point.y})`;
                    if (dbRect) dbRect.innerText = `L:${Math.round(rect.left)}, R:${Math.round(rect.right)}, T:${Math.round(rect.top)}, B:${Math.round(rect.bottom)}`;
                    if (dbInteractive) dbInteractive.innerText = isInteractive ? "TRUE" : "FALSE";
                    if (dbIgnoring) dbIgnoring.innerText = isIgnoring ? "TRUE" : "FALSE";

                });
            }

            // 全局监听 mouseup 停止拖动
            window.addEventListener('mouseup', (e) => {
                if (isDragging) {
                    isDragging = false;
                    this.img.style.cursor = 'grab';
                    
                    if (typeof petIPC.sendWindowDragEnd === 'function') {
                        petIPC.sendWindowDragEnd();
                    }
                    
                    let moveDist = Math.abs(e.screenX - mousedownX) + Math.abs(e.screenY - mousedownY);
                    if (moveDist < 5) { 
                        this.handlePetClick();
                    }
                }
            });
            
            // 监听探头事件 (V2 边缘吸附)
            if (typeof petIPC !== 'undefined') {
                if (petIPC.onPetHideEdge) {
                    petIPC.onPetHideEdge((side) => {
                        this.isPeeking = true;
                        const peekKey = side === 'left' ? 'peeking_left' : 'peeking_right';
                        this.img.src = `/static/images/${this.characterId}/${peekKey}.png`;
                        
                        document.body.classList.add('peeking-mode');
                        const petContainer = document.querySelector('.pet-container');
                        if (petContainer) {
                            petContainer.style.alignItems = side === 'left' ? 'flex-end' : 'flex-start';
                            // 往屏幕内偏移，让她更露出来一点（原本弄反了，导致藏得更深）
                            this.img.style.transform = side === 'left' ? 'translateX(50px)' : 'translateX(-50px)';
                        }
                    });
                }
                if (petIPC.onPetRestore) {
                    petIPC.onPetRestore(() => {
                        if (this.isPeeking) {
                            this.isPeeking = false;
                            
                            document.body.classList.remove('peeking-mode');
                            const petContainer = document.querySelector('.pet-container');
                            if (petContainer) {
                                petContainer.style.alignItems = '';
                            }
                            this.img.style.transform = ''; // 恢复偏移

                            // 强制解除锁定并恢复
                            const list = this.images[this.currentEmotion] || this.images['normal'];
                            if (list && list.length > 0) {
                                this.img.src = list[Math.floor(Math.random() * list.length)];
                            }
                        }
                    });
                }
            }
        }

        if (this.enableGreeting) {
            setTimeout(() => this.greetUser(), 500);
        }
    }

    initSettings() {
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.exitGameBtn = document.getElementById('exit-game-btn');
        this.minimizeBtn = document.getElementById('minimize-btn');

        // Dashboard 澶х獥浣撻€昏緫
        this.openDashboardBtn = document.getElementById('open-dashboard-btn');
        if (this.openDashboardBtn) {
            this.openDashboardBtn.addEventListener('click', () => {
                if (window.__petIPC && typeof window.__petIPC.openSettingsWindow === 'function') {
                    window.__petIPC.openSettingsWindow();
                }
                this.closeSettingsModal();
            });
        }

        // 鎵撳紑鑿滃崟
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                this.settingsModal.classList.remove('hidden');
            });
        }

        // 鍏抽棴鑿滃崟
        if (this.closeSettingsBtn) {
            this.closeSettingsBtn.addEventListener('click', () => {
                this.closeSettingsModal();
            });
        }

        // 閫€鍑烘父鎴?
        if (this.exitGameBtn) {
            this.exitGameBtn.addEventListener('click', () => this.exitGame());
        }

        // 最小化至托盘
        if (this.minimizeBtn) {
            this.minimizeBtn.addEventListener('click', () => {
                this.settingsModal.classList.add('hidden');
                if (window.__petIPC && typeof window.__petIPC.sendMinimizeToTray === 'function') {
                    window.__petIPC.sendMinimizeToTray();
                }
            });
        }
    }

    closeSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.classList.add('hidden');
        }
    }

    // [鏂板] 鍔犺浇鎵€鏈夊彲鐢ㄧ殑鏃ュ織鏃ユ湡鍒楄〃
    async loadLogsList() {
        this.logDateSelect.innerHTML = '<option value="">加载中...</option>';
        try {
            const response = await fetch('/api/settings/logs');
            const data = await response.json();
            if (data.success && data.dates && data.dates.length > 0) {
                let html = '<option value="">-- 请选择日期 --</option>';
                data.dates.forEach(date => {
                    html += `<option value="${date}">${date}</option>`;
                });
                this.logDateSelect.innerHTML = html;
            } else {
                this.logDateSelect.innerHTML = '<option value="">暂无聊天记录</option>';
                this.logContentArea.innerText = `还没有任何每日回忆记录哦，快去和${this.charName}多聊聊天吧！`;
            }
        } catch (e) {
            console.error("加载日志列表失败:", e);
            this.logDateSelect.innerHTML = '<option value="">加载失败</option>';
        }
    }

    // [鏂板] 鍔犺浇骞舵覆鏌撶壒瀹氭棩鏈熺殑鏃ュ織鍐呭
    async loadLogContent() {
        const val = this.logDateSelect.value;
        if (!val) {
            this.logContentArea.innerText = `请选择一个日期来查阅你和${this.charName}的聊天回忆...`;
            if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            return;
        }

        this.logContentArea.innerText = '正在读取回忆中...';
        try {
            const response = await fetch(`/api/settings/logs/${val}`);
            const data = await response.json();
            if (data.success) {
                this.currentChatLog = data.chat_content || "";
                this.currentDiary = data.diary_content || "";
                // 姣忔鍒囨崲鏂版棩鏈熸椂锛岄粯璁ゆ樉绀鸿亰澶╄褰曞瓙閫夐」鍗?
                this.switchLogTab('chat');
                if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'inline-block';
            } else {
                this.logContentArea.innerText = `读取回忆失败: ${data.error || '未知错误'}`;
                this.currentChatLog = "";
                this.currentDiary = "";
                if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            }
        } catch (e) {
            console.error("加载日志内容失败:", e);
            this.logContentArea.innerText = '加载回忆失败，请稍后重试。';
            this.currentChatLog = "";
            if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            this.currentDiary = "";
        }
    }

    // [鏂板] 閲嶆柊鎵撳寘瀵硅瘽骞惰闇茬背濞呴噸鍐欎粖鏃ユ棩璁?
    async rewriteDiary() {
        const val = this.logDateSelect.value;
        if (!val) return;

        if (!await window.asyncConfirm(`确定要让当前角色重新读一遍 ${val} 的对话并重写这天的日记吗？\n(这会消耗API token并需要几秒钟)`)) return;

        this.rewriteDiaryBtn.disabled = true;
        const originalText = this.rewriteDiaryBtn.innerHTML;
        this.rewriteDiaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在重写...';
        
        // 临时将日记内容替换为加载提示并切换到日记选项卡
        this.currentDiary = "正在埋头回忆这天的相处，努力重写日记中，这需要几秒钟时间，请稍候...哼！";
        this.switchLogTab('diary');

        try {
            const response = await fetch(`/api/settings/logs/${val}/rewrite`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                this.currentDiary = data.diary_content || "";
                this.switchLogTab('diary');
                this.showBubble("这天的日记我已经重新写好啦！哼，这次写的可真了，快看看！", 3500);
            } else {
                alert(`重写日记失败: ${data.error || '未知错误'}`);
                this.currentDiary = "重写日记失败了...呜呜。";
                this.switchLogTab('diary');
            }
        } catch (e) {
            console.error("重写日记请求出错:", e);
            alert("请求失败，请检查网络或后端是否正常。");
        } finally {
            this.rewriteDiaryBtn.disabled = false;
            this.rewriteDiaryBtn.innerHTML = originalText;
        }
    }

    // [鏂板] 鍒囨崲鏃ュ織瀛愰€夐」鍗?(鑱婂ぉ瀵硅瘽 / 闇茬背濞呮棩璁?
    switchLogTab(tab) {
        if (!this.logDateSelect.value) {
            return;
        }
        this.activeLogTab = tab;
        
        // 鍒囨崲婵€娲荤姸鎬佹牱寮?
        if (this.subtabChat && this.subtabDiary) {
            if (tab === 'chat') {
                this.subtabChat.classList.add('active');
                this.subtabDiary.classList.remove('active');
                
                if (!this.currentChatLog) {
                    this.logContentArea.innerText = "今天没有聊天对话记录哦。";
                } else {
                    this.logContentArea.innerHTML = '';
                    this.logContentArea.appendChild(this.renderWechatStyleLog(this.currentChatLog));
                }
                
                // 滚动到底部，方便查看当天的最新聊天
                setTimeout(() => {
                    const wrapper = this.logContentArea.parentElement;
                    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
                }, 50);
            } else {
                this.subtabChat.classList.remove('active');
                this.subtabDiary.classList.add('active');
                this.logContentArea.innerText = this.currentDiary || "今天没有写日记哦……呜，肯定是怪你没有好好理她！";
                
                // 日记从头阅读，重置滚动位置为0
                setTimeout(() => {
                    const wrapper = this.logContentArea.parentElement;
                    if (wrapper) wrapper.scrollTop = 0;
                }, 50);
            }
        }
    }

    renderWechatStyleLog(logText) {
        const container = document.createElement('div');
        container.className = 'wechat-chat-container';
        
        const lines = logText.split('\n');
        let lastTime = '';
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            const match = line.match(/^\[(.*?)\]\s+(.*?):\s+(.*)$/);
            if (match) {
                const time = match[1];
                let sender = match[2];
                const content = match[3];
                
                const timeStr = time.substring(0, 5); // HH:MM
                if (timeStr !== lastTime) {
                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'wechat-timestamp';
                    timeDiv.textContent = timeStr;
                    container.appendChild(timeDiv);
                    lastTime = timeStr;
                }
                
                const isUser = sender.toLowerCase() === 'you' || sender.toLowerCase().includes('you ');
                
                const row = document.createElement('div');
                row.className = 'wechat-msg-row ' + (isUser ? 'is-user' : 'is-bot');
                
                const avatar = document.createElement('div');
                avatar.className = 'wechat-avatar';
                if (isUser) {
                    avatar.innerHTML = '<i class="fas fa-user" style="color:#fff; font-size:20px; line-height:36px; text-align:center; width:100%;"></i>';
                    avatar.style.background = '#009688';
                } else {
                    avatar.style.backgroundImage = `url('${this.images['normal'] || ''}')`;
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.backgroundPosition = 'top center';
                }
                
                const msgContent = document.createElement('div');
                msgContent.className = 'wechat-msg-content';
                
                const nameDiv = document.createElement('div');
                nameDiv.className = 'wechat-sender-name';
                nameDiv.textContent = isUser ? '你' : sender.replace(/\(.*?\)/g, '').trim();
                
                const bubble = document.createElement('div');
                bubble.className = 'wechat-bubble';
                bubble.textContent = content;
                
                msgContent.appendChild(nameDiv);
                msgContent.appendChild(bubble);
                
                row.appendChild(avatar);
                row.appendChild(msgContent);
                
                container.appendChild(row);
            } else {
                const sysMsg = document.createElement('div');
                sysMsg.className = 'wechat-timestamp';
                sysMsg.textContent = line;
                container.appendChild(sysMsg);
            }
        }
        return container;
    }

    async exitGame() {
        if (!await window.asyncConfirm(`要让${this.charName}去睡觉吗？`)) return;

        this.showBubble("那...晚安啦...", 2000);
        this.setEmotion('normal'); 
        this.settingsModal.classList.add('hidden');

        try {
            fetch('/api/settings/exit', {
                method: 'POST'
            }).catch(() => {});

            setTimeout(() => {
                if (window.__petIPC && typeof window.__petIPC.sendExitApp === 'function') {
                    window.__petIPC.sendExitApp();
                } else {
                    window.close();
                }
            }, 1000);
        } catch (e) {
            console.error("退出失败:", e);
            if (window.__petIPC && typeof window.__petIPC.sendExitApp === 'function') {
                window.__petIPC.sendExitApp();
            } else {
                window.close();
            }
        }
    }
    // [修改] 切换表情的核心函数（在同种差分中随机选择一个）
    setEmotion(emotion) {
        this.currentEmotion = emotion;
        if (this.isPeeking) return; // 如果正在边缘暗中观察，锁定换图逻辑
        
        const list = this.images[emotion] || this.images['normal'];
        const targetSrc = list[Math.floor(Math.random() * list.length)];

        // 如果当前已经是这张图，就不操作了，避免闪烁
        if (this.img.src.includes(targetSrc)) return;

        console.log(`切换心情: ${emotion} -> 随机差分: ${targetSrc}`);

        // 绠€鍗曠殑娣″叆娣″嚭鏁堟灉
        this.img.style.opacity = '0.7';
        setTimeout(() => {
            this.img.src = targetSrc;
            this.img.style.opacity = '1';
        }, 150);
    }

// [淇敼] 鏄剧ず姘旀场 (duration 濡傛灉涓嶄紶鎴栦紶 null锛屽垯鑷姩璁＄畻)
    showBubble(text, duration = null) {
        // [鏂板] 缃戞槗浜戠偣姝岄殣钘忔寚浠よВ鏋愭嫤鎴?
        const musicRegex = /\[MUSIC_PLAY:\s*(.*?)\s*\]/;
        const match = text.match(musicRegex);
        if (match) {
            const musicQuery = match[1];
            text = text.replace(musicRegex, "").trim();
            console.log(`[MUSIC CONTROLLER] 拦截到大模型点歌指令: ${musicQuery}`);
            this.searchAndPlayMusic(musicQuery);
        }

        // 转义并解析动作括号
        const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const htmlText = escapedText.replace(/(\(.*?\)|（.*?）)/g, '<span class="action-text">$1</span>');
        this.bubbleContent.innerHTML = htmlText;
        this.bubbleContent.scrollTop = 0; // 閲嶇疆鏂囧瓧妗嗘粴鍔ㄦ潯浣嶇疆鍒伴《閮紝闃叉涓婁竴鏉¤秴闀挎枃鏈畫鐣欐粴鍔ㄦ潯
        this.bubble.style.opacity = '1';
        this.bubble.style.pointerEvents = 'auto'; // 璇磋瘽鏃跺惎鐢ㄩ紶鏍囦氦浜掞紙鍏佽婊氬姩銆侀€夋嫨鏂囨湰锛?

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);

        // [新增] 智能时长计算逻辑
        let showTime = duration;
        if (!showTime) {
            // 基础时间 3秒 + 每个字 0.3秒
            const calcTime = 3000 + (text.length * 300);
            
            // 应用用户设定的倍率
            const multiplier = this.bubbleDurationMultiplier || 1.0;
            const finalTime = calcTime * multiplier;
            
            // 限制最长不超过 30秒 (防止显示太久挡路) (如果倍率很高，上限也相应拉高一点点)
            const maxLimit = 30000 * Math.max(1.0, multiplier * 0.5); 
            showTime = Math.min(finalTime, maxLimit);
        }

        console.log(`气泡显示时长: ${showTime/1000}秒 (字数: ${text.length})`);

        if (showTime > 0) {
            this.bubbleTimer = setTimeout(() => {
                this.bubble.style.opacity = '0';
                this.bubble.style.pointerEvents = 'none'; // 隐藏时完全穿透鼠标，防止挡住后面的东西
            }, showTime);
        }
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';
        this.autoSpeakCount = 0;
        this.wakeUp(true); // 闈欓粯鍞ら啋 (鎺ヤ笅鏉ョ殑澶фā鍨嬪洖澶嶄細灞曠ず琛ㄦ儏涓庢皵娉?
        this.resetAutoSpeakTimer();

        this.showBubble("hmm...", -1); // 传入 -1 让气泡持续显示直到新消息覆盖

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            if (data.success) {
                // 1. 鍏堟樉绀哄璇?(杩欐槸鏈€閲嶈鐨勶紝缁濆涓嶈兘琚鐩?
                this.showBubble(data.reply);
                this.setEmotion(data.emotion);

                // [鏂板] 濡傛灉鍚庣杩斿洖浜?ReAct 鐐规瓕鏁版嵁锛岀洿鎺ヨ皟鐢ㄦ挱鏀惧櫒鎾斁锛岃烦杩囬噸澶嶆悳绱?
                if (data.music_play) {
                    console.log(`[MUSIC PLAYER] 接收到 ReAct 点歌数据:`, data.music_play);
                    this.playMusicDirectly(data.music_play);
                }

                // 2. 澶勭悊濂芥劅搴?(涓嶈鍐嶈皟鐢?showBubble 浜嗭紒)
                if (data.favorability !== undefined) {
                    // 鍏堟洿鏂版樉绀虹殑鏁板€?
                    this.favScore.innerText = data.favorability;

                    // 瑙嗚鍙嶉锛氬湪宸︿笂瑙掓暟瀛楁梺杈规樉绀?(+1) 鎴?(-1)
                    if (data.fav_change > 0) {
                        // 鍙樻垚绫讳技 "61 (+1)" 鐨勬牱瀛愶紝鐢ㄧ孩鑹查珮浜?
                        this.favScore.innerHTML = `${data.favorability} <span style="color: #ff3366; font-size: 14px; margin-left:5px;">(+1)</span>`;
                        // 2绉掑悗鎭㈠姝ｅ父
                        setTimeout(() => this.favScore.innerText = data.favorability, 2000);

                    } else if (data.fav_change < 0) {
                        // 鍙樻垚绫讳技 "60 (-1)" 鐨勬牱瀛愶紝鐢ㄧ伆鑹叉垨钃濊壊
                        this.favScore.innerHTML = `${data.favorability} <span style="color: #888; font-size: 14px; margin-left:5px;">(-1)</span>`;
                        setTimeout(() => this.favScore.innerText = data.favorability, 2000);
                    }
                }
            }
        } catch (e) {
            console.error("[CHAT ERROR] 聊天请求失败:", e);
            this.showBubble("听不到... (网络错误)");
            this.setEmotion('crying');
        }
    }

    resetAutoSpeakTimer() {
        if (this.autoSpeakTimer) clearTimeout(this.autoSpeakTimer);
        if (this.isMinimized || !this.enableAutoSpeak) return;
        
        // [修复] 根据设定的频率倍率动态调整睡眠阈值。
        // 倍率大于1时（低频），减少需要的次数以保证在一小时左右入睡。
        // 倍率小于1时（高频），最多只允许6次，防止连续说十几次话太烦人。
        let requiredCount = 6;
        if (this.autoSpeakMultiplier > 1.0) {
            requiredCount = Math.max(1, Math.round(6 / this.autoSpeakMultiplier));
        }
        
        if (this.autoSpeakCount >= requiredCount) {
            this.scheduleSleepTimer();
            return;
        }

        // 鏃堕棿璁剧疆 (鍗曚綅: 姣)
        // 绗竴闃舵锛?-3娆★級锛?-15鍒嗛挓锛岀浜岄樁娈碉紙4-6娆★級锛?0-40鍒嗛挓
        let minTime = (this.autoSpeakCount < 3) ? 8 * 60 * 1000 : 30 * 60 * 1000;
        let maxTime = (this.autoSpeakCount < 3) ? 15 * 60 * 1000 : 40 * 60 * 1000;

        let delay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        // 应用用户设定的倍率
        if (this.autoSpeakMultiplier) {
            delay = Math.floor(delay * this.autoSpeakMultiplier);
        }
        this.autoSpeakTimer = setTimeout(() => this.triggerPetSpeak(), delay);
    }

    // [鏂板] 杈惧埌鏈€澶ц嚜瑷€鑷娆℃暟鍚庡紑鍚?10 鍒嗛挓鍊掕鏃剁潯鐪?
    scheduleSleepTimer() {
        if (this.sleepTimer) clearTimeout(this.sleepTimer);
        // 10 鍒嗛挓 = 10 * 60 * 1000 姣
        const sleepDelay = 10 * 60 * 1000;
        console.log("桌宠完成了最后一次自言自语，开启 10 分钟闲置睡眠定时器...");
        this.sleepTimer = setTimeout(() => {
            console.log("闲置超时，桌宠入睡。");
            this.isSleeping = true;
            this.setEmotion('sleeping');
            this.showBubble(`（${this.charName}等累了，已经靠在角落呼呼大睡了……）`, 10000);
        }, sleepDelay);
    }

    wakeUp(quiet = false) {
        if (this.sleepTimer) {
            clearTimeout(this.sleepTimer);
            this.sleepTimer = null;
        }
        if (this.isSleeping) {
            this.isSleeping = false;
            this.autoSpeakCount = 0;
            console.log("宠物被成功唤醒。");
            this.setEmotion('normal');
            if (!quiet) {
                this.showBubble("呜...干嘛吵醒人家，人家刚才梦见超好吃的巧克力饼干了呢！", 3500);
            }
            this.resetAutoSpeakTimer();
        }
    }

    // [新增] 启动时打招呼
    async greetUser() {
        if (this.isSleeping) return; // 睡觉时被打招呼不回应，因为刚启动
        console.log("正在请求开机问候...");
        // 先显示等待，提升体验，设置为-1持续显示直到后端返回覆盖
        this.showBubble("...", -1);

        try {
            const response = await fetch('/api/pet_speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                // 浼犲弬 type: 'greeting'
                body: JSON.stringify({ type: 'greeting', count: 0 })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(data.reply);
                this.setEmotion(data.emotion);
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
            }
        } catch (e) {
            console.error("打招呼失败:", e);
        }
    }

    // [新增] 处理本地快速点击互动
    handlePetClick() {
        if (this.isPeeking) {
            this.isPeeking = false;
            if (typeof petIPC !== 'undefined' && typeof petIPC.sendPetRestore === 'function') {
                petIPC.sendPetRestore();
            }
        }
        if (!this.reactionLines) return;
        if (this.isSleeping) {
            this.wakeUp(false); // 强制唤醒
        }
        
        let emotion = this.currentEmotion || 'normal';
        let lines = this.reactionLines[emotion] || this.reactionLines['normal'] || ["哼！"];
        let randomLine = lines[Math.floor(Math.random() * lines.length)];
        
        // 极速弹出气泡（1.5秒）
        this.showBubble(randomLine, 1500);
        // 随机切换差分动作
        this.setEmotion(emotion);
        
        // 后台静默注入状态机记忆流，不唤醒大模型
        fetch('/api/action_sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: randomLine })
        }).catch(e => console.error("静默同步失败", e));
    }

    async triggerPetSpeak() {
        this.autoSpeakCount++;
        try {
            const response = await fetch('/api/pet_speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ count: this.autoSpeakCount })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(data.reply);
                this.setEmotion(data.emotion);
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.resetAutoSpeakTimer();
        }
    }

    // [鏂板] 鍦ㄧ被涓坊鍔犺繖涓柊鏂规硶
    async loadStatus() {
        try {
            // 璋冪敤 get_history 鎺ュ彛锛屽悗绔凡缁忎慨鏀逛负浼氳繑鍥?favorability
            const response = await fetch('/api/history');
            const data = await response.json();

            if (data.favorability !== undefined) {
                this.favScore.innerText = data.favorability;
                console.log("初始好感度已加载:", data.favorability);
            }
        } catch (e) {
            console.error("加载状态失败", e);
        }
    }

    // [鏂板] 寮傛鍔犺浇骞舵覆鏌?Vis.js 璁板繂鍏崇郴鎷撴墤鍥?
    async loadMemoryGraph() {
        const container = document.getElementById('graph-canvas-container');
        container.innerHTML = '<div style="color: #ff6b8b; text-align: center; padding-top: 80px; font-size:12px;"><i class="fas fa-spinner fa-spin"></i> 姝ｅ湪璇诲彇璁板繂鍥捐氨...</div>';
        
        // 鍒濆闅愯棌鍗＄墖
        const infoCard = document.getElementById('graph-info-card');
        if (infoCard) infoCard.classList.add('hidden');
        
        try {
            const response = await fetch('/api/settings/memory_graph');
            const data = await response.json();
            
            if (!data.success) {
                container.innerHTML = `<div style="color: #ff3333; text-align: center; padding-top: 80px; font-size:12px;">璇诲彇澶辫触: ${data.error}</div>`;
                return;
            }
            
            if (!data.nodes || data.nodes.length === 0) {
                container.innerHTML = `
                    <div style="color: #aaa; text-align: center; padding: 40px 15px 15px 15px; font-size:11px; line-height:1.5;">
                        <i class="fas fa-project-diagram" style="font-size: 24px; color: #ff6b8b; margin-bottom: 8px; display:block;"></i>
                        璁板繂鍥捐氨鐩墠涓虹┖鍝︺€?br>
                        蹇幓鍜岄湶绫冲▍鑱婅亰澶╋紝鎴栫偣鍑讳笂鏂光€滄暣鐞嗕粖鏃ヨ蹇嗏€濇潵鎻愮偧瀵硅瘽鍚э紒
                    </div>
                `;
                return;
            }
            
            container.innerHTML = ''; // 娓呯┖瀹瑰櫒
            
            const visNodes = new vis.DataSet(data.nodes);
            const visEdges = new vis.DataSet(data.edges);
            
            const graphData = {
                nodes: visNodes,
                edges: visEdges
            };
            
            const options = {
                physics: {
                    enabled: true,
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {
                        gravitationalConstant: -26,
                        centralGravity: 0.01,
                        springLength: 80,
                        springConstant: 0.08,
                        damping: 0.4,
                        avoidOverlap: 0.5
                    },
                    stabilization: {
                        iterations: 150,
                        updateInterval: 25
                    }
                },
                interaction: {
                    hover: true,
                    dragNodes: true,
                    dragView: true,
                    zoomView: true
                },
                nodes: {
                    borderWidth: 1.5,
                    font: {
                        face: 'sans-serif',
                        strokeWidth: 2,
                        strokeColor: '#1e1e28'
                    }
                },
                edges: {
                    width: 1.5,
                    selectionWidth: 2.5,
                    hoverWidth: 2.5
                }
            };
            
            if (this.network) {
                this.network.destroy();
            }
            
            this.network = new vis.Network(container, graphData, options);
            
            // 缁戝畾鑺傜偣鐐瑰嚮浜嬩欢
            this.network.on("click", (params) => {
                if (params.nodes && params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = visNodes.get(nodeId);
                    
                    if (node) {
                        const titleEl = document.getElementById('info-node-title');
                        const contentEl = document.getElementById('info-node-content');
                        
                        if (node.type === 'fact') {
                            titleEl.innerHTML = `<i class="fas fa-book" style="color: #ff8da1;"></i> 闇茬背濞呯殑鍥炲繂浜嬪疄`;
                            contentEl.innerText = node.full_text;
                        } else if (node.type === 'entity') {
                            titleEl.innerHTML = `<i class="fas fa-fingerprint" style="color: #8be9fd;"></i> 鍏宠仈璇?瀹炰綋 (${node.entity_type})`;
                            contentEl.innerText = `这个词连接了${this.charName}对您的 "${node.label}" 的记忆碎片。`;
                        }
                        
                        infoCard.classList.remove('hidden');
                    }
                } else {
                    infoCard.classList.add('hidden');
                }
            });
            
        } catch (e) {
            console.error("加载记忆图谱异常:", e);
            container.innerHTML = '<div style="color: #ff3333; text-align: center; padding-top: 80px; font-size:12px;">读取错误，请重试。</div>';
        }
    }

    // [鏂板] 鎵嬪姩鏁寸悊璁板繂涓庢祴璇曟敞鍏?
    async manualDistill(seedTest = false) {
        const distillBtn = document.getElementById('manual-distill-btn');
        const seedBtn = document.getElementById('seed-test-btn');
        
        const originalText1 = distillBtn.innerHTML;
        const originalText2 = seedBtn.innerHTML;
        
        distillBtn.disabled = true;
        seedBtn.disabled = true;
        
        if (seedTest) {
            seedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 娉ㄥ叆涓?..';
        } else {
            distillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 鏁寸悊涓?..';
        }
        
        try {
            const response = await fetch('/api/settings/memory_distill_now', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ seed_test: seedTest })
            });
            const data = await response.json();
            
            if (data.success) {
                this.showBubble(data.message, 3500);
                // 閲嶆柊鍔犺浇鍥捐氨
                await this.loadMemoryGraph();
            } else {
                this.showBubble(data.error, 3500);
            }
        } catch (e) {
            console.error("手动整理记忆异常:", e);
                this.showBubble("现在整理不过来... (网络错误)", 3500);
        } finally {
            distillBtn.disabled = false;
            seedBtn.disabled = false;
            distillBtn.innerHTML = originalText1;
            seedBtn.innerHTML = originalText2;
        }
    }

    // [鏂板] 鍒濆鍖栭鍒跺彂瑷€绯荤粺
    initPresets() {
        this.presetsBtn = document.getElementById('presets-btn');
        this.presetsPopup = document.getElementById('presets-popup');

        // 鐐瑰嚮鎸夐挳鍒囨崲鑿滃崟鏄剧ず/闅愯棌
        this.presetsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.presetsPopup.classList.toggle('hidden');
        });

        // 鐐瑰嚮鍏蜂綋棰勫埗鍙戣█閫夐」锛岃嚜鍔ㄥ～鍏ヨ緭鍏ユ骞惰Е鍙戝彂閫?
        const items = this.presetsPopup.querySelectorAll('.preset-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const text = item.getAttribute('data-text');
                this.input.value = text;
                this.sendMessage();
                this.presetsPopup.classList.add('hidden');
            });
        });

        // 鐐瑰嚮椤甸潰鍏朵粬鍖哄煙锛岃嚜鍔ㄦ敹璧烽鍒惰彍鍗?(浣跨敤 contains 纭繚鐐瑰嚮鎸夐挳鍐呯殑鍥炬爣鏃朵笉浼氳璇垽骞剁灛闂村叧闂?
        document.addEventListener('click', (e) => {
            if (this.presetsPopup && !this.presetsPopup.classList.contains('hidden')) {
                if (this.presetsBtn && this.presetsBtn.contains(e.target)) {
                return; // 点击在预制按钮或其子图标上，由按钮自身事件处理
                }
                if (!this.presetsPopup.contains(e.target)) {
                    this.presetsPopup.classList.add('hidden');
                }
            }
        });
    }

    // [鏂板] 鐩存帴鎾斁鍚庣閫氳繃 ReAct 妫€绱㈣繑鍥炵殑姝屾洸鏁版嵁锛岀粫杩囬噸澶嶆悳绱㈡楠?
    playMusicDirectly(musicPlay) {
        if (!this.playerBar || !this.musicAudio) return;
        console.log(`[MUSIC PLAYER] 开始直接播歌: ${musicPlay.name} - ${musicPlay.artists}`);
        
        this.liveLyrics.innerText = "姝ｅ湪寮€濮嬫挱鏀?..";
        this.musicTitle.innerText = musicPlay.name;
        this.musicArtist.innerText = musicPlay.artists;
        this.playerBar.classList.remove('hidden');
        if (this.inputBar) this.inputBar.classList.add('with-music');
        
        try {
            // 瑙ｆ瀽姝岃瘝
            this.parseLrc(musicPlay.lyric || "");
            
            // 鎾斁闊抽
            this.musicAudio.src = musicPlay.url;
            this.musicAudio.play().catch(e => {
                console.error("[MUSIC PLAYER ERROR] play failed:", e);
                this.liveLyrics.innerText = `播放失败: ${e.message || e}`;
            });
            
            this.musicIsPlaying = true;
            this.musicToggleBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } catch (e) {
            console.error("[MUSIC PLAYER ERROR] playMusicDirectly exception:", e);
                this.liveLyrics.innerText = `播歌异常: ${e.message || e}`;
        }
    }

    // [鏂板] 缃戞槗浜戦煶涔愬師鐢熸帶鍒舵牳蹇冮€昏緫
    async searchAndPlayMusic(query) {
        if (!this.playerBar || !this.musicAudio) return;
        
        console.log(`[MUSIC PLAYER] 开始搜索并点播: ${query}`);
            this.liveLyrics.innerText = "正在搜索音乐，请稍候...";
        this.musicTitle.innerText = "姝ｅ湪鎼滅储...";
        this.musicArtist.innerText = "-";
        this.playerBar.classList.remove('hidden');
        if (this.inputBar) this.inputBar.classList.add('with-music');
        
        try {
            // 1. 璋冪敤鍚庣鎼滅储
            const searchResp = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
            const searchData = await searchResp.json();
            
            if (!searchData.success || !searchData.songs || searchData.songs.length === 0) {
                this.liveLyrics.innerText = "没找到这首歌，换一首试试吧";
                this.musicTitle.innerText = "无结果";
                setTimeout(() => this.stopMusic(), 4000);
                return;
            }
            
            const song = searchData.songs[0];
            this.musicTitle.innerText = song.name;
            this.musicArtist.innerText = song.artists;
            this.liveLyrics.innerText = "正在加载音频流...";
            
            // 2. 鍔犺浇姝岃瘝鍜屾挱鏀剧洿閾?
            const [urlResp, lyricResp] = await Promise.all([
                fetch(`/api/music/url?id=${song.id}`),
                fetch(`/api/music/lyric?id=${song.id}`)
            ]);
            
            const urlData = await urlResp.json();
            const lyricData = await lyricResp.json();
            
            if (!urlData.success || !urlData.url) {
                this.liveLyrics.innerText = "音频加载失败，可能因版权受限...";
                setTimeout(() => this.stopMusic(), 4000);
                return;
            }
            
            // 瑙ｆ瀽姝岃瘝
            this.parseLrc(lyricData.lyric || "");
            
            // 鎾斁闊抽
            this.musicAudio.src = urlData.url;
            await this.musicAudio.play();
            
            this.musicIsPlaying = true;
            this.musicToggleBtn.innerHTML = '<i class="fas fa-pause"></i>';
                console.log(`[MUSIC PLAYER] 成功播放: ${song.name} - ${song.artist}`);
            
        } catch (e) {
                console.error("[MUSIC PLAYER ERROR] 播放异常:", e);
                this.liveLyrics.innerText = `播放异常: ${e.message || e}`;
            setTimeout(() => this.stopMusic(), 6000);
        }
    }

    // 瑙ｆ瀽LRC鏍煎紡姝岃瘝 [mm:ss.xx] 姝岃瘝鍐呭
    parseLrc(lyricText) {
        this.lyricsArray = [];
        if (!lyricText) {
            this.lyricsArray.push({ time: 0, text: "（纯音乐，无歌词）" });
            return;
        }
        
        const lines = lyricText.split("\n");
        const timeReg = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // 鏈夊彲鑳芥湁澶氫釜鏃堕棿鏍囩鍦ㄤ竴琛岋紝閲嶇疆姝ｅ垯鍖归厤绱㈠紩
            timeReg.lastIndex = 0;
            
            // 鎻愬彇姝岃瘝鏂囨湰閮ㄥ垎 (鍘绘帀鎵€鏈夌殑 [xx:xx.xx] 鏃堕棿鏍囩)
            const text = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
            
            let match;
            // 閲嶆柊閬嶅巻鏌ユ壘杩欒閲屾墍鏈夊尮閰嶇殑鏃堕棿鐐?
            timeReg.lastIndex = 0;
            while ((match = timeReg.exec(line)) !== null) {
                const min = parseInt(match[1], 10);
                const sec = parseInt(match[2], 10);
                const ms = match[3] ? parseInt(match[3].substring(0, 2), 10) : 0;
                const totalSeconds = min * 60 + sec + ms / 100;
                
                this.lyricsArray.push({
                    time: totalSeconds,
                    text: text || "~~~" // 留白行替换为波浪号
                });
            }
        }
        
        // 鎸夌収鏃堕棿鎴冲崌搴忔帓搴?
        this.lyricsArray.sort((a, b) => a.time - b.time);
        
        if (this.lyricsArray.length === 0) {
            this.lyricsArray.push({ time: 0, text: "（歌词格式暂不支持解析）" });
        }
    }

    // 鍚屾鍒锋柊姝岃瘝鏄剧ず
    updateLyrics() {
        if (!this.musicAudio || this.lyricsArray.length === 0) return;
        const currentTime = this.musicAudio.currentTime;
        
        // 瀵绘壘鏈€鎺ヨ繎褰撳墠鎾斁鏃堕棿鐨勬瓕璇嶈
        let activeIdx = 0;
        for (let i = 0; i < this.lyricsArray.length; i++) {
            if (currentTime >= this.lyricsArray[i].time) {
                activeIdx = i;
            } else {
                break;
            }
        }
        
        const activeLyric = this.lyricsArray[activeIdx].text;
        // 浠呭綋姝岃瘝鍐呭纭疄鍙戠敓鍙樺寲鏃舵墠鏇存柊DOM锛岄伩鍏嶆棤璋撴覆鏌?
        if (this.liveLyrics.innerText !== activeLyric) {
            this.liveLyrics.innerText = activeLyric;
        }
    }

    // 鎾斁/鏆傚仠鍒囨崲
    toggleMusic() {
        if (!this.musicAudio || !this.musicAudio.src) return;
        
        if (this.musicIsPlaying) {
            this.musicAudio.pause();
            this.musicIsPlaying = false;
            this.musicToggleBtn.innerHTML = '<i class="fas fa-play"></i>';
            console.log("[MUSIC PLAYER] 暂停播放");
        } else {
            this.musicAudio.play().then(() => {
                this.musicIsPlaying = true;
                this.musicToggleBtn.innerHTML = '<i class="fas fa-pause"></i>';
                console.log("[MUSIC PLAYER] 恢复播放");
            }).catch(e => {
                console.error("恢复播放失败:", e);
            });
        }
    }

    // 鍋滄鎾斁骞堕殣钘忔挱鏀惧櫒
    stopMusic() {
        if (this.musicAudio) {
            this.musicAudio.pause();
            this.musicAudio.src = ""; // 彻底切断音频连接，释放流资源
        }
        this.musicIsPlaying = false;
        this.lyricsArray = [];
        if (this.musicToggleBtn) {
            this.musicToggleBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        if (this.liveLyrics) {
            this.liveLyrics.innerText = `让${this.charName}唱首歌给你听吧...`;
        }
        if (this.playerBar) {
            this.playerBar.classList.add('hidden');
        }
        if (this.inputBar) {
            this.inputBar.classList.remove('with-music');
        }
        console.log("[MUSIC PLAYER] 停止播放并收起控制面板");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DesktopPet();
});
