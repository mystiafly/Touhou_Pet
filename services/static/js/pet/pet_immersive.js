/**
 * Desktop Pet - Immersive Engine (Visual Media & Particle System)
 * 职责：全屏沉浸模式多媒体管理（壁纸/视频/网页）、Canvas 粒子物理系统（星光/流星/视差）、实时时钟、一键截图、悬浮对话记录
 */

class PetImmersiveEngine {
    constructor(petCore, audioController) {
        this.petCore = petCore;
        this.audio = audioController;

        this.isImmersiveMode = false;
        this.immersiveWallpaper = document.getElementById('immersive-wallpaper');
        this.immersiveVideo = document.getElementById('immersive-video-wallpaper');
        this.immersiveWeb = document.getElementById('immersive-web-wallpaper');
        this.immersiveClockContainer = document.getElementById('immersive-clock-container');
        this.immersiveClockTime = document.getElementById('immersive-clock-time');
        this.immersiveClockDate = document.getElementById('immersive-clock-date');
        this.immersiveChatHistory = document.getElementById('immersive-chat-history');
        this.immersiveChatPanel = document.getElementById('immersive-chat-panel');
        this.toggleChatBtn = document.getElementById('toggle-immersive-chat-btn');
        this.chatTrigger = document.getElementById('immersive-chat-trigger');

        this.clockInterval = null;
        this.particleAnimFrame = null;
        this.parallaxAnimFrame = null;
        this.parallaxMouseMoveHandler = null;
        this.activeParallaxBgElement = null;

        this.initEventListeners();
    }

