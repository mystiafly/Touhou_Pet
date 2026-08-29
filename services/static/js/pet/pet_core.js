/**
 * Desktop Pet - Core Runtime & Interaction Engine
 * 职责：桌宠核心生命周期、Live2D 与 Dairi 双引擎表情状态机、气泡动画与思维链展示、自言自语/开机问候与对话交互
 */

class DesktopPetCore {
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
        this.currentSpeechText = '';
        this.lastSpokenText = '';
        this.lastSpokenEmotion = 'normal';
        this.lastSpokenThought = '';

        this.img = document.getElementById('pet-img');
        this.favScore = document.getElementById('fav-score');
        this.favContainer = document.getElementById('fav-container');
        this.inputBar = document.querySelector('.input-bar');

        this.images = {};
        this.currentEmotion = 'normal';
        this.reactionLines = null;
        this.reactionsDetail = null;
        this.isPeeking = false;
        
        this.isSleeping = false;
        this.isMinimized = false;
        this.isChatting = false;
        this.sleepTimer = null;
        this.autoSpeakTimer = null;
        this.autoSpeakCount = 0;
        this.bubbleTimer = null;

        // 子系统模块挂载 (Audio & Immersive)
        this.audio = new PetAudioController(this);
        this.immersive = new PetImmersiveEngine(this, this.audio);

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
            if (this.input) {
                this.input.placeholder = `和${this.charName}说话...`;
            }

