
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
        this.thoughtBtn = document.getElementById('bubble-thought-btn');
        this.thoughtBox = document.getElementById('bubble-thought-box');
        this.thoughtContent = document.getElementById('bubble-thought-content');
        this.closeThoughtBtn = document.getElementById('close-thought-btn');
        this.currentThought = '';
        this.showThoughtButton = true;
        this.ttsBtn = document.getElementById('bubble-tts-btn');
        this.ttsAudio = new Audio();
        this.currentSpeechText = '';
        this.isTtsLoading = false;
        this.img = document.getElementById('pet-img');
        this.favScore = document.getElementById('fav-score');
        this.favContainer = document.getElementById('fav-container');
        this.immersiveChatHistory = document.getElementById('immersive-chat-history');
        this.immersiveChatPanel = document.getElementById('immersive-chat-panel');
        this.toggleChatBtn = document.getElementById('toggle-immersive-chat-btn');
        this.chatTrigger = document.getElementById('immersive-chat-trigger');

        this.images = {};
        this.currentEmotion = 'normal';
        this.reactionLines = null;
        this.isPeeking = false; // [状态追踪] 边缘探头锁定
        
        
        this.currentChatLog = "";
        this.currentDiary = "";
        this.activeLogTab = "chat";
        this.isSleeping = false;
        this.isMinimized = false;
        this.isChatting = false;
        this.sleepTimer = null;
        this.autoSpeakCount = 0;

        this.inputBar = document.querySelector('.input-bar');

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
            if (data.images_dict) {
                this.images = data.images_dict;
                
                // 设置初始图片为normal列表里的第一张，如果没图片则给个缺省
                if (this.images['normal'] && this.images['normal'].length > 0) {
                    this.img.src = this.images['normal'][0];
                } else {
                    this.img.src = prefix + 'normal.png'; // 兜底
                }
            } else {
                this.images = {
                    'normal': [prefix + 'normal.png', prefix + 'normal_1.png', prefix + 'normal_2.png'],
                    'angry': [prefix + 'angry.png', prefix + 'angry_1.png', prefix + 'angry_2.png'],
                    'shy': [prefix + 'shy.png', prefix + 'shy_1.png', prefix + 'shy_2.png'],
                    'crying': [prefix + 'crying.png', prefix + 'crying_1.png', prefix + 'crying_2.png'],
                    'sleeping': [prefix + 'sleeping.png', prefix + 'sleeping_1.png', prefix + 'sleeping_2.png']
                };
                this.img.src = prefix + 'normal.png';
            }

            this.spriteType = data.sprite_type || 'sprite';
            this.live2dModelUrl = data.live2d_model_url || '';
            this.live2dScale = data.live2d_scale !== undefined ? data.live2d_scale : 1.0;
            this.live2dOffsetX = data.live2d_offset_x !== undefined ? data.live2d_offset_x : 0.0;
            this.live2dOffsetY = data.live2d_offset_y !== undefined ? data.live2d_offset_y : 0.0;

            const live2dCanvas = document.getElementById('live2d-canvas');
            if (this.spriteType === 'live2d' && this.live2dModelUrl && window.SoullinkLive2D && live2dCanvas) {
                this.img.classList.add('hidden');
                live2dCanvas.classList.remove('hidden');
                window.SoullinkLive2D.load(live2dCanvas, this.live2dModelUrl).then(() => {
                    window.SoullinkLive2D.setTransform(this.live2dScale, this.live2dOffsetX, this.live2dOffsetY);
                });
                window.SoullinkLive2D.attachAudioLipSync(this.ttsAudio);
            } else {
                if (live2dCanvas) live2dCanvas.classList.add('hidden');
                this.img.classList.remove('hidden');
            }

            this.wallpaperUrl = data.wallpaper_url || "";
            this.wallpaperFit = data.wallpaper_fit || "cover";
            this.enableGreeting = data.enable_greeting !== false;
            this.enableAutoSpeak = data.enable_auto_speak !== false;
            this.showThoughtButton = data.show_thought_button !== false;
            this.enableTts = data.enable_tts !== false;
            this.enableTtsClick = data.enable_tts_click !== false;
            this.enableTtsAuto = data.enable_tts_auto === true || data.tts_speak_mode === "auto";
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
            
            this.needsOnboarding = data.needs_onboarding;
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
        this.input.addEventListener('focus', () => {
            this.resetAutoSpeakTimer();
        });
        this.input.addEventListener('input', () => {
            this.resetAutoSpeakTimer();
        });

        this.initSettings();
        this.initPresets();

        if (this.thoughtBtn) {
            this.thoughtBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleThoughtBox();
            });
        }
        if (this.closeThoughtBtn) {
            this.closeThoughtBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeThoughtBox();
            });
        }

        if (this.ttsBtn) {
            this.ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleTtsSpeak();
            });
        }
        if (this.ttsAudio) {
            this.ttsAudio.addEventListener('ended', () => {
                if (this.ttsBtn) {
                    this.ttsBtn.classList.remove('playing');
                    this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                }
            });
            this.ttsAudio.addEventListener('error', (e) => {
                console.error("[TTS AUDIO PLAY ERROR]", e);
                if (this.ttsBtn) {
                    this.ttsBtn.classList.remove('playing');
                    this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                }
            });
        }

        if (this.toggleChatBtn) {
            this.toggleChatBtn.addEventListener('click', () => {
                const container = document.querySelector('.pet-container');
                if (container) {
                    container.classList.add('chat-collapsed');
                }
                if (this.chatTrigger) {
                    this.chatTrigger.classList.remove('hidden');
                }
            });
        }

        if (this.chatTrigger) {
            this.chatTrigger.addEventListener('click', () => {
                const container = document.querySelector('.pet-container');
                if (container) {
                    container.classList.remove('chat-collapsed');
                }
                this.chatTrigger.classList.add('hidden');
            });
        }

        this.resetAutoSpeakTimer();

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

            // 绑定立绘与 Live2D 画布的拖拽和点击
            const live2dCanvas = document.getElementById('live2d-canvas');
            const bindSpriteDrag = (el) => {
                if (!el) return;
                el.addEventListener('mousedown', (e) => {
                    if (e.button === 0) { 
                        isDragging = true;
                        startX = e.screenX;
                        startY = e.screenY;
                        mousedownX = e.screenX;
                        mousedownY = e.screenY;
                        petIPC.sendSetIgnoreMouseEvents(false);
                        isIgnoring = false;
                        if (this.img) this.img.style.cursor = 'grabbing';
                        if (live2dCanvas) live2dCanvas.style.cursor = 'grabbing';
                    }
                });
                el.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                });
            };

            bindSpriteDrag(this.img);
            bindSpriteDrag(live2dCanvas);

            // mousemove handler (用于 Live2D 视线跟随与窗口拖拽)
            window.addEventListener('mousemove', (e) => {
                if (this.spriteType === 'live2d' && window.SoullinkLive2D) {
                    window.SoullinkLive2D.focus(e.clientX, e.clientY, live2dCanvas);
                }
                if (isDragging) {
                    const deltaX = e.screenX - startX;
                    const deltaY = e.screenY - startY;
                    startX = e.screenX;
                    startY = e.screenY;
                    petIPC.sendWindowDrag(deltaX, deltaY);

                    // Live2D 拖拽组动作联动
                    if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                        window.SoullinkLive2D.triggerDragMotion();
                    }
                }
            });

            // 监听系统全局鼠标坐标，用于无死角地进行 hover 和点击穿透判定
            if (typeof petIPC.onGlobalMouseMove === 'function') {
                petIPC.onGlobalMouseMove((point) => {
                    if (isDragging) return;

                    let isInteractive = this.isImmersiveMode ? true : false;

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
                        const targetSpriteEl = (this.spriteType === 'live2d' && live2dCanvas) ? live2dCanvas : this.img;
                        if (checkHover(targetSpriteEl)) {
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

            // 全局监听 mouseup 停止拖动并触发点击互动
            window.addEventListener('mouseup', (e) => {
                if (isDragging) {
                    isDragging = false;
                    if (this.img) this.img.style.cursor = 'grab';
                    if (live2dCanvas) live2dCanvas.style.cursor = 'grab';
                    
                    if (typeof petIPC.sendWindowDragEnd === 'function') {
                        petIPC.sendWindowDragEnd();
                    }
                    
                    let moveDist = Math.abs(e.screenX - mousedownX) + Math.abs(e.screenY - mousedownY);
                    if (moveDist < 5) { 
                        this.handlePetClick();
                    } else {
                        // 拖拽释放，Live2D 恢复平稳待机
                        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                            window.SoullinkLive2D.triggerIdleMotion();
                        }
                    }
                }
            });
            
            // 监听探头事件 (V2 边缘吸附)
            if (typeof petIPC !== 'undefined') {
                if (petIPC.onPetHideEdge) {
                    petIPC.onPetHideEdge((side) => {
                        this.isPeeking = true;
                        const peekKey = side === 'left' ? 'peeking_left' : 'peeking_right';
                        if (this.images[peekKey] && this.images[peekKey].length > 0) {
                            this.img.src = this.images[peekKey][0];
                        } else if (this.images['normal'] && this.images['normal'].length > 0) {
                            this.img.src = this.images['normal'][0];
                        }
                        
                        document.body.classList.add('peeking-mode');
                        const petContainer = document.querySelector('.pet-container');
                        if (petContainer) {
                            // 往屏幕内微调偏移，保证露出姿态完整自然
                            this.img.style.transform = side === 'left' ? 'translateX(15px)' : 'translateX(-15px)';
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

        if (this.needsOnboarding) {
            setTimeout(() => {
                this.showBubble(`人类，我的大脑现在一片空白，需要你帮我连接一下‘魔力源泉’（AI 引擎）我才能说话哦！<br><br><button onclick="window.__petIPC.openSettingsWindow()" style="padding:6px 12px; border-radius:6px; background:#4a4a5a; color:#fff; cursor:pointer; border:1px solid #6a6a7a; font-family:inherit; font-size:12px;"><i class="fas fa-plug"></i> 点击为我配置大脑</button>`, -1, true);
                this.setEmotion('crying');
            }, 1000);
        } else if (this.enableGreeting) {
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

        // 进入沉浸模式
        this.enterImmersiveBtn = document.getElementById('enter-immersive-btn');
        if (this.enterImmersiveBtn) {
            this.enterImmersiveBtn.addEventListener('click', () => {
                this.enterImmersiveMode();
            });
        }

        this.initImmersiveMode();
    }

    initImmersiveMode() {
        this.isImmersiveMode = false;
        this.immersiveWallpaper = document.getElementById('immersive-wallpaper');
        this.immersiveVideo = document.getElementById('immersive-video-wallpaper');
        this.immersiveWeb = document.getElementById('immersive-web-wallpaper');
        this.immersiveClockContainer = document.getElementById('immersive-clock-container');
        this.immersiveClockTime = document.getElementById('immersive-clock-time');
        this.immersiveClockDate = document.getElementById('immersive-clock-date');

        this.initImmersiveBGM();

        // 按 ESC 键退出沉浸模式，按 P 键 / F12 / PrintScreen 一键高清截屏
        window.addEventListener('keydown', (e) => {
            if (this.isImmersiveMode) {
                if (e.key === 'Escape') {
                    this.exitImmersiveMode();
                } else if (e.key === 'p' || e.key === 'P' || e.key === 'F12' || e.key === 'PrintScreen') {
                    e.preventDefault();
                    this.takeImmersiveScreenshot();
                }
            }
        });

        // 监听来自 Electron 主进程的沉浸模式状态事件
        if (window.__petIPC && typeof window.__petIPC.onImmersiveModeState === 'function') {
            window.__petIPC.onImmersiveModeState((state) => {
                if (!state && this.isImmersiveMode) {
                    this.exitImmersiveMode(false);
                }
            });
        }
    }

    initImmersiveBGM() {
        const bgmToggleBtn = document.getElementById('immersive-bgm-toggle-btn');
        if (bgmToggleBtn) {
            bgmToggleBtn.addEventListener('click', () => {
                this.toggleBGM();
            });
        }

        const screenshotBtn = document.getElementById('immersive-screenshot-btn');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => {
                this.takeImmersiveScreenshot();
            });
        }
    }

    fadePlayBGM(bgmUrl) {
        if (!bgmUrl) return;

        if (this.bgmFadeInterval) {
            clearInterval(this.bgmFadeInterval);
            this.bgmFadeInterval = null;
        }

        if (!this.bgmAudio) {
            this.bgmAudio = new Audio();
        }

        const isSameSrc = this.bgmAudio.src && this.bgmAudio.src.includes(bgmUrl);
        if (!isSameSrc) {
            this.bgmAudio.src = bgmUrl;
        }

        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0;

        const targetVol = 0.8;
        const fadeDuration = 1800;
        const stepTime = 50;
        const volStep = targetVol / (fadeDuration / stepTime);

        this.bgmAudio.play().then(() => {
            this.updateBGMButtonState(true);
            this.bgmFadeInterval = setInterval(() => {
                if (!this.bgmAudio) {
                    clearInterval(this.bgmFadeInterval);
                    return;
                }
                if (this.bgmAudio.volume + volStep < targetVol) {
                    this.bgmAudio.volume += volStep;
                } else {
                    this.bgmAudio.volume = targetVol;
                    clearInterval(this.bgmFadeInterval);
                    this.bgmFadeInterval = null;
                }
            }, stepTime);
        }).catch(err => {
            console.log("BGM 自动播放受限:", err);
            this.updateBGMButtonState(false);
        });
    }

    fadeStopBGM(pauseOnly = false) {
        if (!this.bgmAudio) return;

        if (this.bgmFadeInterval) {
            clearInterval(this.bgmFadeInterval);
            this.bgmFadeInterval = null;
        }

        const currentVol = this.bgmAudio.volume;
        if (currentVol <= 0.05 || this.bgmAudio.paused) {
            this.bgmAudio.pause();
            if (!pauseOnly) this.bgmAudio.src = "";
            this.updateBGMButtonState(false);
            return;
        }

        const fadeDuration = 500;
        const stepTime = 50;
        const volStep = currentVol / (fadeDuration / stepTime);

        this.bgmFadeInterval = setInterval(() => {
            if (!this.bgmAudio) {
                clearInterval(this.bgmFadeInterval);
                return;
            }
            if (this.bgmAudio.volume - volStep > 0) {
                this.bgmAudio.volume -= volStep;
            } else {
                this.bgmAudio.volume = 0;
                this.bgmAudio.pause();
                if (!pauseOnly) {
                    this.bgmAudio.src = "";
                }
                clearInterval(this.bgmFadeInterval);
                this.bgmFadeInterval = null;
                this.updateBGMButtonState(false);
            }
        }, stepTime);
    }

    toggleBGM() {
        if (!this.bgmAudio || !this.bgmAudio.src) {
            if (this.currentBgmUrl) {
                this.fadePlayBGM(this.currentBgmUrl);
            }
            return;
        }

        if (this.bgmAudio.paused || this.bgmAudio.volume === 0) {
            this.fadePlayBGM(this.currentBgmUrl || this.bgmAudio.src);
        } else {
            this.fadeStopBGM(true);
        }
    }

    updateBGMButtonState(isPlaying) {
        const btn = document.getElementById('immersive-bgm-toggle-btn');
        if (!btn) return;

        if (isPlaying) {
            btn.classList.remove('hidden', 'muted');
            btn.innerHTML = '<i class="fas fa-volume-up"></i> <span>BGM 开启</span>';
            btn.title = "点击暂停/静音沉浸音乐";
        } else {
            if (this.currentBgmUrl) {
                btn.classList.remove('hidden');
                btn.classList.add('muted');
                btn.innerHTML = '<i class="fas fa-volume-mute"></i> <span>BGM 静音</span>';
                btn.title = "点击播放/开启沉浸音乐";
            } else {
                btn.classList.add('hidden');
            }
        }
    }

    async enterImmersiveMode() {
        if (this.isImmersiveMode) return;
        this.isImmersiveMode = true;
        this.closeSettingsModal();

        let bgMode = 'image';
        let mediaUrl = '';
        let bgmUrl = '';
        let enableBgm = true;
        let enableStarlight = false;
        let enableMeteors = false;
        let enableParallax = false;
        try {
            const res = await fetch('/api/character_info');
            const data = await res.json();
            if (data.wallpaper_url) this.wallpaperUrl = data.wallpaper_url;
            if (data.wallpaper_fit) this.wallpaperFit = data.wallpaper_fit;
            if (data.immersive_bg_mode) bgMode = data.immersive_bg_mode;
            if (data.immersive_media_url) mediaUrl = data.immersive_media_url;
            if (data.immersive_bgm_url) bgmUrl = data.immersive_bgm_url;
            if (data.enable_immersive_bgm !== undefined) enableBgm = data.enable_immersive_bgm;
            if (data.enable_immersive_starlight !== undefined) enableStarlight = data.enable_immersive_starlight;
            if (data.enable_immersive_meteors !== undefined) enableMeteors = data.enable_immersive_meteors;
            if (data.enable_immersive_parallax !== undefined) enableParallax = data.enable_immersive_parallax;
            if (data.enable_immersive_screenshot_btn !== undefined) {
                const screenshotBtn = document.getElementById('immersive-screenshot-btn');
                if (screenshotBtn) {
                    if (data.enable_immersive_screenshot_btn) {
                        screenshotBtn.classList.remove('hidden');
                    } else {
                        screenshotBtn.classList.add('hidden');
                    }
                }
            }
        } catch (e) {
            console.error("更新沉浸壁纸配置失败:", e);
        }
        this.currentBgmUrl = bgmUrl;

        const container = document.querySelector('.pet-container');
        if (container) {
            container.classList.add('immersive-mode');
        }

        // 停止上一次残留的特效与监听
        this.stopImmersiveEffects();

        // 隐藏所有壁纸组件，避免层叠冲突
        if (this.immersiveWallpaper) this.immersiveWallpaper.classList.add('hidden');
        if (this.immersiveVideo) {
            this.immersiveVideo.classList.add('hidden');
            this.immersiveVideo.pause();
        }
        if (this.immersiveWeb) this.immersiveWeb.classList.add('hidden');

        // 决定画面缩放与拉伸适应模式 (根据用户在大贤者中选择的 Fit Mode，默认 contain 不裁剪不放大)
        const fitMode = this.wallpaperFit || 'contain';

        let activeBgElement = null;

        if (bgMode === 'we_native' || bgMode === 'transparent') {
            // WE 原生渲染/透传模式：自动隐藏 Windows 桌面图标，形成 100% 纯净全屏观赏体验
            fetch('/api/wallpaper_engine/set_clean_desktop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hide_icons: true })
            }).catch(e => console.log(e));
        } else if (bgMode === 'scene_extracted') {
            // 解包 4K 超高清原图
            if (this.immersiveWallpaper) {
                this.immersiveWallpaper.classList.remove('hidden');
                this.immersiveWallpaper.style.backgroundSize = fitMode;
                this.immersiveWallpaper.style.backgroundPosition = 'center';
                this.immersiveWallpaper.style.backgroundRepeat = 'no-repeat';
                this.immersiveWallpaper.style.backgroundImage = `url('${this.wallpaperUrl}')`;
                activeBgElement = this.immersiveWallpaper;
            }
            // Scene 模式默认推荐带有星光与流星
            enableStarlight = true;
            enableMeteors = true;
        } else if (bgMode === 'video' && (mediaUrl || this.wallpaperUrl)) {
            if (this.immersiveVideo) {
                this.immersiveVideo.classList.remove('hidden');
                this.immersiveVideo.src = mediaUrl || this.wallpaperUrl;
                if (fitMode === 'contain') this.immersiveVideo.style.objectFit = 'contain';
                else if (fitMode === '100% 100%') this.immersiveVideo.style.objectFit = 'fill';
                else if (fitMode === 'auto') this.immersiveVideo.style.objectFit = 'none';
                else this.immersiveVideo.style.objectFit = 'cover';
                this.immersiveVideo.play().catch(err => console.log("视频壁纸自动播放提示:", err));
                activeBgElement = this.immersiveVideo;
            }
        } else if (bgMode === 'web' && mediaUrl) {
            if (this.immersiveWeb) {
                this.immersiveWeb.classList.remove('hidden');
                this.immersiveWeb.src = mediaUrl;
                activeBgElement = this.immersiveWeb;
            }
        } else {
            // 默认静态/GIF 图片壁纸
            if (this.immersiveWallpaper) {
                this.immersiveWallpaper.classList.remove('hidden');
                this.immersiveWallpaper.style.backgroundSize = fitMode;
                this.immersiveWallpaper.style.backgroundPosition = 'center';
                this.immersiveWallpaper.style.backgroundRepeat = 'no-repeat';

                if (this.wallpaperUrl) {
                    this.immersiveWallpaper.style.backgroundImage = `url('${this.wallpaperUrl}')`;
                } else {
                    this.immersiveWallpaper.style.backgroundImage = `linear-gradient(135deg, #1e1e2e, #282a36, #44475a)`;
                }
                activeBgElement = this.immersiveWallpaper;
            }
        }

        // 统一装载沉浸模式独立视觉特效 (星光、流星、鼠标视差移动)
        this.startImmersiveEffects(enableStarlight, enableMeteors, enableParallax, activeBgElement);

        // 统一沉浸背景音乐播放与按钮状态更新（淡入循环）
        if (bgmUrl && enableBgm) {
            this.fadePlayBGM(bgmUrl);
        } else {
            this.updateBGMButtonState(false);
        }

        if (this.immersiveChatPanel) {
            this.immersiveChatPanel.classList.remove('hidden');
            this.fetchImmersiveChatHistory();
        }

        if (this.chatTrigger) {
            this.chatTrigger.classList.add('hidden');
        }

        if (container) {
            container.classList.remove('chat-collapsed');
        }

        if (this.immersiveClockContainer) {
            this.immersiveClockContainer.classList.remove('hidden');
            this.updateImmersiveClock();
            if (!this.clockInterval) {
                this.clockInterval = setInterval(() => this.updateImmersiveClock(), 1000);
            }
        }

        // [修复] 进入沉浸模式后角色模糊问题：强制重新加载当前表情立绘 src，促使浏览器在 2 倍放大后立即以高分辨率纹理渲染
        const targetEmotion = this.currentEmotion || 'normal';
        let list = this.images[targetEmotion] || this.images['normal'];
        if (list && list.length > 0) {
            const targetSrc = list[Math.floor(Math.random() * list.length)];
            const separator = targetSrc.includes('?') ? '&' : '?';
            this.img.src = targetSrc + separator + '_imm=1&t=' + Date.now();
        }

        // 通知 Electron 主进程扩充窗口全屏
        if (window.__petIPC && typeof window.__petIPC.sendEnterImmersiveMode === 'function') {
            window.__petIPC.sendEnterImmersiveMode();
        }
    }

    exitImmersiveMode(notifyIPC = true) {
        if (!this.isImmersiveMode) return;
        this.isImmersiveMode = false;

        // 退出沉浸模式时自动恢复 Windows 桌面图标
        fetch('/api/wallpaper_engine/set_clean_desktop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hide_icons: false })
        }).catch(e => console.log(e));

        const container = document.querySelector('.pet-container');
        if (container) {
            container.classList.remove('immersive-mode');
            container.classList.remove('chat-collapsed');
        }

        if (this.immersiveWallpaper) {
            this.immersiveWallpaper.classList.add('hidden');
        }

        // 停止特效粒子与视差监听
        this.stopImmersiveEffects();

        // 退出沉浸模式时平滑淡出背景音乐
        this.fadeStopBGM(false);

        if (this.immersiveVideo) {
            this.immersiveVideo.classList.add('hidden');
            this.immersiveVideo.pause();
            this.immersiveVideo.src = "";
        }

        if (this.immersiveWeb) {
            this.immersiveWeb.classList.add('hidden');
            this.immersiveWeb.src = "";
        }

        if (this.immersiveChatPanel) {
            this.immersiveChatPanel.classList.add('hidden');
        }

        if (this.chatTrigger) {
            this.chatTrigger.classList.add('hidden');
        }

        if (this.immersiveClockContainer) {
            this.immersiveClockContainer.classList.add('hidden');
        }

        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }

        if (notifyIPC && window.__petIPC && typeof window.__petIPC.sendExitImmersiveMode === 'function') {
            window.__petIPC.sendExitImmersiveMode();
        }
    }

    startImmersiveEffects(enableStarlight, enableMeteors, enableParallax, activeBgElement) {
        // 1. 先清理旧的特效与监听
        this.stopImmersiveEffects();

        // 2. 特效 Canvas (星光与流星)
        const canvas = document.getElementById('immersive-particle-canvas');
        if (canvas && (enableStarlight || enableMeteors)) {
            canvas.classList.remove('hidden');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');

            // 星光粒子生成
            const stars = [];
            if (enableStarlight) {
                const count = Math.floor((canvas.width * canvas.height) / 11000);
                for (let i = 0; i < count; i++) {
                    stars.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        radius: Math.random() * 1.8 + 0.5,
                        alpha: Math.random() * 0.8 + 0.2,
                        speed: (Math.random() * 0.025 + 0.008) * (Math.random() > 0.5 ? 1 : -1)
                    });
                }
            }

            // 流星粒子生成
            const meteors = [];
            let lastMeteorSpawnTime = Date.now();

            const spawnMeteor = () => {
                if (!enableMeteors) return;
                const now = Date.now();
                if (now - lastMeteorSpawnTime > Math.random() * 3000 + 1800) {
                    lastMeteorSpawnTime = now;
                    meteors.push({
                        x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
                        y: Math.random() * (canvas.height * 0.35),
                        length: Math.random() * 95 + 55,
                        speed: Math.random() * 8 + 6,
                        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
                        alpha: 1.0
                    });
                }
            };

            const animateCanvas = () => {
                if (!this.isImmersiveMode) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // 渲染星光闪烁
                if (enableStarlight) {
                    stars.forEach(star => {
                        star.alpha += star.speed;
                        if (star.alpha > 0.95 || star.alpha < 0.15) {
                            star.speed = -star.speed;
                        }
                        ctx.save();
                        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1, star.alpha))})`;
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = "rgba(241, 250, 140, 0.8)";
                        ctx.beginPath();
                        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    });
                }

                // 渲染浪漫流星
                if (enableMeteors) {
                    spawnMeteor();
                    for (let i = meteors.length - 1; i >= 0; i--) {
                        const m = meteors[i];
                        m.x += Math.cos(m.angle) * m.speed;
                        m.y += Math.sin(m.angle) * m.speed;
                        m.alpha -= 0.014;

                        if (m.alpha <= 0 || m.x > canvas.width || m.y > canvas.height) {
                            meteors.splice(i, 1);
                            continue;
                        }

                        const tailX = m.x - Math.cos(m.angle) * m.length;
                        const tailY = m.y - Math.sin(m.angle) * m.length;

                        ctx.save();
                        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
                        grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
                        grad.addColorStop(0.35, `rgba(139, 233, 253, ${m.alpha * 0.75})`);
                        grad.addColorStop(1, 'rgba(139, 233, 253, 0)');

                        ctx.strokeStyle = grad;
                        ctx.lineWidth = 2.4;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(m.x, m.y);
                        ctx.lineTo(tailX, tailY);
                        ctx.stroke();
                        ctx.restore();
                    }
                }

                this.particleAnimFrame = requestAnimationFrame(animateCanvas);
            };

            animateCanvas();
        }

        // 3. 鼠标视差悬浮移动特效 (Mouse Parallax Effect)
        if (enableParallax && activeBgElement) {
            this.activeParallaxBgElement = activeBgElement;
            this.parallaxTargetX = 0;
            this.parallaxTargetY = 0;
            this.parallaxCurrentX = 0;
            this.parallaxCurrentY = 0;

            // 视差模式开启后，显示的图片自动放大 1.08 倍，以防边缘挪动时露出空白
            activeBgElement.style.transformOrigin = 'center center';

            this.parallaxMouseMoveHandler = (e) => {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const normX = (e.clientX - centerX) / centerX; // -1 ~ 1
                const normY = (e.clientY - centerY) / centerY; // -1 ~ 1

                // 鼠标在上面 (normY < 0) -> 图片向移动下 (targetY > 0)
                // 鼠标在左边 (normX < 0) -> 图片向右移动 (targetX > 0)
                this.parallaxTargetX = -normX * 24;
                this.parallaxTargetY = -normY * 24;
            };

            window.addEventListener('mousemove', this.parallaxMouseMoveHandler);

            const animateParallax = () => {
                if (!this.isImmersiveMode || !this.activeParallaxBgElement) return;

                // 软滑缓动 Interpolation (lerp 0.08)
                this.parallaxCurrentX += (this.parallaxTargetX - this.parallaxCurrentX) * 0.08;
                this.parallaxCurrentY += (this.parallaxTargetY - this.parallaxCurrentY) * 0.08;

                const curX = this.parallaxCurrentX.toFixed(2);
                const curY = this.parallaxCurrentY.toFixed(2);

                this.activeParallaxBgElement.style.transform = `scale(1.08) translate(${curX}px, ${curY}px)`;

                this.parallaxAnimFrame = requestAnimationFrame(animateParallax);
            };

            animateParallax();
        }
    }

    stopImmersiveEffects() {
        // 停止特效 Canvas 粒子动画
        if (this.particleAnimFrame) {
            cancelAnimationFrame(this.particleAnimFrame);
            this.particleAnimFrame = null;
        }

        const canvas = document.getElementById('immersive-particle-canvas');
        if (canvas) {
            canvas.classList.add('hidden');
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // 停止视差动画与监听
        if (this.parallaxAnimFrame) {
            cancelAnimationFrame(this.parallaxAnimFrame);
            this.parallaxAnimFrame = null;
        }

        if (this.parallaxMouseMoveHandler) {
            window.removeEventListener('mousemove', this.parallaxMouseMoveHandler);
            this.parallaxMouseMoveHandler = null;
        }

        if (this.activeParallaxBgElement) {
            this.activeParallaxBgElement.style.transform = '';
            this.activeParallaxBgElement = null;
        }
    }

    async takeImmersiveScreenshot() {
        if (!this.isImmersiveMode) return;

        // 模拟真实相机的快门闪光反馈
        const flash = document.getElementById('immersive-flash-overlay');
        if (flash) {
            flash.classList.remove('hidden');
            flash.classList.add('active');
            setTimeout(() => {
                flash.classList.remove('active');
                setTimeout(() => flash.classList.add('hidden'), 150);
            }, 100);
        }

        // 调用 Electron 原生 CapturePage 截取全屏高清画面
        if (window.__petIPC && typeof window.__petIPC.captureImmersiveScreenshot === 'function') {
            try {
                const res = await window.__petIPC.captureImmersiveScreenshot();
                if (res && res.success) {
                    this.showImmersiveToast(`📸 截图已保存至桌面，并自动复制到剪贴板！`);
                } else {
                    this.showImmersiveToast(`⚠️ 截图失败: ${res ? res.message : '未知错误'}`);
                }
            } catch (err) {
                console.error("截图异常:", err);
                this.showImmersiveToast(`⚠️ 截图发生错误，请重试`);
            }
        } else {
            this.showImmersiveToast(`当前环境请使用系统截屏 (Win+Shift+S) 或微信/QQ截屏`);
        }
    }

    showImmersiveToast(msg) {
        const toast = document.getElementById('immersive-toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3200);
    }

    async fetchImmersiveChatHistory() {
        if (!this.isImmersiveMode || !this.immersiveChatHistory) return;
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            if (data && data.history) {
                this.renderImmersiveChatHistory(data.history);
            }
        } catch (e) {
            console.error("加载沉浸模式聊天历史失败:", e);
        }
    }

    cleanDisplayText(text) {
        if (!text) return "";
        let cleaned = text.replace(/<(?:think|character_thought|thought)>[\s\S]*?<\/(?:think|character_thought|thought)>/gi, '');
        cleaned = cleaned.replace(/\[[A-Z0-9_]+(?::.*?)?\]/gi, '');
        cleaned = cleaned.replace(/\(用户刚刚触碰了物理动作[，,]?\s*你的下意识反应是[：:]?\s*(.*?)\)/gi, '($1)');
        return cleaned.trim();
    }

    renderImmersiveChatHistory(history) {
        if (!this.immersiveChatHistory) return;
        this.immersiveChatHistory.innerHTML = '';
        history.forEach(item => {
            const cleanedText = this.cleanDisplayText(item.content);
            if (!cleanedText) return;

            const isAction = item.is_action || (cleanedText.startsWith("(") && cleanedText.endsWith(")") && cleanedText.length < 35);
            const msgDiv = document.createElement('div');
            
            if (isAction) {
                msgDiv.className = 'immersive-chat-msg system-action';
            } else {
                const displayRole = (item.role === 'human' || item.role === 'user') ? '你' : item.role;
                const isUser = displayRole === '你';
                msgDiv.className = `immersive-chat-msg ${isUser ? 'user' : 'assistant'}`;
            }

            const senderDiv = document.createElement('div');
            senderDiv.className = 'immersive-chat-sender';
            senderDiv.innerText = `${item.role} · ${item.timestamp || ''}`;

            const textDiv = document.createElement('div');
            textDiv.className = 'immersive-chat-text';
            textDiv.innerText = cleanedText;

            msgDiv.appendChild(senderDiv);
            msgDiv.appendChild(textDiv);
            this.immersiveChatHistory.appendChild(msgDiv);
        });

        // 自动滚动到底部
        if (this.bubble) {
            this.bubble.scrollTop = this.bubble.scrollHeight;
        }
        this.immersiveChatHistory.scrollTop = this.immersiveChatHistory.scrollHeight;
    }

    appendLocalChatMessage(role, content, isAction = false) {
        if (!this.immersiveChatHistory || !content) return;
        const cleanedText = this.cleanDisplayText(content);
        if (!cleanedText) return;

        const checkAction = isAction || (cleanedText.startsWith("(") && cleanedText.endsWith(")") && cleanedText.length < 35);
        const msgDiv = document.createElement('div');

        if (checkAction) {
            msgDiv.className = 'immersive-chat-msg system-action';
        } else {
            const displayRole = (role === 'human' || role === 'user') ? '你' : role;
            const isUser = displayRole === '你';
            msgDiv.className = `immersive-chat-msg ${isUser ? 'user' : 'assistant'}`;
        }

        const senderDiv = document.createElement('div');
        senderDiv.className = 'immersive-chat-sender';
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        senderDiv.innerText = `${role} · ${timeStr}`;

        const textDiv = document.createElement('div');
        textDiv.className = 'immersive-chat-text';
        textDiv.innerText = cleanedText;

        msgDiv.appendChild(senderDiv);
        msgDiv.appendChild(textDiv);
        this.immersiveChatHistory.appendChild(msgDiv);

        if (this.bubble) {
            this.bubble.scrollTop = this.bubble.scrollHeight;
        }
        this.immersiveChatHistory.scrollTop = this.immersiveChatHistory.scrollHeight;
    }

    updateImmersiveClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        if (this.immersiveClockTime) {
            this.immersiveClockTime.innerText = `${hours}:${minutes}`;
        }
        const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const week = weekDays[now.getDay()];
        if (this.immersiveClockDate) {
            this.immersiveClockDate.innerText = `${year}年${month}月${day}日 ${week}`;
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
    // [修改] 切换表情的核心函数（支持普通 PNG 差分与 Live2D VAD 连续情绪）
    setEmotion(emotion) {
        this.currentEmotion = emotion || 'normal';
        if (this.isPeeking) return; // 如果正在边缘暗中观察，锁定换图逻辑

        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.setEmotion(this.currentEmotion);
            return;
        }
        
        let list = this.images[this.currentEmotion] || this.images['normal'];
        if (!list || list.length === 0) {
            list = this.images['normal'];
        }
        if (!list || list.length === 0) return; // Fallback if even normal is empty
        const targetSrc = list[Math.floor(Math.random() * list.length)];

        // 如果当前已经是这张图，就不操作了，避免闪烁
        if (this.img && this.img.src.includes(targetSrc)) return;

        console.log(`切换心情: ${this.currentEmotion} -> 随机差分: ${targetSrc}`);

        if (this.img) {
            this.img.style.opacity = '0.7';
            setTimeout(() => {
                this.img.src = targetSrc;
                this.img.style.opacity = '1';
            }, 150);
        }
    }

    showBubble(text, duration = null, isHtml = false, thought = null) {
        let htmlText;
        if (isHtml) {
            htmlText = text;
        } else {
            // 转义并解析动作括号
            const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            htmlText = escapedText.replace(/(\(.*?\)|（.*?）)/g, '<span class="action-text">$1</span>');
        }
        this.bubbleContent.innerHTML = htmlText;
        this.bubbleContent.scrollTop = 0;
        this.bubble.style.opacity = '1';
        this.bubble.style.pointerEvents = 'auto';

        // 联动 Live2D 触发说话微动作
        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerRandomMotion();
        }

        // 保存当前文本用于 TTS 发音
        this.currentSpeechText = text;
        if (this.ttsBtn) {
            if (this.ttsAudio && !this.ttsAudio.paused) {
                this.ttsAudio.pause();
                this.ttsAudio.currentTime = 0;
            }
            this.ttsBtn.classList.remove('playing');
            this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            if (this.enableTts === false || this.enableTtsClick === false) {
                this.ttsBtn.classList.add('hidden');
            } else {
                this.ttsBtn.classList.remove('hidden');
            }
        }

        // 思维链观察微按钮控制
        this.currentThought = thought || "";
        if (this.thoughtBtn) {
            if (this.currentThought && this.showThoughtButton !== false) {
                this.thoughtBtn.classList.remove('hidden');
                this.thoughtBtn.classList.remove('active');
            } else {
                this.thoughtBtn.classList.add('hidden');
                this.thoughtBtn.classList.remove('active');
            }
        }
        if (this.thoughtBox) {
            this.thoughtBox.classList.add('hidden');
        }

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

    toggleThoughtBox() {
        if (!this.thoughtBox || !this.currentThought) return;
        const isHidden = this.thoughtBox.classList.contains('hidden');
        if (isHidden) {
            this.openThoughtBox();
        } else {
            this.closeThoughtBox();
        }
    }

    openThoughtBox() {
        if (!this.thoughtBox || !this.currentThought) return;
        
        // 格式化思维链文本 (美化 1. 情绪本能 / 2. 规则审查 / 3. 输出规划)
        let formatted = this.currentThought
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/(\d+[\.、]\s*【?[^：:\n]+[：:]?)/g, '<span class="thought-step-num">$1</span>');

        this.thoughtContent.innerHTML = formatted;
        this.thoughtBox.classList.remove('hidden');
        if (this.thoughtBtn) this.thoughtBtn.classList.add('active');

        // 展开思维链时，延长气泡留存时间至 60 秒，保证用户从容阅读
        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
        this.bubble.style.opacity = '1';
        this.bubble.style.pointerEvents = 'auto';
        this.bubbleTimer = setTimeout(() => {
            this.bubble.style.opacity = '0';
            this.bubble.style.pointerEvents = 'none';
        }, 60000);
    }

    closeThoughtBox() {
        if (!this.thoughtBox) return;
        this.thoughtBox.classList.add('hidden');
        if (this.thoughtBtn) this.thoughtBtn.classList.remove('active');
    }

    async handleTtsSpeak() {
        let textToRead = this.currentSpeechText;
        if (!textToRead && this.bubbleContent) {
            textToRead = this.bubbleContent.innerText.trim();
        }
        if (!textToRead || textToRead === '...') return;

        // 如果正在播放，再次点击则停止播放
        if (this.ttsAudio && !this.ttsAudio.paused) {
            this.ttsAudio.pause();
            this.ttsAudio.currentTime = 0;
            if (this.ttsBtn) {
                this.ttsBtn.classList.remove('playing');
                this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            }
            return;
        }

        if (this.isTtsLoading) return;
        this.isTtsLoading = true;

        if (this.ttsBtn) {
            this.ttsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            const resp = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textToRead,
                    character_id: this.characterId
                })
            });
            const data = await resp.json();
            if (data.success && data.audio_url) {
                this.ttsAudio.src = data.audio_url;
                await this.ttsAudio.play();
                if (this.ttsBtn) {
                    this.ttsBtn.classList.add('playing');
                    this.ttsBtn.innerHTML = '<i class="fas fa-volume-high"></i>';
                }
            } else {
                console.error("[TTS API ERROR]", data.error);
                if (this.ttsBtn) {
                    this.ttsBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                    setTimeout(() => {
                        if (this.ttsBtn) this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                    }, 3000);
                }
            }
        } catch (err) {
            console.error("[TTS FETCH ERROR]", err);
            if (this.ttsBtn) {
                this.ttsBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                setTimeout(() => {
                    if (this.ttsBtn) this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                }, 3000);
            }
        } finally {
            this.isTtsLoading = false;
        }
    }

    handleAutoTtsPlay(audioUrl) {
        if (!audioUrl || this.enableTts === false) return;
        try {
            if (this.ttsAudio) {
                this.ttsAudio.pause();
                this.ttsAudio.currentTime = 0;
                this.ttsAudio.src = audioUrl;
                this.ttsAudio.play().catch(e => console.log("[AUTO-TTS PLAY EX]", e));
                if (this.ttsBtn) {
                    this.ttsBtn.classList.add('playing');
                    this.ttsBtn.innerHTML = '<i class="fas fa-volume-high"></i>';
                }
            }
        } catch (e) {
            console.error("[AUTO-TTS ERROR]", e);
        }
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';
        this.autoSpeakCount = 0;
        this.isChatting = true;
        this.resetAutoSpeakTimer();
        this.wakeUp(true); // 静默唤醒 (接下来的大模型回复会展示表情与气泡)
        if (this.isImmersiveMode) {
            this.appendLocalChatMessage("你", text);
        }

        this.showBubble("hmm...", -1);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            if (data.success) {
                this.showBubble(data.reply, null, false, data.thought);
                this.setEmotion(data.emotion);
                if (this.isImmersiveMode) {
                    this.appendLocalChatMessage(this.charName || "桌宠", data.reply);
                }

                // 若开启主动说话并返回了语音，则自动播放
                if (data.audio_url) {
                    this.handleAutoTtsPlay(data.audio_url);
                }

                // 2. 处理好感度
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;

                    if (data.fav_change > 0) {
                        this.favScore.innerHTML = `${data.favorability} <span style="color: #ff3366; font-size: 14px; margin-left:5px;">(+1)</span>`;
                        setTimeout(() => this.favScore.innerText = data.favorability, 2000);
                    } else if (data.fav_change < 0) {
                        this.favScore.innerHTML = `${data.favorability} <span style="color: #888; font-size: 14px; margin-left:5px;">(-1)</span>`;
                        setTimeout(() => this.favScore.innerText = data.favorability, 2000);
                    }
                }
            } else {
                // 收到报错或欠费通知 (显示在气泡和思维链中)
                const errorReply = data.reply || (data.error ? `发生错误: ${data.error}` : "大模型好像断开连接了...");
                const errorThought = data.thought || (data.error ? `【系统异常】${data.error}` : "");
                const errorEmotion = data.emotion || 'crying';
                this.showBubble(errorReply, null, false, errorThought);
                this.setEmotion(errorEmotion);
                if (this.isImmersiveMode) {
                    this.appendLocalChatMessage(this.charName || "桌宠", errorReply);
                }
            }
        } catch (e) {
            console.error("[CHAT ERROR] 聊天请求失败:", e);
            this.showBubble("呜...大模型连接断开了 (网络或服务异常)", 8000);
            this.setEmotion('crying');
        } finally {
            this.isChatting = false;
            this.resetAutoSpeakTimer();
        }
    }

    resetAutoSpeakTimer() {
        if (this.autoSpeakTimer) clearTimeout(this.autoSpeakTimer);
        if (this.isMinimized || !this.enableAutoSpeak || this.isSleeping) return;
        
        let requiredCount = 6;
        if (this.autoSpeakMultiplier > 1.0) {
            requiredCount = Math.max(1, Math.round(6 / this.autoSpeakMultiplier));
        }
        
        if (this.autoSpeakCount >= requiredCount) {
            this.scheduleSleepTimer();
            return;
        }

        let minTime = (this.autoSpeakCount < 3) ? 8 * 60 * 1000 : 30 * 60 * 1000;
        let maxTime = (this.autoSpeakCount < 3) ? 15 * 60 * 1000 : 40 * 60 * 1000;

        let delay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        if (this.autoSpeakMultiplier) {
            delay = Math.floor(delay * this.autoSpeakMultiplier);
        }
        this.autoSpeakTimer = setTimeout(() => this.triggerPetSpeak(), delay);
    }

    scheduleSleepTimer() {
        if (this.sleepTimer) clearTimeout(this.sleepTimer);
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

    // 启动时打招呼
    async greetUser() {
        if (this.isSleeping) return;
        console.log("正在请求开机问候...");
        this.showBubble("...", -1);

        try {
            const response = await fetch('/api/pet_speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ type: 'greeting', count: 0 })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(data.reply, -1, false, data.thought);
                this.setEmotion(data.emotion);
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
                if (data.audio_url) {
                    this.handleAutoTtsPlay(data.audio_url);
                }
            } else {
                // 开机打招呼遇上欠费或配置错误
                const errorReply = data.reply || (data.error ? `启动问候失败: ${data.error}` : "打招呼失败 (大模型服务异常)");
                const errorThought = data.thought || (data.error ? `【开机异常】${data.error}` : "");
                const errorEmotion = data.emotion || 'crying';
                this.showBubble(errorReply, 10000, false, errorThought);
                this.setEmotion(errorEmotion);
            }
        } catch (e) {
            console.error("打招呼失败:", e);
            this.showBubble("呜...无法连接到后台大模型服务 (网络错误)", 8000);
            this.setEmotion('crying');
        }
    }

    // 处理本地快速点击互动
    handlePetClick() {
        this.resetAutoSpeakTimer();
        if (this.isPeeking) {
            this.isPeeking = false;
            if (typeof petIPC !== 'undefined' && typeof petIPC.sendPetRestore === 'function') {
                petIPC.sendPetRestore();
            }
        }
        if (!this.reactionLines) return;
        if (this.isSleeping) {
            let lines = this.reactionLines['sleeping'] || ["呼呼呼... (正在做梦)"];
            let randomLine = lines[Math.floor(Math.random() * lines.length)];
            this.showBubble(randomLine, 1500);
            return;
        }
        
        let emotion = this.currentEmotion || 'normal';
        let lines = this.reactionLines[emotion] || this.reactionLines['normal'] || ["哼！"];
        let randomLine = lines[Math.floor(Math.random() * lines.length)];
        
        this.showBubble(randomLine, 1500);
        if (this.isImmersiveMode) {
            this.appendLocalChatMessage("你 (动作)", `(戳了戳${this.charName || "桌宠"})`, true);
            this.appendLocalChatMessage(this.charName || "桌宠", randomLine);
        }
        this.setEmotion(emotion);
        
        // 联动 Live2D 触发点击组动作 (随机表演)
        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerTapMotion();
        }
        
        fetch('/api/action_sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: randomLine })
        }).catch(e => console.error("静默同步失败", e));
    }

    async triggerPetSpeak() {
        if (this.isPeeking || this.isSleeping || this.isChatting) {
            if (!this.isSleeping) this.resetAutoSpeakTimer();
            return;
        }
        
        this.autoSpeakCount++;
        try {
            const response = await fetch('/api/pet_speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ count: this.autoSpeakCount })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(data.reply, -1, false, data.thought);
                this.setEmotion(data.emotion);
                if (this.isImmersiveMode) {
                    this.appendLocalChatMessage(this.charName || "桌宠", data.reply);
                }
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
                if (data.audio_url) {
                    this.handleAutoTtsPlay(data.audio_url);
                }
            } else if (data.is_error && data.reply) {
                this.showBubble(data.reply, 10000, false, data.thought);
                this.setEmotion(data.emotion || 'crying');
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

    // [新增] 初始化预制发言系统
    initPresets() {
        this.presetsBtn = document.getElementById('presets-btn');
        this.presetsPopup = document.getElementById('presets-popup');
        this.actionPopup = document.getElementById('action-popup');
        this.toolsPopup = document.getElementById('tools-popup');

        // 点击按钮切换菜单显示/隐藏
        this.presetsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.presetsPopup.classList.contains('hidden') && this.toolsPopup.classList.contains('hidden')) {
                this.actionPopup.classList.toggle('hidden');
            } else {
                this.actionPopup.classList.add('hidden');
                this.presetsPopup.classList.add('hidden');
                this.toolsPopup.classList.add('hidden');
            }
        });

        if(document.getElementById('open-presets-btn')) {
            document.getElementById('open-presets-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.actionPopup.classList.add('hidden');
                this.presetsPopup.classList.remove('hidden');
            });
        }

        if(document.getElementById('open-tools-btn')) {
            document.getElementById('open-tools-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.actionPopup.classList.add('hidden');
                this.toolsPopup.classList.remove('hidden');
            });
        }

        if(document.getElementById('tool-clean-memory')) {
            document.getElementById('tool-clean-memory').addEventListener('click', async (e) => {
                e.stopPropagation();
                this.toolsPopup.classList.add('hidden');
                
                this.showBubble("正在深度清理内存中...", -1);
                try {
                    const cleanRes = await fetch('/api/clean_memory', { method: 'POST' });
                    const cleanData = await cleanRes.json();
                    
                    if(cleanData.success) {
                        const response = await fetch('/api/pet_speak', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ type: 'clean_memory', count: 1, message: cleanData.message })
                        });
                        const data = await response.json();
                        if (data.success) {
                            this.showBubble(data.reply);
                            this.setEmotion(data.emotion);
                            if (data.favorability !== undefined) {
                                this.favScore.innerText = data.favorability;
                            }
                        }
                    } else {
                        this.showBubble("内存清理失败了捏...");
                        setTimeout(() => this.showBubble(""), 3000);
                    }
                } catch (err) {
                    console.error(err);
                    this.showBubble("调用清理工具出错了...");
                }
            });
        }
        
        if(document.getElementById('tool-read-process')) {
            document.getElementById('tool-read-process').addEventListener('click', async (e) => {
                e.stopPropagation();
                this.toolsPopup.classList.add('hidden');
                
                this.showBubble("正在探查后台进程...", -1);
                try {
                    const response = await fetch('/api/pet_speak', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ type: 'read_process' })
                    });
                    const data = await response.json();
                    if (data.success) {
                        this.showBubble(data.reply);
                        this.setEmotion(data.emotion);
                        if (data.favorability !== undefined) {
                            this.favScore.innerText = data.favorability;
                        }
                    } else {
                        this.showBubble("进程读取失败了捏...");
                        setTimeout(() => this.showBubble(""), 3000);
                    }
                } catch (err) {
                    console.error(err);
                    this.showBubble("调用进程工具出错了...");
                }
            });
        }

        // 点击具体预制发言选项，自动填入输入框并触发发送
        const items = this.presetsPopup.querySelectorAll('.preset-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const text = item.getAttribute('data-text');
                this.input.value = text;
                this.sendMessage();
                this.presetsPopup.classList.add('hidden');
            });
        });

        // 点击页面其他区域，自动收起预制菜单
        document.addEventListener('click', (e) => {
            if (this.presetsBtn && this.presetsBtn.contains(e.target)) return;
            
            if (this.actionPopup && !this.actionPopup.contains(e.target)) {
                this.actionPopup.classList.add('hidden');
            }
            if (this.presetsPopup && !this.presetsPopup.contains(e.target)) {
                this.presetsPopup.classList.add('hidden');
            }
            if (this.toolsPopup && !this.toolsPopup.contains(e.target)) {
                this.toolsPopup.classList.add('hidden');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DesktopPet();
    
    // 心跳上报：每 60 秒上报一次存活，用来统计用户使用时长
    setInterval(() => {
        fetch('/api/stats/ping', { method: 'POST' }).catch(e => console.error("Ping error:", e));
    }, 60000);
});
