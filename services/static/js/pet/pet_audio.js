/**
 * Desktop Pet - Audio Subsystem (BGM & TTS Driver)
 * 职责：负责背景音乐的平滑淡入淡出（Audio Fade）、TTS 语音流式播放与异步点播、音频状态联动
 */

class PetAudioController {
    constructor(petCore) {
        this.petCore = petCore;
        this.bgmAudio = null;
        this.bgmFadeInterval = null;
        this.currentBgmUrl = '';
        
        this.ttsAudio = new Audio();
        this.ttsBtn = document.getElementById('bubble-tts-btn');
        this.isTtsLoading = false;

        this.initEventListeners();
    }

    initEventListeners() {
        // BGM 开关按钮
        const bgmToggleBtn = document.getElementById('immersive-bgm-toggle-btn');
        if (bgmToggleBtn) {
            bgmToggleBtn.addEventListener('click', () => this.toggleBGM());
        }

        // 气泡 TTS 点播按钮
        if (this.ttsBtn) {
            this.ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleTtsSpeak();
            });
        }

        // TTS 播放事件监听
        this.ttsAudio.addEventListener('ended', () => this.resetTtsButtonState());
        this.ttsAudio.addEventListener('pause', () => this.resetTtsButtonState());
        this.ttsAudio.addEventListener('error', (e) => {
            console.error("[TTS AUDIO ERROR]", e);
            this.resetTtsButtonState();
        });
    }

    resetTtsButtonState() {
        if (this.ttsBtn) {
            this.ttsBtn.classList.remove('loading', 'playing');
            this.ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    // ==========================================
    // BGM 背景音乐管理 (Audio Fade Engine)
    // ==========================================

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
            console.log("[BGM PLAY EX]", err);
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

    // ==========================================
    // TTS 语音合成与流式驱动 (Speech Driver)
    // ==========================================

    handleAutoTtsPlay(audioUrl) {
        if (!audioUrl || this.petCore?.enableTts === false) return;
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

    async requestAsyncTts(text, emotion) {
        if (!text || this.petCore?.enableTts === false) return;
        const isAutoSpeak = this.petCore?.enableTtsAuto || this.petCore?.ttsSpeakMode === "auto";
        if (!isAutoSpeak) return;
        try {
            const resp = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    text: text,
                    emotion: emotion || 'normal',
                    character_id: this.petCore?.characterId
                })
            });
            const d = await resp.json();
            if (d.success && d.audio_url) {
                this.handleAutoTtsPlay(d.audio_url);
            }
        } catch (e) {
            console.log("[ASYNC-TTS EX]", e);
        }
    }

    async handleTtsSpeak() {
        if (!this.petCore) return;
        const currentText = this.petCore.currentSpeechText || (this.petCore.bubbleContent ? this.petCore.bubbleContent.innerText : "");
        if (!currentText || currentText === '...' || currentText.startsWith('hmm...')) return;

        if (this.ttsAudio && !this.ttsAudio.paused) {
            this.ttsAudio.pause();
            this.ttsAudio.currentTime = 0;
            this.resetTtsButtonState();
            return;
        }

        if (this.isTtsLoading) return;
        this.isTtsLoading = true;

        if (this.ttsBtn) {
            this.ttsBtn.classList.add('loading');
            this.ttsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            const response = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: currentText,
                    character_id: this.petCore.characterId,
                    emotion: this.petCore.currentEmotion || 'normal'
                })
            });
            const data = await response.json();
            if (data.success && data.audio_url) {
                this.ttsAudio.src = data.audio_url;
                this.ttsAudio.play().then(() => {
                    if (this.ttsBtn) {
                        this.ttsBtn.classList.remove('loading');
                        this.ttsBtn.classList.add('playing');
                        this.ttsBtn.innerHTML = '<i class="fas fa-volume-high"></i>';
                    }
                }).catch(err => {
                    console.error("[TTS PLAY EX]", err);
                    this.resetTtsButtonState();
                });
            } else {
                console.error("[TTS SERVER ERROR]", data.error);
                this.resetTtsButtonState();
            }
        } catch (err) {
            console.error("[TTS FETCH EX]", err);
            this.resetTtsButtonState();
        } finally {
            this.isTtsLoading = false;
        }
    }
}

window.PetAudioController = PetAudioController;