            if (data.images_dict) {
                this.images = data.images_dict;
                if (this.images['normal'] && this.images['normal'].length > 0) {
                    this.img.src = this.images['normal'][0];
                } else {
                    this.img.src = prefix + 'normal.png';
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

            this.activeSpriteSet = data.active_sprite_set || 'main_sprites';
            this.spriteType = data.sprite_type || 'sprite';
            this.live2dModelUrl = data.live2d_model_url || '';
            this.live2dScale = data.live2d_scale !== undefined ? data.live2d_scale : 1.0;
            this.live2dOffsetX = data.live2d_offset_x !== undefined ? data.live2d_offset_x : 0.0;
            this.live2dOffsetY = data.live2d_offset_y !== undefined ? data.live2d_offset_y : 0.0;
            this.spriteScale = data.live2d_scale !== undefined ? data.live2d_scale : 1.0;

            const live2dCanvas = document.getElementById('live2d-canvas');
            if (this.spriteType === 'live2d' && this.live2dModelUrl && window.SoullinkLive2D && live2dCanvas) {
                this.img.classList.add('hidden');
                live2dCanvas.classList.remove('hidden');
                window.SoullinkLive2D.load(live2dCanvas, this.live2dModelUrl).then(() => {
                    window.SoullinkLive2D.setTransform(this.live2dScale, this.live2dOffsetX, this.live2dOffsetY);
                });
                if (this.audio && this.audio.ttsAudio) {
                    window.SoullinkLive2D.attachAudioLipSync(this.audio.ttsAudio);
                }
            } else {
                if (live2dCanvas) live2dCanvas.classList.add('hidden');
                this.img.classList.remove('hidden');
                if (this.spriteScale !== 1.0) {
                    this.img.style.transform = `scale(${this.spriteScale})`;
                    this.img.style.transformOrigin = 'bottom center';
                }
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
            
            // 角色互动台词及离线语音映射
            try {
                const reactionRes = await fetch('/api/pet_reactions?_t=' + Date.now());
                const reactionData = await reactionRes.json();
                if (reactionData.success) {
                    this.reactionLines = reactionData.reactions;
                    this.reactionsDetail = reactionData.reactions_detail || {};
                }
            } catch(e) {
                console.error("[PET] Failed to load reaction lines", e);
            }
            
            this.needsOnboarding = data.needs_onboarding;
        } catch (e) {
            console.error("[PET] Failed to load character info", e);
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
        if (this.input) {
            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
            this.input.addEventListener('focus', () => this.resetAutoSpeakTimer());
            this.input.addEventListener('input', () => this.resetAutoSpeakTimer());
        }

        this.initSettings();
        this.initPresets();
        this.setupScaleInteraction();

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

        this.resetAutoSpeakTimer();
        this.loadStatus();

        // 动态穿透切换与窗口拖拽绑定
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
            if (typeof petIPC.onWindowStateChanged === 'function') {
                petIPC.onWindowStateChanged((state) => {
                    if (state === 'minimized') {
                        this.isMinimized = true;
                        if (this.autoSpeakTimer) {
                            clearTimeout(this.autoSpeakTimer);
                            this.autoSpeakTimer = null;
                        }
                    } else if (state === 'restored') {
                        this.isMinimized = false;
                        this.resetAutoSpeakTimer();
                    }
                });
            }

            let isDragging = false;
            let startX = 0, startY = 0;
            let mousedownX = 0, mousedownY = 0;
            let isIgnoring = false;

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
                el.addEventListener('dragstart', (e) => e.preventDefault());
            };

            bindSpriteDrag(this.img);
            bindSpriteDrag(live2dCanvas);

            window.addEventListener('mousemove', (e) => {
                if (this.spriteType === 'live2d' && window.SoullinkLive2D) {
                    window.SoullinkLive2D.focus(e.clientX, e.clientY, live2dCanvas, this.immersive?.isImmersiveMode);
                }
                if (isDragging) {
                    const deltaX = e.screenX - startX;
                    const deltaY = e.screenY - startY;
                    startX = e.screenX;
                    startY = e.screenY;
                    petIPC.sendWindowDrag(deltaX, deltaY);

                    if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                        window.SoullinkLive2D.triggerDragMotion(deltaX, deltaY);
                    }
                }
            });

            window.addEventListener('mouseleave', () => {
                if (this.spriteType === 'live2d' && window.SoullinkLive2D) {
                    window.SoullinkLive2D.resetFocus();
                }
            });

            if (typeof petIPC.onGlobalMouseMove === 'function') {
                petIPC.onGlobalMouseMove((point) => {
                    if (isDragging) return;

                    let isInteractive = this.immersive?.isImmersiveMode ? true : false;

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
                        if (checkHover(targetSpriteEl)) isInteractive = true;
                        else if (checkHover(this.inputBar)) isInteractive = true;
                        else if (this.favContainer && checkHover(this.favContainer)) isInteractive = true;
                        else if (this.bubble && this.bubble.style.opacity === '1' && checkHover(this.bubble)) isInteractive = true;
                        else if (this.settingsModal && !this.settingsModal.classList.contains('hidden') && checkHover(this.settingsModal)) isInteractive = true;
                        else if (this.presetsPopup && !this.presetsPopup.classList.contains('hidden') && checkHover(this.presetsPopup)) isInteractive = true;
                    } catch (err) {}

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

                    if (this.spriteType === 'live2d' && window.SoullinkLive2D) {
                        if (isInteractive) {
                            const mouseX = point.x - window.screenX;
                            const mouseY = point.y - window.screenY;
                            window.SoullinkLive2D.focus(mouseX, mouseY, live2dCanvas, this.immersive?.isImmersiveMode);
                        } else {
                            window.SoullinkLive2D.resetFocus();
                        }
                    }
                });
            }

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
                        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                            window.SoullinkLive2D.triggerIdleMotion();
                        }
                    }
                }
            });
            
            // 边缘吸附与探头
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
                        if (this.img) {
                            this.img.style.transform = side === 'left' ? 'translateX(15px)' : 'translateX(-15px)';
                        }
                    });
                }
                if (petIPC.onPetRestore) {
                    petIPC.onPetRestore(() => {
                        if (this.isPeeking) {
                            this.isPeeking = false;
                            document.body.classList.remove('peeking-mode');
                            if (this.img) {
                                this.img.style.transform = '';
                                const list = this.images[this.currentEmotion] || this.images['normal'];
                                if (list && list.length > 0) {
                                    this.img.src = list[Math.floor(Math.random() * list.length)];
                                }
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
        this.openDashboardBtn = document.getElementById('open-dashboard-btn');
        this.enterImmersiveBtn = document.getElementById('enter-immersive-btn');

        if (this.openDashboardBtn) {
            this.openDashboardBtn.addEventListener('click', () => {
                if (window.__petIPC && typeof window.__petIPC.openSettingsWindow === 'function') {
                    window.__petIPC.openSettingsWindow();
                }
                this.closeSettingsModal();
            });
        }

        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                this.settingsModal.classList.remove('hidden');
            });
        }

        if (this.closeSettingsBtn) {
            this.closeSettingsBtn.addEventListener('click', () => {
                this.closeSettingsModal();
            });
        }

        if (this.exitGameBtn) {
            this.exitGameBtn.addEventListener('click', () => this.exitGame());
        }

        if (this.minimizeBtn) {
            this.minimizeBtn.addEventListener('click', () => {
                this.settingsModal.classList.add('hidden');
                if (window.__petIPC && typeof window.__petIPC.sendMinimizeToTray === 'function') {
                    window.__petIPC.sendMinimizeToTray();
                }
            });
        }

        if (this.enterImmersiveBtn) {
            this.enterImmersiveBtn.addEventListener('click', () => {
                if (this.immersive) this.immersive.enterImmersiveMode();
            });
        }
    }

    closeSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.classList.add('hidden');
        }
    }

    async exitGame() {
        if (!await window.asyncConfirm(`要让${this.charName}去睡觉吗？`)) return;

        this.showBubble("那...晚安啦...", 2000);
        this.setEmotion('normal'); 
        this.closeSettingsModal();

        try {
            fetch('/api/settings/exit', { method: 'POST' }).catch(() => {});
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

    setEmotion(emotion) {
        this.currentEmotion = emotion || 'normal';
        if (this.isPeeking) return;

        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.setEmotion(this.currentEmotion);
            return;
        }
        
        let list = this.images[this.currentEmotion] || this.images['normal'];
        if (!list || list.length === 0) list = this.images['normal'];
        if (!list || list.length === 0) return;
        const targetSrc = list[Math.floor(Math.random() * list.length)];

        if (this.img && this.img.src.includes(targetSrc)) return;

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
            const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            htmlText = escapedText.replace(/(\(.*?\)|（.*?）)/g, '<span class="action-text">$1</span>');
        }
        this.bubbleContent.innerHTML = htmlText;
        this.bubbleContent.scrollTop = 0;
        this.bubble.style.opacity = '1';
        this.bubble.style.pointerEvents = 'auto';

        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerRandomMotion();
        }

        this.currentSpeechText = text;
        if (text && text !== '...' && !text.startsWith('hmm...') && !text.startsWith('（正在') && !text.startsWith('（系统')) {
            if (this.audio) {
                let foundOfflineAudio = null;
                if (this.reactionsDetail) {
                    for (const emoKey of Object.keys(this.reactionsDetail)) {
                        const item = (this.reactionsDetail[emoKey] || []).find(x => x.text === text);
                        if (item && item.has_audio && item.audio_url) {
                            foundOfflineAudio = item.audio_url;
                            break;
                        }
                    }
                }
                if (foundOfflineAudio) {
                    this.audio.lastSpokenAudioUrl = foundOfflineAudio;
                } else if (this.lastSpokenText !== text) {
                    this.audio.lastSpokenAudioUrl = '';
                }
            }
            this.lastSpokenText = text;
            this.lastSpokenEmotion = this.currentEmotion || 'normal';
            this.lastSpokenThought = thought || this.currentThought || '';
        }

        if (this.audio && this.audio.ttsBtn) {
            if (this.audio.ttsAudio && !this.audio.ttsAudio.paused) {
                this.audio.ttsAudio.pause();
                this.audio.ttsAudio.currentTime = 0;
            }
            this.audio.resetTtsButtonState();
            if (this.enableTts === false || this.enableTtsClick === false) {
                this.audio.ttsBtn.classList.add('hidden');
            } else {
                this.audio.ttsBtn.classList.remove('hidden');
            }
        }

        this.currentThought = thought || "";
        if (this.thoughtBtn) {
            if (this.currentThought && this.showThoughtButton !== false) {
                this.thoughtBtn.classList.remove('hidden', 'active');
            } else {
                this.thoughtBtn.classList.add('hidden');
                this.thoughtBtn.classList.remove('active');
            }
        }
        if (this.thoughtBox) {
            this.thoughtBox.classList.add('hidden');
        }

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);

        let showTime = duration;
        if (!showTime) {
            const calcTime = 3000 + (text.length * 300);
            const multiplier = this.bubbleDurationMultiplier || 1.0;
            const finalTime = calcTime * multiplier;
            const maxLimit = 30000 * Math.max(1.0, multiplier * 0.5); 
            showTime = Math.min(finalTime, maxLimit);
        }

        if (showTime > 0) {
            this.bubbleTimer = setTimeout(() => {
                this.bubble.style.opacity = '0';
                this.bubble.style.pointerEvents = 'none';
            }, showTime);
        }
    }

    replayLastSpeech() {
        if (!this.lastSpokenText) {
            this.showBubble("刚才还没有说话记录哦~", 2500);
            return;
        }
        
        // 唤醒气泡并恢复展示
        this.showBubble(this.lastSpokenText, 8000, false, this.lastSpokenThought);
        if (this.lastSpokenEmotion) {
            this.setEmotion(this.lastSpokenEmotion);
        }

        // 立即播放语音
        if (this.audio) {
            if (this.audio.lastSpokenAudioUrl) {
                this.audio.handleAutoTtsPlay(this.audio.lastSpokenAudioUrl);
            } else {
                this.audio.handleTtsSpeak();
            }
        }
    }

    toggleThoughtBox() {
        if (!this.thoughtBox || !this.currentThought) return;
        const isHidden = this.thoughtBox.classList.contains('hidden');
        if (isHidden) this.openThoughtBox();
        else this.closeThoughtBox();
    }

    openThoughtBox() {
        if (!this.thoughtBox || !this.currentThought) return;
        
        let formatted = this.currentThought
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/(\d+[\.、]\s*【?[^：:\n]+[：:]?)/g, '<span class="thought-step-num">$1</span>');

        this.thoughtContent.innerHTML = formatted;
        this.thoughtBox.classList.remove('hidden');
        if (this.thoughtBtn) this.thoughtBtn.classList.add('active');

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

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';
        this.autoSpeakCount = 0;
        this.isChatting = true;
        this.resetAutoSpeakTimer();
        this.wakeUp(true);
        if (this.immersive?.isImmersiveMode) {
            this.immersive.appendLocalChatMessage("你", text);
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
                if (this.immersive?.isImmersiveMode) {
                    this.immersive.appendLocalChatMessage(this.charName || "桌宠", data.reply);
                }

                if (data.audio_url && this.audio) {
                    this.audio.handleAutoTtsPlay(data.audio_url);
                }

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
                const errorReply = data.reply || (data.error ? `发生错误: ${data.error}` : "大模型好像断开连接了...");
                const errorThought = data.thought || (data.error ? `【系统异常】${data.error}` : "");
                const errorEmotion = data.emotion || 'crying';
                this.showBubble(errorReply, null, false, errorThought);
                this.setEmotion(errorEmotion);
                if (this.immersive?.isImmersiveMode) {
                    this.immersive.appendLocalChatMessage(this.charName || "桌宠", errorReply);
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
        this.sleepTimer = setTimeout(() => {
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
            this.setEmotion('normal');
            if (!quiet) {
                this.showBubble("呜...干嘛吵醒人家，人家刚才梦见超好吃的巧克力饼干了呢！", 3500);
            }
            this.resetAutoSpeakTimer();
        }
    }

    async greetUser() {
        if (this.isSleeping) return;
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
                if (data.audio_url && this.audio) {
                    this.audio.handleAutoTtsPlay(data.audio_url);
                } else if (this.audio) {
                    this.audio.requestAsyncTts(data.reply, data.emotion);
                }
            } else {
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

        // 检查是否有已录制的本地离线语音，实现 0ms 本地瞬发秒播
        let matchedAudioUrl = null;
        if (this.reactionsDetail) {
            if (this.reactionsDetail[emotion]) {
                const item = this.reactionsDetail[emotion].find(x => x.text === randomLine);
                if (item && item.has_audio && item.audio_url) {
                    matchedAudioUrl = item.audio_url;
                }
            }
            if (!matchedAudioUrl) {
                for (const emoKey of Object.keys(this.reactionsDetail)) {
                    const item = (this.reactionsDetail[emoKey] || []).find(x => x.text === randomLine);
                    if (item && item.has_audio && item.audio_url) {
                        matchedAudioUrl = item.audio_url;
                        break;
                    }
                }
            }
        }

        this.showBubble(randomLine, 2500);
        if (matchedAudioUrl && this.audio) {
            this.audio.lastSpokenAudioUrl = matchedAudioUrl;
        }

        if (this.immersive?.isImmersiveMode) {
            this.immersive.appendLocalChatMessage("你 (动作)", `(戳了戳${this.charName || "桌宠"})`, true);
            this.immersive.appendLocalChatMessage(this.charName || "桌宠", randomLine);
        }
        this.setEmotion(emotion);
        
        if (this.spriteType === 'live2d' && window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.triggerTapMotion();
        }

        // 只要启用了语音 (enableTts !== false)
        if (this.enableTts !== false && this.audio) {
            if (matchedAudioUrl) {
                // 已有离线语音：主动点击桌宠直接 0ms 播放语音！
                this.audio.handleAutoTtsPlay(matchedAudioUrl);
            } else if (this.enableTtsAuto || this.ttsSpeakMode === "auto") {
                // 尚未录制离线语音且开启了自动合成：异步请求在线合成并自动持久化收录
                this.audio.requestAsyncTts(randomLine, emotion);
            }
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
                if (this.immersive?.isImmersiveMode) {
                    this.immersive.appendLocalChatMessage(this.charName || "桌宠", data.reply);
                }
                if (data.favorability !== undefined) {
                    this.favScore.innerText = data.favorability;
                }
                if (data.audio_url && this.audio) {
                    this.audio.handleAutoTtsPlay(data.audio_url);
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

    async loadStatus() {
        try {
            const response = await fetch('/api/history');
            const data = await response.json();
            if (data.favorability !== undefined && this.favScore) {
                this.favScore.innerText = data.favorability;
            }
        } catch (e) {
            console.error("[STATUS] 加载好感度失败:", e);
        }
    }

    initPresets() {
        this.presetsBtn = document.getElementById('presets-btn');
        this.presetsPopup = document.getElementById('presets-popup');
        this.actionPopup = document.getElementById('action-popup');
        this.toolsPopup = document.getElementById('tools-popup');

        if (this.presetsBtn) {
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
        }

        if (document.getElementById('open-presets-btn')) {
            document.getElementById('open-presets-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.actionPopup.classList.add('hidden');
                this.presetsPopup.classList.remove('hidden');
            });
        }

        if (document.getElementById('open-tools-btn')) {
            document.getElementById('open-tools-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.actionPopup.classList.add('hidden');
                this.toolsPopup.classList.remove('hidden');
            });
        }

        if (document.getElementById('tool-clean-memory')) {
            document.getElementById('tool-clean-memory').addEventListener('click', async (e) => {
                e.stopPropagation();
                this.toolsPopup.classList.add('hidden');
                
                this.showBubble("正在深度清理内存中...", -1);
                try {
                    const cleanRes = await fetch('/api/clean_memory', { method: 'POST' });
                    const cleanData = await cleanRes.json();
                    
                    if (cleanData.success) {
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
        
        if (document.getElementById('tool-read-process')) {
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

        if (this.presetsPopup) {
            const items = this.presetsPopup.querySelectorAll('.preset-item');
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    const text = item.getAttribute('data-text');
                    if (this.input) this.input.value = text;
                    this.sendMessage();
                    this.presetsPopup.classList.add('hidden');
                });
            });
        }

        document.addEventListener('click', (e) => {
            if (this.presetsBtn && this.presetsBtn.contains(e.target)) return;
            if (this.actionPopup && !this.actionPopup.contains(e.target)) this.actionPopup.classList.add('hidden');
            if (this.presetsPopup && !this.presetsPopup.contains(e.target)) this.presetsPopup.classList.add('hidden');
            if (this.toolsPopup && !this.toolsPopup.contains(e.target)) this.toolsPopup.classList.add('hidden');
        });
    }

    /**
     * 初始化即时无级缩放与重置快捷键 (Alt + 滚轮 / Alt + 0 / Ctrl + 0)
     */
    setupScaleInteraction() {
        this.scaleHud = document.getElementById('scale-hud');
        this.scaleHudText = document.getElementById('scale-hud-text');
        this.scaleHudTimer = null;
        this.scaleSaveTimer = null;

        // 1. 鼠标滚轮即时缩放 (Alt + 滚轮 或 Ctrl+Shift+滚轮)
        window.addEventListener('wheel', (e) => {
            if (e.altKey || (e.ctrlKey && e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();

                const delta = e.deltaY < 0 ? 0.05 : -0.05;
                let currentScale = (this.spriteType === 'live2d') ? (this.live2dScale || 1.0) : (this.spriteScale || 1.0);
                let newScale = Math.round((currentScale + delta) * 100) / 100;
                newScale = Math.max(0.3, Math.min(2.5, newScale));

                this.applyPetScale(newScale);
                this.showScaleHud(`🔍 缩放: ${Math.round(newScale * 100)}%`);
                this.debounceSaveScale(newScale);
            }
        }, { passive: false, capture: true });

        // 2. 快捷键重置 (Alt + 0 / Ctrl + 0)
        window.addEventListener('keydown', (e) => {
            if ((e.altKey || e.ctrlKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
                e.preventDefault();
                const resetScale = 1.0;
                this.applyPetScale(resetScale);
                this.showScaleHud(`🔍 缩放: 100% (已复原)`);
                this.debounceSaveScale(resetScale);
            }
        }, { capture: true });
    }

    /**
     * 即时应用新缩放比例至 Live2D 引擎或立绘 DOM
     */
    applyPetScale(scale) {
        if (this.spriteType === 'live2d' && window.SoullinkLive2D) {
            this.live2dScale = scale;
            window.SoullinkLive2D.setTransform(this.live2dScale, this.live2dOffsetX || 0.0, this.live2dOffsetY || 0.0);
        } else if (this.img) {
            this.spriteScale = scale;
            this.img.style.transform = `scale(${scale})`;
            this.img.style.transformOrigin = 'bottom center';
        }
    }

    /**
     * 弹出毛玻璃百分比 HUD 胶囊提示，1.2 秒后平滑淡出
     */
    showScaleHud(text) {
        if (!this.scaleHud) return;
        if (this.scaleHudText) {
            this.scaleHudText.innerText = text;
        }
        this.scaleHud.classList.remove('hidden');
        if (this.scaleHudTimer) clearTimeout(this.scaleHudTimer);
        this.scaleHudTimer = setTimeout(() => {
            this.scaleHud.classList.add('hidden');
        }, 1200);
    }

    /**
     * 600ms 防抖自动将新尺寸持久化保存到当前角色立绘配置
     */
    debounceSaveScale(scale) {
        if (this.scaleSaveTimer) clearTimeout(this.scaleSaveTimer);
        this.scaleSaveTimer = setTimeout(async () => {
            try {
                const setName = this.activeSpriteSet || 'main_sprites';
                await fetch('/api/sprites/live2d_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        set_name: setName,
                        scale: scale,
                        offset_x: this.live2dOffsetX || 0.0,
                        offset_y: this.live2dOffsetY || 0.0
                    })
                });
            } catch (err) {
                console.warn('[PET SCALE] 保存缩放配置异常:', err);
            }
        }, 600);
    }
}

window.DesktopPetCore = DesktopPetCore;
window.DesktopPet = DesktopPetCore; // 向后兼容