    initEventListeners() {
        // 沉浸模式侧边栏折叠/展开按钮
        if (this.toggleChatBtn && this.immersiveChatPanel && this.chatTrigger) {
            this.toggleChatBtn.addEventListener('click', () => {
                this.immersiveChatPanel.classList.add('hidden');
                this.chatTrigger.classList.remove('hidden');
                const container = document.querySelector('.pet-container');
                if (container) container.classList.add('chat-collapsed');
            });

            this.chatTrigger.addEventListener('click', () => {
                this.chatTrigger.classList.add('hidden');
                this.immersiveChatPanel.classList.remove('hidden');
                const container = document.querySelector('.pet-container');
                if (container) container.classList.remove('chat-collapsed');
            });
        }

        // 截图按钮
        const screenshotBtn = document.getElementById('immersive-screenshot-btn');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => this.takeImmersiveScreenshot());
        }

        // 快捷键监听：ESC 退出，P / F12 / PrintScreen 截图
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

        // 监听 Electron 主进程沉浸模式事件
        if (window.__petIPC && typeof window.__petIPC.onImmersiveModeState === 'function') {
            window.__petIPC.onImmersiveModeState((state) => {
                if (!state && this.isImmersiveMode) {
                    this.exitImmersiveMode(false);
                }
            });
        }
    }

    async enterImmersiveMode() {
        if (this.isImmersiveMode) return;
        this.isImmersiveMode = true;
        this.petCore?.closeSettingsModal();

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
            if (data.wallpaper_url) this.petCore.wallpaperUrl = data.wallpaper_url;
            if (data.wallpaper_fit) this.petCore.wallpaperFit = data.wallpaper_fit;
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
                    if (data.enable_immersive_screenshot_btn) screenshotBtn.classList.remove('hidden');
                    else screenshotBtn.classList.add('hidden');
                }
            }
        } catch (e) {
            console.error("更新沉浸壁纸配置失败:", e);
        }

        if (this.audio) {
            this.audio.currentBgmUrl = bgmUrl;
        }

        const container = document.querySelector('.pet-container');
        if (container) {
            container.classList.add('immersive-mode');
        }

        // 停止上一次残留的特效与监听
        this.stopImmersiveEffects();

        // 隐藏所有壁纸组件
        if (this.immersiveWallpaper) this.immersiveWallpaper.classList.add('hidden');
        if (this.immersiveVideo) {
            this.immersiveVideo.classList.add('hidden');
            this.immersiveVideo.pause();
        }
        if (this.immersiveWeb) this.immersiveWeb.classList.add('hidden');

        const fitMode = this.petCore?.wallpaperFit || 'contain';
        let activeBgElement = null;

        if (bgMode === 'we_native' || bgMode === 'transparent') {
            fetch('/api/wallpaper_engine/set_clean_desktop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hide_icons: true })
            }).catch(e => console.log(e));
        } else if (bgMode === 'scene_extracted') {
            if (this.immersiveWallpaper) {
                this.immersiveWallpaper.classList.remove('hidden');
                this.immersiveWallpaper.style.backgroundSize = fitMode;
                this.immersiveWallpaper.style.backgroundPosition = 'center';
                this.immersiveWallpaper.style.backgroundRepeat = 'no-repeat';
                this.immersiveWallpaper.style.backgroundImage = `url('${this.petCore?.wallpaperUrl || ''}')`;
                activeBgElement = this.immersiveWallpaper;
            }
            enableStarlight = true;
            enableMeteors = true;
        } else if (bgMode === 'video' && (mediaUrl || this.petCore?.wallpaperUrl)) {
            if (this.immersiveVideo) {
                this.immersiveVideo.classList.remove('hidden');
                this.immersiveVideo.src = mediaUrl || this.petCore?.wallpaperUrl;
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
            if (this.immersiveWallpaper) {
                this.immersiveWallpaper.classList.remove('hidden');
                this.immersiveWallpaper.style.backgroundSize = fitMode;
                this.immersiveWallpaper.style.backgroundPosition = 'center';
                this.immersiveWallpaper.style.backgroundRepeat = 'no-repeat';
                if (this.petCore?.wallpaperUrl) {
                    this.immersiveWallpaper.style.backgroundImage = `url('${this.petCore.wallpaperUrl}')`;
                } else {
                    this.immersiveWallpaper.style.backgroundImage = `linear-gradient(135deg, #1e1e2e, #282a36, #44475a)`;
                }
                activeBgElement = this.immersiveWallpaper;
            }
        }

        // 装载沉浸模式独立视觉特效 (星光、流星、视差)
        this.startImmersiveEffects(enableStarlight, enableMeteors, enableParallax, activeBgElement);

        // BGM 播放
        if (this.audio) {
            if (bgmUrl && enableBgm) this.audio.fadePlayBGM(bgmUrl);
            else this.audio.updateBGMButtonState(false);
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

        // 重新刷新立绘清晰度
        if (this.petCore?.img) {
            const targetEmotion = this.petCore.currentEmotion || 'normal';
            const list = this.petCore.images[targetEmotion] || this.petCore.images['normal'];
            if (list && list.length > 0) {
                const targetSrc = list[Math.floor(Math.random() * list.length)];
                const separator = targetSrc.includes('?') ? '&' : '?';
                this.petCore.img.src = targetSrc + separator + '_imm=1&t=' + Date.now();
            }
        }

        // 通知 Electron 全屏
        if (window.__petIPC && typeof window.__petIPC.sendEnterImmersiveMode === 'function') {
            window.__petIPC.sendEnterImmersiveMode();
        }
    }

    exitImmersiveMode(notifyIPC = true) {
        if (!this.isImmersiveMode) return;
        this.isImmersiveMode = false;

        const container = document.querySelector('.pet-container');
        if (container) {
            container.classList.remove('immersive-mode', 'chat-collapsed');
        }

        this.stopImmersiveEffects();

        if (this.immersiveWallpaper) this.immersiveWallpaper.classList.add('hidden');
        if (this.immersiveVideo) {
            this.immersiveVideo.classList.add('hidden');
            this.immersiveVideo.pause();
            this.immersiveVideo.src = '';
        }
        if (this.immersiveWeb) {
            this.immersiveWeb.classList.add('hidden');
            this.immersiveWeb.src = '';
        }
        if (this.immersiveClockContainer) {
            this.immersiveClockContainer.classList.add('hidden');
            if (this.clockInterval) {
                clearInterval(this.clockInterval);
                this.clockInterval = null;
            }
        }

        if (this.audio) {
            this.audio.fadeStopBGM();
        }

        if (this.immersiveChatPanel) {
            this.immersiveChatPanel.classList.add('hidden');
        }
        if (this.chatTrigger) {
            this.chatTrigger.classList.add('hidden');
        }

        // 恢复桌面图标
        fetch('/api/wallpaper_engine/set_clean_desktop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hide_icons: false })
        }).catch(e => console.log(e));

        if (notifyIPC && window.__petIPC && typeof window.__petIPC.sendExitImmersiveMode === 'function') {
            window.__petIPC.sendExitImmersiveMode();
        }
    }

    startImmersiveEffects(enableStarlight, enableMeteors, enableParallax, activeBgElement) {
        this.stopImmersiveEffects();

        const canvas = document.getElementById('immersive-particle-canvas');
        if (canvas && (enableStarlight || enableMeteors)) {
            canvas.classList.remove('hidden');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');

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

        // 鼠标视差移动
        if (enableParallax && activeBgElement) {
            this.activeParallaxBgElement = activeBgElement;
            this.parallaxTargetX = 0;
            this.parallaxTargetY = 0;
            this.parallaxCurrentX = 0;
            this.parallaxCurrentY = 0;
            activeBgElement.style.transformOrigin = 'center center';

            this.parallaxMouseMoveHandler = (e) => {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const normX = (e.clientX - centerX) / centerX;
                const normY = (e.clientY - centerY) / centerY;
                this.parallaxTargetX = -normX * 24;
                this.parallaxTargetY = -normY * 24;
            };

            window.addEventListener('mousemove', this.parallaxMouseMoveHandler);

            const animateParallax = () => {
                if (!this.isImmersiveMode || !this.activeParallaxBgElement) return;
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

        const flash = document.getElementById('immersive-flash-overlay');
        if (flash) {
            flash.classList.remove('hidden');
            flash.classList.add('active');
            setTimeout(() => {
                flash.classList.remove('active');
                setTimeout(() => flash.classList.add('hidden'), 150);
            }, 100);
        }

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
}

window.PetImmersiveEngine = PetImmersiveEngine;
