class RumiaPet {
    constructor() {
        this.input = document.getElementById('pet-input');
        this.bubble = document.getElementById('speech-bubble');
        this.bubbleContent = document.getElementById('bubble-content');
        this.img = document.getElementById('rumia-img');
        this.favScore = document.getElementById('fav-score');
        this.favContainer = document.getElementById('fav-container');





        // [淇敼] 鍗囩骇涓烘暟缁勬槧灏勶紝姣忕鎯呯华鍖呭惈 3 寮犲樊鍒嗗浘
        this.images = {
            'normal': [
                '/static/images/rumia_normal.png',
                '/static/images/rumia_normal_1.png',
                '/static/images/rumia_normal_2.png'
            ],
            'angry': [
                '/static/images/rumia_angry.png',
                '/static/images/rumia_angry_1.png',
                '/static/images/rumia_angry_2.png'
            ],
            'shy': [
                '/static/images/rumia_shy.png',
                '/static/images/rumia_shy_1.png',
                '/static/images/rumia_shy_2.png'
            ],
            'crying': [
                '/static/images/rumia_crying.png',
                '/static/images/rumia_crying_1.png',
                '/static/images/rumia_crying_2.png'
            ],
            'sleeping': [
                '/static/images/rumia_sleeping.png',
                '/static/images/rumia_sleeping_1.png',
                '/static/images/rumia_sleeping_2.png'
            ]
        };

        // [鏂板] 棰勫姞杞藉浘鐗?(闃叉鍒囨崲鏃堕棯鐑?
        this.preloadImages();

        this.currentChatLog = "";
        this.currentRumiaDiary = "";
        this.activeLogTab = "chat"; // 'chat' 鎴?'diary'
        this.isSleeping = false;
        this.sleepTimer = null;

        // [鏂板] 缃戞槗浜戦煶涔愬師鐢熸挱鏀惧櫒鎺у埗涓庣姸鎬佺粦瀹?
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

        this.init();
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

        // 鐐瑰嚮韬綋浜掑姩 (濡傛灉姝ｅ湪鐫¤鍒欏敜閱?
        this.img.addEventListener('click', () => {
            if (this.isSleeping) {
                this.wakeUp(false);
            }
        });

        this.loadStatus();

        // [IPC] 动态穿透切换与JS拖拽窗口 — 优先使用 preload.js 注入的 IPC 桥，降级时回退至 window.require('electron')
        const rumiaIPC = window.__rumiaIPC || (() => {
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
        if (rumiaIPC) {
            let isDragging = false;
            let startX = 0, startY = 0;

            // mousedown handler
            this.img.addEventListener('mousedown', (e) => {
                if (this.isSleeping) {
                    this.wakeUp(false);
                }
                if (e.button === 0) { 
                    isDragging = true;
                    startX = e.screenX;
                    startY = e.screenY;
                    rumiaIPC.sendSetIgnoreMouseEvents(false);
                    this.img.style.cursor = 'grabbing';
                }
            });

            this.img.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });

            // mousemove handler
            window.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.screenX - startX;
                    const deltaY = e.screenY - startY;
                    startX = e.screenX;
                    startY = e.screenY;
                    rumiaIPC.sendWindowDrag(deltaX, deltaY);
                } else {
                    let isInteractive = false;
                    const el = e.target;
                    
                    if (el && typeof el.closest === 'function') {
                        if (
                            el.id === 'rumia-img' ||
                            el.closest('.input-bar') ||
                            el.closest('.music-player-bar') ||
                            el.closest('.settings-content') ||
                            el.closest('.fav-container') ||
                            (el.closest('#speech-bubble') && this.bubble && this.bubble.style.opacity === '1') ||
                            (this.settingsModal && el.closest('#settings-modal') && !this.settingsModal.classList.contains('hidden'))
                        ) {
                            isInteractive = true;
                        }
                    }
                    
                    if (isInteractive) {
                        rumiaIPC.sendSetIgnoreMouseEvents(false);
                    } else {
                        rumiaIPC.sendSetIgnoreMouseEvents(true, { forward: true });
                    }
                }
            });

            // 鍏ㄥ眬鐩戝惉 mouseup 鍋滄鎷栧姩
            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.img.style.cursor = 'grab';
                }
            });
        }

        setTimeout(() => this.greetUser(), 500);
    }

    initSettings() {
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.exitGameBtn = document.getElementById('exit-game-btn');
        this.apiSelect = document.getElementById('api-provider-select');

        // [鏂板] 鏃ュ織涓庡ぇ鑴戝紩鎿庢煡鐪嬮潰鏉?DOM 寮曠敤
        this.settingsContent = this.settingsModal.querySelector('.settings-content');
        this.mainView = document.getElementById('settings-main-view');
        this.engineView = document.getElementById('settings-engine-view');
        this.logsView = document.getElementById('settings-logs-view');
        this.graphView = document.getElementById('settings-graph-view'); // [鏂板]
        
        this.openEngineBtn = document.getElementById('open-engine-btn');
        this.backEngineBtn = document.getElementById('back-engine-btn');
        this.openLogsBtn = document.getElementById('open-logs-btn');
        this.backSettingsBtn = document.getElementById('back-settings-btn');
        this.logDateSelect = document.getElementById('log-date-select');
        this.logContentArea = document.getElementById('log-content-area');

        // [鏂板] 鏃ヨ瀛愭爣绛鹃〉 DOM 寮曠敤
        this.subtabChat = document.getElementById('subtab-chat');
        this.subtabDiary = document.getElementById('subtab-diary');
        
        this.openGraphBtn = document.getElementById('open-graph-btn'); // [鏂板]
        this.backGraphBtn = document.getElementById('back-graph-btn'); // [鏂板]
        this.manualDistillBtn = document.getElementById('manual-distill-btn'); // [鏂板]
        this.seedTestBtn = document.getElementById('seed-test-btn'); // [鏂板]
        this.rewriteDiaryBtn = document.getElementById('rewrite-diary-btn'); // [鏂板]

        // 鎵撳紑鑿滃崟
        this.settingsBtn.addEventListener('click', async () => {
            this.settingsModal.classList.remove('hidden');
            await this.loadConfig();
        });

        // 鍏抽棴鑿滃崟
        this.closeSettingsBtn.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // 鐐瑰嚮鑳屾櫙鍏抽棴
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettingsModal();
            }
        });

        // 鐩戝惉寮曟搸鍒囨崲浜嬩欢
        this.apiSelect.addEventListener('change', () => this.saveConfig());

        // 閫€鍑烘父鎴?
        this.exitGameBtn.addEventListener('click', () => this.exitGame());

        // [鏂板] 鍒囨崲鍒板ぇ鑴戝紩鎿庨潰鏉?
        this.openEngineBtn.addEventListener('click', () => {
            this.mainView.classList.add('hidden');
            this.engineView.classList.remove('hidden');
        });

        // [鏂板] 杩斿洖涓昏缃潰鏉?(澶ц剳寮曟搸)
        this.backEngineBtn.addEventListener('click', () => {
            this.engineView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
        });

        // [鏂板] 鍒囨崲鍒版棩蹇楅潰鏉?
        this.openLogsBtn.addEventListener('click', () => {
            this.mainView.classList.add('hidden');
            this.logsView.classList.remove('hidden');
            this.settingsContent.classList.add('wide');
            this.loadLogsList();
        });

        // [鏂板] 杩斿洖涓昏缃潰鏉?(鏃ヨ)
        this.backSettingsBtn.addEventListener('click', () => {
            this.logsView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
            this.settingsContent.classList.remove('wide');
        });

        // [鏂板] 鍒囨崲鍒板浘璋遍潰鏉?
        this.openGraphBtn.addEventListener('click', () => {
            this.mainView.classList.add('hidden');
            this.graphView.classList.remove('hidden');
            this.settingsContent.classList.add('wide');
            this.loadMemoryGraph();
        });

        // [鏂板] 杩斿洖涓昏缃潰鏉?(鍥捐氨)
        this.backGraphBtn.addEventListener('click', () => {
            this.graphView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
            this.settingsContent.classList.remove('wide');
        });



        // [鏂板] 鎵嬪姩鏁寸悊涓庢祴璇曟敞鍏ヤ簨浠剁洃鍚?
        this.manualDistillBtn.addEventListener('click', () => this.manualDistill(false));
        this.seedTestBtn.addEventListener('click', () => this.manualDistill(true));

        // [鏂板] 鏃ユ湡閫夋嫨鍒囨崲
        this.logDateSelect.addEventListener('change', () => {
            this.loadLogContent();
        });

        // [鏂板] 鍒囨崲瀛愰€夐」鍗′簨浠剁粦瀹?
        if (this.subtabChat) {
            this.subtabChat.addEventListener('click', () => this.switchLogTab('chat'));
        }
        if (this.subtabDiary) {
            this.subtabDiary.addEventListener('click', () => this.switchLogTab('diary'));
        }
        if (this.rewriteDiaryBtn) {
            this.rewriteDiaryBtn.addEventListener('click', () => this.rewriteDiary());
        }
    }

    // [鏂板] 杈呭姪鍏抽棴鏂规硶锛岀敤浜庨噸缃姸鎬?
    closeSettingsModal() {
        this.settingsModal.classList.add('hidden');
        // 閲嶇疆瑙嗗浘鍥炰富鐣岄潰锛岄槻姝笅娆＄偣寮€鏄ぇ妗?
        setTimeout(() => {
            this.logsView.classList.add('hidden');
            this.engineView.classList.add('hidden');
            this.graphView.classList.add('hidden'); // [鏂板]
            this.mainView.classList.remove('hidden');
            this.settingsContent.classList.remove('wide');
            this.logDateSelect.innerHTML = '<option value="">暂无记录...</option>';
            this.logContentArea.innerText = '请选择一个日期来查阅你和露米娅的聊天回忆...';
            if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            
            // [鏂板] 閲嶇疆鏃ュ織瀛愰€夐」鍗＄姸鎬?
            this.activeLogTab = "chat";
            this.currentChatLog = "";
            this.currentRumiaDiary = "";
            if (this.subtabChat) {
                this.subtabChat.classList.add('active');
            }
            if (this.subtabDiary) {
                this.subtabDiary.classList.remove('active');
            }

            // [鏂板] 閿€姣佸浘璋?
            if (this.network) {
                this.network.destroy();
                this.network = null;
            }
            const infoCard = document.getElementById('graph-info-card');
            if (infoCard) infoCard.classList.add('hidden');
        }, 300);
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
                this.logContentArea.innerText = '还没有任何每日回忆记录哦，快去和露米娅多聊聊天吧！';
            }
        } catch (e) {
            console.error("鍔犺浇鏃ュ織鍒楄〃澶辫触:", e);
            this.logDateSelect.innerHTML = '<option value="">加载失败</option>';
        }
    }

    // [鏂板] 鍔犺浇骞舵覆鏌撶壒瀹氭棩鏈熺殑鏃ュ織鍐呭
    async loadLogContent() {
        const val = this.logDateSelect.value;
        if (!val) {
            this.logContentArea.innerText = '请选择一个日期来查阅你和露米娅的聊天回忆...';
            if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            return;
        }

        this.logContentArea.innerText = '正在读取回忆中...';
        try {
            const response = await fetch(`/api/settings/logs/${val}`);
            const data = await response.json();
            if (data.success) {
                this.currentChatLog = data.chat_content || "";
                this.currentRumiaDiary = data.diary_content || "";
                // 姣忔鍒囨崲鏂版棩鏈熸椂锛岄粯璁ゆ樉绀鸿亰澶╄褰曞瓙閫夐」鍗?
                this.switchLogTab('chat');
                if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'inline-block';
            } else {
                this.logContentArea.innerText = `读取回忆失败: ${data.error || '未知错误'}`;
                this.currentChatLog = "";
                this.currentRumiaDiary = "";
                if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            }
        } catch (e) {
            console.error("加载日志内容失败:", e);
            this.logContentArea.innerText = '加载回忆失败，请稍后重试。';
            this.currentChatLog = "";
            if (this.rewriteDiaryBtn) this.rewriteDiaryBtn.style.display = 'none';
            this.currentRumiaDiary = "";
        }
    }

    // [鏂板] 閲嶆柊鎵撳寘瀵硅瘽骞惰闇茬背濞呴噸鍐欎粖鏃ユ棩璁?
    async rewriteDiary() {
        const val = this.logDateSelect.value;
        if (!val) return;

        if (!confirm(`确定要让露米娅重新读一遍 ${val} 的对话并重写这天的日记吗？\n(这会消耗API token并需要几秒钟)`)) return;

        this.rewriteDiaryBtn.disabled = true;
        const originalText = this.rewriteDiaryBtn.innerHTML;
        this.rewriteDiaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在重写...';
        
        // 涓存椂灏嗘棩璁板唴瀹规浛鎹负鍔犺浇鎻愮ず骞跺垏鍒版棩璁伴€夐」鍗?
        this.currentRumiaDiary = "露米娅正在埋头回忆这天的相处，努力重写日记中，这需要几秒钟时间，请稍候...哼！";
        this.switchLogTab('diary');

        try {
            const response = await fetch(`/api/settings/logs/${val}/rewrite`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                this.currentRumiaDiary = data.diary_content || "";
                this.switchLogTab('diary');
                this.showBubble("这天的日记我已经重新写好啦！哼，这次写的可真了，快看看！", 3500);
            } else {
                alert(`重写日记失败: ${data.error || '未知错误'}`);
                this.currentRumiaDiary = "重写日记失败了...呜呜。";
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
                this.logContentArea.innerText = this.currentChatLog || "今天没有聊天对话记录哦。";
                
                // 滚动到底部，方便查看当天的最新聊天
                setTimeout(() => {
                    const wrapper = this.logContentArea.parentElement;
                    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
                }, 50);
            } else {
                this.subtabChat.classList.remove('active');
                this.subtabDiary.classList.add('active');
                this.logContentArea.innerText = this.currentRumiaDiary || "今天露米娅没有写日记哦……呜，肯定是怪你没有好好理她！";
                
                // 日记从头阅读，重置滚动位置为0
                setTimeout(() => {
                    const wrapper = this.logContentArea.parentElement;
                    if (wrapper) wrapper.scrollTop = 0;
                }, 50);
            }
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/settings/config');
            const data = await response.json();
            if (data.success) {
                this.apiSelect.value = data.api_provider;
                
                // 鍔ㄦ€佺粰涓嬫媺妗嗘坊鍔犲瘑閽ヨ鏄?
                const geminiOption = this.apiSelect.querySelector('option[value="gemini"]');
                const dsFlashOption = this.apiSelect.querySelector('option[value="deepseek-v4-flash"]');
                const dsProOption = this.apiSelect.querySelector('option[value="deepseek-v4-pro"]');
                const dsChatOption = this.apiSelect.querySelector('option[value="deepseek-chat"]');
                
                if (geminiOption) {
                    geminiOption.innerText = data.has_gemini ? "Gemini 2.5 (检测到 Key)" : "Gemini 2.5 (未检测到 Key)";
                }
                if (dsFlashOption) {
                    dsFlashOption.innerText = data.has_deepseek ? "DeepSeek V4 Flash (检测到 Key)" : "DeepSeek V4 Flash (未检测到 Key)";
                }
                if (dsProOption) {
                    dsProOption.innerText = data.has_deepseek ? "DeepSeek V4 Pro (检测到 Key)" : "DeepSeek V4 Pro (未检测到 Key)";
                }
                if (dsChatOption) {
                    dsChatOption.innerText = data.has_deepseek ? "DeepSeek V3 标准版 (检测到 Key)" : "DeepSeek V3 标准版 (未检测到 Key)";
                }
            }
        } catch (e) {
            console.error("鍔犺浇閰嶇疆澶辫触:", e);
        }
    }

    async saveConfig() {
        const val = this.apiSelect.value;
        try {
            const response = await fetch('/api/settings/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ api_provider: val })
            });
            const data = await response.json();
            if (data.success) {
                this.showBubble(`我的大脑已成功切换为 ${val.toUpperCase()} 引擎！`, 2000);
            }
        } catch (e) {
            console.error("淇濆瓨閰嶇疆澶辫触:", e);
            this.showBubble("切换引擎失败...", 2000);
        }
    }

    async exitGame() {
        if (!confirm("要让露米娅去睡觉吗？")) return;

        this.showBubble("那...晚安啦...", 2000);
        this.setEmotion('normal'); // 鎴栬€?sleeping 鍥?
        this.settingsModal.classList.add('hidden');

        try {
            const response = await fetch('/api/settings/exit', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                // 鍚庣浼氬湪1绉掑悗鑷潃锛屽墠绔彲浠ュ皾璇曞叧闂獥鍙?
                setTimeout(() => {
                    window.close(); // 尝试关闭浏览器窗口
                }, 1000);
            }
        } catch (e) {
            console.error("閫€鍑哄け璐?", e);
            // 濡傛灉鍚庣宸茬粡姝讳簡锛宖etch 鍙兘浼氭姤閿欙紝杩欎篃绠楁垚鍔熼€€鍑轰簡
            setTimeout(() => window.close(), 1000);
        }
    }
    // [淇敼] 鍒囨崲琛ㄦ儏鐨勬牳蹇冨嚱鏁帮紙鍦?寮犲樊鍒嗕腑闅忔満閫夋嫨涓€涓級
    setEmotion(emotion) {
        const list = this.images[emotion] || this.images['normal'];
        const targetSrc = list[Math.floor(Math.random() * list.length)];

        // 濡傛灉褰撳墠宸茬粡鏄繖寮犲浘锛屽氨涓嶆搷浣滀簡锛岄伩鍏嶉棯鐑?
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
            console.log(`[MUSIC CONTROLLER] 鎷︽埅鍒板ぇ妯″瀷鐐规瓕鎸囦护: ${musicQuery}`);
            this.searchAndPlayMusic(musicQuery);
        }

        this.bubbleContent.innerText = text;
        this.bubbleContent.scrollTop = 0; // 閲嶇疆鏂囧瓧妗嗘粴鍔ㄦ潯浣嶇疆鍒伴《閮紝闃叉涓婁竴鏉¤秴闀挎枃鏈畫鐣欐粴鍔ㄦ潯
        this.bubble.style.opacity = '1';
        this.bubble.style.pointerEvents = 'auto'; // 璇磋瘽鏃跺惎鐢ㄩ紶鏍囦氦浜掞紙鍏佽婊氬姩銆侀€夋嫨鏂囨湰锛?

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);

        // [鏂板] 鏅鸿兘鏃堕暱璁＄畻閫昏緫
        let showTime = duration;
        if (!showTime) {
            // 鍩虹鏃堕棿 3绉?+ 姣忎釜瀛?0.3绉?
            // 渚嬪锛?0涓瓧 = 3+3 = 6绉?
            // 50涓瓧 = 3+15 = 18绉?
            const calcTime = 3000 + (text.length * 300);

            // 闄愬埗鏈€闀夸笉瓒呰繃 30绉?(闃叉鏄剧ず澶箙鎸¤矾)
            showTime = Math.min(calcTime, 30000);
        }

        console.log(`姘旀场鏄剧ず鏃堕暱: ${showTime/1000}绉?(瀛楁暟: ${text.length})`);

        this.bubbleTimer = setTimeout(() => {
            this.bubble.style.opacity = '0';
            this.bubble.style.pointerEvents = 'none'; // 闅愯棌鏃跺畬鍏ㄧ┛閫忛紶鏍囷紝闃叉鎸′綇鍚庨潰鐨勪笢瑗?
        }, showTime);
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';
        this.autoSpeakCount = 0;
        this.wakeUp(true); // 闈欓粯鍞ら啋 (鎺ヤ笅鏉ョ殑澶фā鍨嬪洖澶嶄細灞曠ず琛ㄦ儏涓庢皵娉?
        this.resetAutoSpeakTimer();

        this.showBubble("hmm...");

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
                    console.log(`[MUSIC PLAYER] 鎺ユ敹鍒?ReAct 鐐规瓕鏁版嵁:`, data.music_play);
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
            this.showBubble("听不到... (网络错误)");
            this.setEmotion('crying');
        }
    }

    resetAutoSpeakTimer() {
        if (this.autoSpeakTimer) clearTimeout(this.autoSpeakTimer);
        if (this.autoSpeakCount >= 6) {
            this.scheduleSleepTimer();
            return;
        }

        // 鏃堕棿璁剧疆 (鍗曚綅: 姣)
        // 绗竴闃舵锛?-3娆★級锛?-15鍒嗛挓锛岀浜岄樁娈碉紙4-6娆★級锛?0-40鍒嗛挓
        let minTime = (this.autoSpeakCount < 3) ? 8 * 60 * 1000 : 30 * 60 * 1000;
        let maxTime = (this.autoSpeakCount < 3) ? 15 * 60 * 1000 : 40 * 60 * 1000;

        const delay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        this.autoSpeakTimer = setTimeout(() => this.triggerRumiaSpeak(), delay);
    }

    // [鏂板] 杈惧埌鏈€澶ц嚜瑷€鑷娆℃暟鍚庡紑鍚?10 鍒嗛挓鍊掕鏃剁潯鐪?
    scheduleSleepTimer() {
        if (this.sleepTimer) clearTimeout(this.sleepTimer);
        // 10 鍒嗛挓 = 10 * 60 * 1000 姣
        const sleepDelay = 10 * 60 * 1000;
        console.log("露米娅完成了最后一次自言自语，开启 10 分钟闲置睡眠定时器...");
        this.sleepTimer = setTimeout(() => {
            console.log("闲置超时，露米娅入睡。");
            this.isSleeping = true;
            this.setEmotion('sleeping');
            this.showBubble("（露米娅等累了，已经靠在角落呼呼大睡了……）", 10000);
        }, sleepDelay);
    }

    // [鏂板] 鍞ら啋鍑芥暟
    wakeUp(quiet = false) {
        if (this.sleepTimer) {
            clearTimeout(this.sleepTimer);
            this.sleepTimer = null;
        }
        if (this.isSleeping) {
            this.isSleeping = false;
            console.log("露米娅被成功唤醒。");
            this.setEmotion('normal');
            if (!quiet) {
                this.showBubble("呜...干嘛吵醒人家，人家刚才梦见超好吃的巧克力饼干了呢！", 3500);
            }
            this.autoSpeakCount = 0;
            this.resetAutoSpeakTimer();
        }
    }

    // [鏂板] 鍚姩鏃舵墦鎷涘懠
    async greetUser() {
        console.log("姝ｅ湪灏濊瘯鎵撴嫑鍛?..");
        // 鍏堟樉绀虹瓑寰咃紝鎻愬崌浣撻獙
        this.showBubble("...", 2000);

        try {
            const response = await fetch('/api/rumia_speak', {
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
            console.error("鎵撴嫑鍛煎け璐?", e);
        }
    }

    async triggerRumiaSpeak() {
        this.autoSpeakCount++;
        try {
            const response = await fetch('/api/rumia_speak', {
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
                            contentEl.innerText = `这个词连接了露米娅对您的 "${node.label}" 的记忆碎片。`;
                        }
                        
                        infoCard.classList.remove('hidden');
                    }
                } else {
                    infoCard.classList.add('hidden');
                }
            });
            
        } catch (e) {
            console.error("鍔犺浇璁板繂鍥捐氨寮傚父:", e);
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
            console.error("鎵嬪姩鏁寸悊璁板繂寮傚父:", e);
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
        console.log(`[MUSIC PLAYER] 寮€濮嬬洿鎺ユ挱姝? ${musicPlay.name} - ${musicPlay.artists}`);
        
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
        
        console.log(`[MUSIC PLAYER] 寮€濮嬫悳绱㈠苟鐐规挱: ${query}`);
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
            this.liveLyrics.innerText = "让露米娅唱首歌给你听吧...";
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
    new RumiaPet();
});
