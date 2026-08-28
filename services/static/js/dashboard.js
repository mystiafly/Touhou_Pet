
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

// =========================================================================
// 🔄 全局统一重启应用调度器 (切换角色、切换立绘或底层重载时触发)
// =========================================================================
window.triggerAppRestart = async function(reason = "操作已生效，系统正在自动重启以加载最新人设与立绘...") {
    if (reason) alert(reason);
    
    // 1. Electron Preload API
    if (window.__petIPC && typeof window.__petIPC.restartApp === 'function') {
        window.__petIPC.restartApp();
        return;
    }
    if (window.electronAPI && typeof window.electronAPI.restartApp === 'function') {
        window.electronAPI.restartApp();
        return;
    }
    // 2. Node.js require (若有)
    if (typeof require !== 'undefined') {
        try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('restart-app');
            return;
        } catch(e) {}
    }
    // 3. 后端 API 重启接口兜底
    try {
        await fetch('/api/restart', { method: 'POST' });
    } catch(e) {}
    
    // 4. 浏览器端重载
    setTimeout(() => {
        window.location.reload();
    }, 1200);
};

// =========================================================================
// 🎙️ 全局 TTS 引擎调度器 (Fish Audio, Edge-TTS, GPT-SoVITS)
// =========================================================================
window.selectTtsEngine = async function(engineKey, skipSave = false) {
    if (!engineKey) engineKey = 'edge_tts';
    const fishCard = document.getElementById('engine-card-fish');
    const edgeCard = document.getElementById('engine-card-edge');
    const gptCard = document.getElementById('engine-card-gptsovits');

    const fishPanel = document.getElementById('tts-panel-fish');
    const edgePanel = document.getElementById('tts-panel-edge');
    const gptPanel = document.getElementById('tts-panel-gptsovits');
    const providerInput = document.getElementById('tts-provider-select');

    if (providerInput) providerInput.value = engineKey;

    // 重置所有卡片边框高亮与阴影
    if (fishCard) { fishCard.style.border = '2px solid transparent'; fishCard.style.boxShadow = 'none'; }
    if (edgeCard) { edgeCard.style.border = '2px solid transparent'; edgeCard.style.boxShadow = 'none'; }
    if (gptCard) { gptCard.style.border = '2px solid transparent'; gptCard.style.boxShadow = 'none'; }

    // 隐藏所有专属面板
    if (fishPanel) fishPanel.style.display = 'none';
    if (edgePanel) edgePanel.style.display = 'none';
    if (gptPanel) gptPanel.style.display = 'none';

    if (engineKey === 'fish_audio') {
        if (fishCard) { fishCard.style.border = '2px solid #ff79c6'; fishCard.style.boxShadow = '0 0 14px rgba(255,121,198,0.25)'; }
        if (fishPanel) fishPanel.style.display = 'block';
    } else if (engineKey === 'gpt_sovits') {
        if (gptCard) { gptCard.style.border = '2px solid #8be9fd'; gptCard.style.boxShadow = '0 0 14px rgba(139,233,253,0.25)'; }
        if (gptPanel) gptPanel.style.display = 'block';
        if (window.checkGptSovitsStatus) window.checkGptSovitsStatus();
    } else {
        // 默认为 edge_tts
        if (edgeCard) { edgeCard.style.border = '2px solid #50fa7b'; edgeCard.style.boxShadow = '0 0 14px rgba(80,250,123,0.25)'; }
        if (edgePanel) edgePanel.style.display = 'block';
    }

    if (!skipSave) {
        try {
            await fetch('/api/settings/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tts_provider: engineKey })
            });
        } catch (e) {
            console.error('保存 TTS 服务商失败:', e);
        }
    }
};

window.onEdgeVoiceSelectChange = async function(voiceName, lang) {
    if (!voiceName) return;
    const payload = {};
    if (lang === 'zh') {
        payload.tts_voice_zh = voiceName;
        payload.tts_voice_id = voiceName;
    } else if (lang === 'ja') {
        payload.tts_voice_ja = voiceName;
    } else if (lang === 'en') {
        payload.tts_voice_en = voiceName;
    }
    try {
        await fetch('/api/settings/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('更新 Edge-TTS 音色失败:', e);
    }
};

window.checkGptSovitsStatus = async function() {
    const dot = document.getElementById('gptsovits-status-dot');
    const text = document.getElementById('gptsovits-status-text');
    const btn = document.getElementById('btn-check-gptsovits');

    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检测中...';
    try {
        const res = await fetch('/api/tts/gpt_sovits/status');
        const data = await res.json();
        if (data.running) {
            if (dot) dot.style.background = '#50fa7b';
            if (text) {
                text.style.color = '#50fa7b';
                text.innerText = '已连接 (运行中)';
            }
        } else {
            if (dot) dot.style.background = '#ff5555';
            if (text) {
                text.style.color = '#ff5555';
                text.innerText = '未连接 (离线)';
            }
        }
    } catch (e) {
        if (dot) dot.style.background = '#ff5555';
        if (text) {
            text.style.color = '#ff5555';
            text.innerText = '未连接 (离线)';
        }
    } finally {
        if (btn) btn.innerHTML = '<i class="fas fa-search"></i> 检测连接状态';
    }
};

window.launchGptSovitsService = async function() {
    const btn = document.getElementById('btn-launch-gptsovits');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在自动拉起中...';
    }
    try {
        const res = await fetch('/api/tts/gpt_sovits/launch', { method: 'POST' });
        const data = await res.json();
        alert(data.message || (data.success ? '启动成功！' : '启动失败'));
        await window.checkGptSovitsStatus();
    } catch (e) {
        alert('启动请求异常: ' + e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-rocket"></i> 一键启动本地服务';
        }
    }
};

// dashboard.js - 独立大贤者控制台核心逻辑
document.addEventListener('DOMContentLoaded', () => {

    function applyDashboardThemeColor(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return;
        
        let r = parseInt(hex.substring(1, 3), 16);
        let g = parseInt(hex.substring(3, 5), 16);
        let b = parseInt(hex.substring(5, 7), 16);
        
        let hr = Math.max(0, r - 32);
        let hg = Math.max(0, g - 32);
        let hb = Math.max(0, b - 32);
        
        document.documentElement.style.setProperty('--accent', hex);
        document.documentElement.style.setProperty('--accent-hover', `rgb(${hr}, ${hg}, ${hb})`);
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
    }

    function applyDashboardBgColor(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return;
        
        let r = parseInt(hex.substring(1, 3), 16);
        let g = parseInt(hex.substring(3, 5), 16);
        let b = parseInt(hex.substring(5, 7), 16);
        
        let lightness = (r * 299 + g * 587 + b * 114) / 1000;
        let isLight = lightness > 128;
        
        document.documentElement.style.setProperty('--bg-dark', hex);
        document.body.style.backgroundColor = hex;
        
        if (isLight) {
            document.documentElement.style.setProperty('--text-main', '#1a1a24');
            document.documentElement.style.setProperty('--text-muted', '#6a6a7a');
            document.documentElement.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.08)');
            
            let pr = Math.min(255, r + 10);
            let pg = Math.min(255, g + 10);
            let pb = Math.min(255, b + 10);
            document.documentElement.style.setProperty('--bg-panel', `rgb(${pr}, ${pg}, ${pb})`);
            document.documentElement.style.setProperty('--bg-card', '#ffffff');
        } else {
            document.documentElement.style.setProperty('--text-main', '#f0f0f0');
            document.documentElement.style.setProperty('--text-muted', '#a0a0b0');
            document.documentElement.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
            
            let pr = Math.min(255, r + 12);
            let pg = Math.min(255, g + 12);
            let pb = Math.min(255, b + 12);
            document.documentElement.style.setProperty('--bg-panel', `rgb(${pr}, ${pg}, ${pb})`);
            
            let cr = Math.min(255, r + 24);
            let cg = Math.min(255, g + 24);
            let cb = Math.min(255, b + 24);
            document.documentElement.style.setProperty('--bg-card', `rgb(${cr}, ${cg}, ${cb})`);
        }

        // 更新预览区域
        const preview = document.getElementById('current-bg-preview');
        const hexLabel = document.getElementById('current-bg-hex');
        if (preview) preview.style.background = hex;
        if (hexLabel) hexLabel.textContent = hex;
        // 更新选中状态
        document.querySelectorAll('.bg-color-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.color === hex);
        });
    }

    // 初始化个性化面板
    function initPersonalizationPanel() {
        const swatches = document.querySelectorAll('.bg-color-swatch:not([data-color="custom"])');
        const customPicker = document.getElementById('custom-bg-color-picker');
        const saveBtn = document.getElementById('save-bg-color-btn');
        let pendingColor = localStorage.getItem('dashboard_bg_color') || '#12121a';

        // 加载已保存的颜色
        applyDashboardBgColor(pendingColor);

        swatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                pendingColor = swatch.dataset.color;
                applyDashboardBgColor(pendingColor);
            });
        });

        if (customPicker) {
            customPicker.addEventListener('input', (e) => {
                pendingColor = e.target.value;
                applyDashboardBgColor(pendingColor);
                // 自定义格子也标为选中
                document.querySelectorAll('.bg-color-swatch').forEach(s => s.classList.remove('selected'));
                customPicker.closest('.bg-color-swatch').classList.add('selected');
            });
        }

        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = 'true';
            saveBtn.addEventListener('click', async () => {
                localStorage.setItem('dashboard_bg_color', pendingColor);
                const originalHTML = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-check"></i> 已保存';
                setTimeout(() => { saveBtn.innerHTML = originalHTML; }, 1500);
            });
        }
    }

    // 导航栏切换
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // 如果切换到图谱，延迟渲染以保证容器可见
            if (targetId === 'graph-view' && !window.graphLoaded) {
                loadMemoryGraph();
                window.graphLoaded = true;
            }
            if (targetId === 'logs-view' && !window.logsLoaded) {
                loadLogsList();
                window.logsLoaded = true;
            }
            if (targetId === 'databank-view') {
                if(window.loadDataBank) window.loadDataBank();
            }
            if (targetId === 'tools-view' && !window.toolsLoaded) {
                if(window.loadToolsList) window.loadToolsList();
                window.toolsLoaded = true;
            }
            if (targetId === 'personalization-view' && !window.personalizationInited) {
                initPersonalizationPanel();
                window.personalizationInited = true;
            }
            if (targetId === 'tts-settings-view') {
                if (window.checkGptSovitsStatus) window.checkGptSovitsStatus();
            }
        });
    });

    // 页面加载时立即恢复已保存的背景色
    const savedBg = localStorage.getItem('dashboard_bg_color');
    if (savedBg) applyDashboardBgColor(savedBg);

    // ========== 大脑引擎配置 ==========
    const apiSelect = document.getElementById('api-provider-select');
    const charSelect = document.getElementById('character-select');

    // 加载基础配置
    async function loadConfig() {
        try {
            await loadCustomEngines();
            
            const [configRes, charRes] = await Promise.all([
                fetch('/api/settings/config'),
                fetch('/api/character_info')
            ]);
            const configData = await configRes.json();
            const charData = await charRes.json();

            if (configData.success) {
                apiSelect.value = configData.api_provider;
                
                const visionEngineSelect = document.getElementById('vision-engine-select');
                if (visionEngineSelect && configData.vision_engine) {
                    visionEngineSelect.value = configData.vision_engine;
                }
                
                const preApiSelect = document.getElementById('pre-api-provider-select');
                if (preApiSelect && configData.pre_api_provider) {
                    preApiSelect.value = configData.pre_api_provider;
                }
                
                const postApiSelect = document.getElementById('post-api-provider-select');
                if (postApiSelect && configData.post_api_provider) {
                    postApiSelect.value = configData.post_api_provider;
                }
                
                const flowModeToggle = document.getElementById('flow-mode-toggle');
                if (flowModeToggle) {
                    flowModeToggle.checked = !!configData.flow_mode;
                }
                
                const historyStepSelect = document.getElementById('history-step-multiplier-select');
                if (historyStepSelect && configData.history_step_multiplier !== undefined) {
                    historyStepSelect.value = configData.history_step_multiplier.toString();
                }

                const globalTempSlider = document.getElementById('global-temperature-slider');
                const globalTempInput = document.getElementById('global-temperature-input');
                const globalTempVal = document.getElementById('global-temperature-val');
                const globalTemp = configData.temperature !== undefined ? parseFloat(configData.temperature) : 0.7;
                if (globalTempSlider) globalTempSlider.value = globalTemp;
                if (globalTempInput) globalTempInput.value = globalTemp;
                if (globalTempVal) globalTempVal.textContent = globalTemp.toFixed(2);
                
                const mainDisplay = document.getElementById('main-api-provider-display');
                if (mainDisplay) {
                    const selectedOpt = apiSelect.options[apiSelect.selectedIndex];
                    mainDisplay.value = selectedOpt ? selectedOpt.text : apiSelect.value;
                }
                
                const personaPromptArea = document.getElementById('persona-prompt');
                if (personaPromptArea && configData.persona_prompt !== undefined) {
                    personaPromptArea.value = configData.persona_prompt;
                }
                
                const userPromptArea = document.getElementById('user-prompt');
                if (userPromptArea && configData.user_prompt !== undefined) {
                    userPromptArea.value = configData.user_prompt;
                }

                const immersiveWallpaperInput = document.getElementById('immersive-wallpaper-input');
                const wallpaperFitSelect = document.getElementById('wallpaper-fit-select');
                if (wallpaperFitSelect && configData.wallpaper_fit !== undefined) {
                    wallpaperFitSelect.value = configData.wallpaper_fit;
                }
                if (immersiveWallpaperInput) {
                    const url = configData.immersive_wallpaper || configData.wallpaper_url || "";
                    immersiveWallpaperInput.value = url;
                    updateWallpaperPreview(url, configData.wallpaper_fit || 'cover');
                }

                const bgmInput = document.getElementById('immersive-bgm-input');
                if (bgmInput && configData.immersive_bgm_url !== undefined) {
                    bgmInput.value = configData.immersive_bgm_url;
                }
                const bgmToggle = document.getElementById('immersive-bgm-toggle');
                if (bgmToggle) {
                    bgmToggle.checked = configData.enable_immersive_bgm !== false;
                }

                const starlightToggle = document.getElementById('immersive-effect-starlight');
                if (starlightToggle) {
                    starlightToggle.checked = !!configData.enable_immersive_starlight;
                }

                const meteorsToggle = document.getElementById('immersive-effect-meteors');
                if (meteorsToggle) {
                    meteorsToggle.checked = !!configData.enable_immersive_meteors;
                }

                const parallaxToggle = document.getElementById('immersive-effect-parallax');
                if (parallaxToggle) {
                    parallaxToggle.checked = !!configData.enable_immersive_parallax;
                }

                const screenshotBtnToggle = document.getElementById('immersive-effect-screenshot-btn');
                if (screenshotBtnToggle) {
                    screenshotBtnToggle.checked = !!configData.enable_immersive_screenshot_btn;
                }
                
                const greetingToggle = document.getElementById('greeting-toggle');
                if (greetingToggle) {
                    greetingToggle.checked = configData.enable_greeting !== false;
                }
                
                const autoSpeakToggle = document.getElementById('auto-speak-toggle');
                if (autoSpeakToggle) {
                    autoSpeakToggle.checked = configData.enable_auto_speak !== false;
                }

                const autoMinimizeGameToggle = document.getElementById('auto-minimize-fullscreen-game-toggle');
                if (autoMinimizeGameToggle) {
                    autoMinimizeGameToggle.checked = configData.auto_minimize_on_fullscreen_game !== false;
                }
                
                const autoSpeakMultiplier = document.getElementById('auto-speak-multiplier');
                if (autoSpeakMultiplier && configData.auto_speak_multiplier) {
                    autoSpeakMultiplier.value = Number(configData.auto_speak_multiplier).toFixed(1);
                }

                const bubbleDurationMultiplier = document.getElementById('bubble-duration-multiplier');
                if (bubbleDurationMultiplier && configData.bubble_duration_multiplier) {
                    bubbleDurationMultiplier.value = Number(configData.bubble_duration_multiplier).toFixed(1);
                } else if (bubbleDurationMultiplier) {
                    bubbleDurationMultiplier.value = "1.0";
                }

                const showThoughtBtnToggle = document.getElementById('show-thought-button-toggle');
                if (showThoughtBtnToggle) {
                    showThoughtBtnToggle.checked = configData.show_thought_button !== false;
                }

                const showToolCallsToggle = document.getElementById('show-tool-calls-toggle');
                if (showToolCallsToggle) {
                    showToolCallsToggle.checked = configData.show_tool_calls !== false;
                }

                const autoStartToggle = document.getElementById('auto-start-toggle');
                if (autoStartToggle) {
                    autoStartToggle.checked = configData.auto_start_on_boot === true;
                }

                const ttsClickToggle = document.getElementById('tts-mode-click-toggle');
                const ttsAutoToggle = document.getElementById('tts-mode-auto-toggle');
                if (ttsClickToggle) {
                    ttsClickToggle.checked = configData.enable_tts_click !== false;
                }
                if (ttsAutoToggle) {
                    ttsAutoToggle.checked = configData.enable_tts_auto === true || configData.tts_speak_mode === 'auto';
                }

                const ttsProviderSelect = document.getElementById('tts-provider-select');
                if (ttsProviderSelect && configData.tts_provider) {
                    ttsProviderSelect.value = configData.tts_provider;
                }

                const fishAudioKeyInput = document.getElementById('fish-audio-key-input');
                if (fishAudioKeyInput) {
                    fishAudioKeyInput.value = configData.tts_api_key || configData.fish_audio_api_key || "";
                }

                const fishAudioUrlInput = document.getElementById('fish-audio-url-input');
                if (fishAudioUrlInput) {
                    fishAudioUrlInput.value = configData.tts_base_url || configData.fish_audio_base_url || "https://api.fish.audio/v1/tts";
                }

                const gptsovitsUrlInput = document.getElementById('gptsovits-url-input');
                if (gptsovitsUrlInput && configData.tts_base_url && configData.tts_base_url.includes('9880')) {
                    gptsovitsUrlInput.value = configData.tts_base_url;
                }

                // 初始化选中当前 TTS 引擎卡片与面板
                const currentTtsProvider = configData.tts_provider || "fish_audio";
                if (window.selectTtsEngine) {
                    window.selectTtsEngine(currentTtsProvider, true);
                }

                const ttsLangSelect = document.getElementById('character-tts-language-select');
                if (ttsLangSelect && configData.tts_language) {
                    ttsLangSelect.value = configData.tts_language;
                }

                const charTtsZhInput = document.getElementById('character-tts-voice-zh');
                if (charTtsZhInput && (configData.tts_voice_zh !== undefined || configData.tts_voice_id !== undefined)) {
                    charTtsZhInput.value = configData.tts_voice_zh || configData.tts_voice_id || "";
                }
                const charTtsJaInput = document.getElementById('character-tts-voice-ja');
                if (charTtsJaInput && configData.tts_voice_ja !== undefined) {
                    charTtsJaInput.value = configData.tts_voice_ja;
                }
                const charTtsEnInput = document.getElementById('character-tts-voice-en');
                if (charTtsEnInput && configData.tts_voice_en !== undefined) {
                    charTtsEnInput.value = configData.tts_voice_en;
                }

                // 同步初始化 Edge-TTS 音色下拉选择
                const edgeZhSelect = document.getElementById('edge-voice-zh-select');
                if (edgeZhSelect && configData.tts_voice_zh) {
                    edgeZhSelect.value = configData.tts_voice_zh;
                }
                const edgeJaSelect = document.getElementById('edge-voice-ja-select');
                if (edgeJaSelect && configData.tts_voice_ja) {
                    edgeJaSelect.value = configData.tts_voice_ja;
                }
                const edgeEnSelect = document.getElementById('edge-voice-en-select');
                if (edgeEnSelect && configData.tts_voice_en) {
                    edgeEnSelect.value = configData.tts_voice_en;
                }

                const presetMaxDepth = document.getElementById('preset-max-depth');
                if (presetMaxDepth && configData.preset_max_depth !== undefined) {
                    presetMaxDepth.value = configData.preset_max_depth.toString();
                } else if (presetMaxDepth) {
                    presetMaxDepth.value = "2";
                }
                
                const blockEnglishToggle = document.getElementById('block-english-toggle');
                if (blockEnglishToggle) {
                    blockEnglishToggle.checked = configData.preset_block_english === true;
                }

                const charNameInput = document.getElementById('character-name-input');
                if (charNameInput && configData.character_name !== undefined) {
                    charNameInput.value = configData.character_name;
                }

                const charIdInput = document.getElementById('character-id-input');
                if (charIdInput && configData.character_id !== undefined) {
                    charIdInput.value = configData.character_id;
                }

                if (configData.theme_color) {
                    applyDashboardThemeColor(configData.theme_color);
                    document.querySelectorAll('.theme-color-swatch').forEach(s => {
                        s.classList.toggle('selected', s.dataset.color === configData.theme_color);
                    });
                }
            }



            // 加载动态角色列表
            // 加载动态角色列表与角色管理中心网格
            try {
                const charsResponse = await fetch('/api/characters/list');
                const charsData = await charsResponse.json();
                if (charsData.status === "success" || charsData.characters) {
                    if (charSelect) {
                        charSelect.innerHTML = "";
                        charsData.characters.forEach(c => {
                            const option = document.createElement("option");
                            option.value = c.character_id;
                            option.innerText = `${c.character_name} (${c.character_id})`;
                            charSelect.appendChild(option);
                        });
                    }
                    renderCharacterManagementGrid(charsData.characters, charsData.active_character || charData.character_id);
                }
            } catch (e) {
                console.error("加载角色列表失败:", e);
            }

            if (charSelect && charData.character_id) {
                charSelect.value = charData.character_id;
            }
            if (charData.character_id) {
                cachedActiveCharId = charData.character_id;
                refreshAvatarPreview(charData.character_id);
            }
        } catch (e) {
            console.error("加载配置失败:", e);
        }
    }

    loadConfig();

    apiSelect.addEventListener('change', async () => {
        try {
            const response = await fetch('/api/settings/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ api_provider: apiSelect.value })
            });
            const data = await response.json();
            if (!data.success) {
                alert("切换引擎失败: " + data.error);
            } else {
                const mainDisplay = document.getElementById('main-api-provider-display');
                if (mainDisplay) {
                    mainDisplay.value = apiSelect.value;
                }
            }
        } catch (e) {
            alert("切换引擎请求失败！");
        }
    });

    const preApiSelect = document.getElementById('pre-api-provider-select');
    if (preApiSelect) {
        preApiSelect.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ pre_api_provider: preApiSelect.value })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const postApiSelect = document.getElementById('post-api-provider-select');
    if (postApiSelect) {
        postApiSelect.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ post_api_provider: postApiSelect.value })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const flowModeToggle = document.getElementById('flow-mode-toggle');
    if (flowModeToggle) {
        flowModeToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ flow_mode: flowModeToggle.checked })
                });
            } catch (e) {
                console.error("保存心流模式失败:", e);
            }
        });
    }

    const historyStepSelect = document.getElementById('history-step-multiplier-select');
    if (historyStepSelect) {
        historyStepSelect.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ history_step_multiplier: parseInt(historyStepSelect.value) })
                });
            } catch (e) {
                console.error("保存阶梯倍率失败:", e);
            }
        });
    }

    const globalTempSlider = document.getElementById('global-temperature-slider');
    const globalTempInput = document.getElementById('global-temperature-input');
    const globalTempVal = document.getElementById('global-temperature-val');
    if (globalTempSlider && globalTempInput) {
        const syncGlobalTemp = async (val, save = false) => {
            const num = Math.max(0, Math.min(2, parseFloat(val) || 0.7));
            globalTempSlider.value = num;
            globalTempInput.value = num;
            if (globalTempVal) globalTempVal.textContent = num.toFixed(2);
            if (save) {
                try {
                    await fetch('/api/settings/config', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ temperature: num })
                    });
                } catch (e) {
                    console.error("保存全局温度失败:", e);
                }
            }
        };
        globalTempSlider.addEventListener('input', (e) => syncGlobalTemp(e.target.value, false));
        globalTempSlider.addEventListener('change', (e) => syncGlobalTemp(e.target.value, true));
        globalTempInput.addEventListener('input', (e) => syncGlobalTemp(e.target.value, false));
        globalTempInput.addEventListener('change', (e) => syncGlobalTemp(e.target.value, true));
    }

    const visionEngineSelect = document.getElementById('vision-engine-select');
    if (visionEngineSelect) {
        visionEngineSelect.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ vision_engine: visionEngineSelect.value })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const btnTestVision = document.getElementById('btn-test-vision');
    if (btnTestVision && visionEngineSelect) {
        btnTestVision.addEventListener('click', async () => {
            btnTestVision.disabled = true;
            btnTestVision.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试中...';
            try {
                const response = await fetch('/api/settings/test_vision', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ engine: visionEngineSelect.value })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    alert('识图成功！返回内容：\n' + data.result);
                } else {
                    alert('识图失败：\n' + data.message);
                }
            } catch (e) {
                alert('识图请求异常：\n' + e.toString());
            } finally {
                btnTestVision.disabled = false;
                btnTestVision.innerHTML = '<i class="fas fa-eye"></i> 测试识图';
            }
        });
    }

    const personaPromptArea = document.getElementById('persona-prompt');
    if (personaPromptArea) {
        personaPromptArea.addEventListener('change', async () => {
            try {
                const response = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ persona_prompt: personaPromptArea.value })
                });
                const data = await response.json();
                if (!data.success) {
                    alert("保存 角色核心词 失败: " + data.error);
                }
            } catch (e) {
                alert("保存失败！");
            }
        });
    }

    function updateWallpaperPreview(url, fitMode) {
        const previewImg = document.getElementById('wallpaper-preview-img');
        const previewPlaceholder = document.getElementById('wallpaper-preview-placeholder');
        const wallpaperFitSelect = document.getElementById('wallpaper-fit-select');
        const mode = fitMode || (wallpaperFitSelect ? wallpaperFitSelect.value : 'cover');

        if (previewImg && previewPlaceholder) {
            if (url && url.trim()) {
                previewImg.src = url.trim();
                if (mode === 'auto') {
                    previewImg.style.objectFit = 'none';
                } else if (mode === '100% 100%') {
                    previewImg.style.objectFit = 'fill';
                } else {
                    previewImg.style.objectFit = mode;
                }
                previewImg.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                previewPlaceholder.style.display = 'block';
            }
        }
    }

    const immersiveWallpaperInput = document.getElementById('immersive-wallpaper-input');
    const wallpaperFitSelect = document.getElementById('wallpaper-fit-select');
    const previewWallpaperBtn = document.getElementById('preview-wallpaper-btn');
    const uploadWallpaperBtn = document.getElementById('upload-wallpaper-btn');
    const wallpaperFileInput = document.getElementById('wallpaper-file-input');

    if (uploadWallpaperBtn && wallpaperFileInput) {
        uploadWallpaperBtn.addEventListener('click', () => {
            wallpaperFileInput.click();
        });

        wallpaperFileInput.addEventListener('change', async () => {
            if (!wallpaperFileInput.files || wallpaperFileInput.files.length === 0) return;
            const file = wallpaperFileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            const origHtml = uploadWallpaperBtn.innerHTML;
            uploadWallpaperBtn.disabled = true;
            uploadWallpaperBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';

            try {
                const response = await fetch('/api/character/upload_wallpaper', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success && data.wallpaper_url) {
                    if (immersiveWallpaperInput) {
                        immersiveWallpaperInput.value = data.wallpaper_url;
                    }
                    updateWallpaperPreview(data.wallpaper_url);
                } else {
                    alert("壁纸上传失败: " + (data.message || "未知错误"));
                }
            } catch (e) {
                console.error("壁纸上传出错:", e);
                alert("壁纸上传出错，请重试！");
            } finally {
                uploadWallpaperBtn.disabled = false;
                uploadWallpaperBtn.innerHTML = origHtml;
                wallpaperFileInput.value = '';
            }
        });
    }

    if (immersiveWallpaperInput) {
        immersiveWallpaperInput.addEventListener('change', async () => {
            const val = immersiveWallpaperInput.value.trim();
            updateWallpaperPreview(val);
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ immersive_wallpaper: val })
                });
            } catch (e) {
                console.error("保存沉浸壁纸失败:", e);
            }
        });
    }

    const uploadBgmBtn = document.getElementById('upload-bgm-btn');
    const bgmFileInput = document.getElementById('bgm-file-input');
    const immersiveBgmInput = document.getElementById('immersive-bgm-input');
    const immersiveBgmToggle = document.getElementById('immersive-bgm-toggle');
    const testBgmBtn = document.getElementById('test-bgm-btn');
    const dashboardBgmPreview = document.getElementById('dashboard-bgm-preview');

    if (uploadBgmBtn && bgmFileInput) {
        uploadBgmBtn.addEventListener('click', () => {
            bgmFileInput.click();
        });

        bgmFileInput.addEventListener('change', async () => {
            if (!bgmFileInput.files || bgmFileInput.files.length === 0) return;
            const file = bgmFileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            const origHtml = uploadBgmBtn.innerHTML;
            uploadBgmBtn.disabled = true;
            uploadBgmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';

            try {
                const response = await fetch('/api/character/upload_bgm', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success && data.bgm_url) {
                    if (immersiveBgmInput) {
                        immersiveBgmInput.value = data.bgm_url;
                    }
                    if (immersiveBgmToggle) {
                        immersiveBgmToggle.checked = true;
                    }
                    alert("背景音乐上传并自动应用成功！");
                } else {
                    alert("音乐上传失败: " + (data.message || "未知错误"));
                }
            } catch (e) {
                console.error("音乐上传出错:", e);
                alert("音乐上传出错，请重试！");
            } finally {
                uploadBgmBtn.disabled = false;
                uploadBgmBtn.innerHTML = origHtml;
                bgmFileInput.value = '';
            }
        });
    }

    if (immersiveBgmInput) {
        immersiveBgmInput.addEventListener('change', async () => {
            const val = immersiveBgmInput.value.trim();
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ immersive_bgm_url: val })
                });
            } catch (e) {
                console.error("保存 BGM 失败:", e);
            }
        });
    }

    if (immersiveBgmToggle) {
        immersiveBgmToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_bgm: immersiveBgmToggle.checked })
                });
            } catch (e) {
                console.error("保存 BGM 开关失败:", e);
            }
        });
    }

    const starlightToggle = document.getElementById('immersive-effect-starlight');
    if (starlightToggle) {
        starlightToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_starlight: starlightToggle.checked })
                });
            } catch (e) {
                console.error("保存星光特效开关失败:", e);
            }
        });
    }

    const meteorsToggle = document.getElementById('immersive-effect-meteors');
    if (meteorsToggle) {
        meteorsToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_meteors: meteorsToggle.checked })
                });
            } catch (e) {
                console.error("保存流星特效开关失败:", e);
            }
        });
    }

    const parallaxToggle = document.getElementById('immersive-effect-parallax');
    if (parallaxToggle) {
        parallaxToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_parallax: parallaxToggle.checked })
                });
            } catch (e) {
                console.error("保存视差移动开关失败:", e);
            }
        });
    }

    const screenshotBtnToggle = document.getElementById('immersive-effect-screenshot-btn');
    if (screenshotBtnToggle) {
        screenshotBtnToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_screenshot_btn: screenshotBtnToggle.checked })
                });
            } catch (e) {
                console.error("保存截图按钮显示开关失败:", e);
            }
        });
    }

    if (testBgmBtn && dashboardBgmPreview) {
        testBgmBtn.addEventListener('click', () => {
            const url = immersiveBgmInput ? immersiveBgmInput.value.trim() : "";
            if (!url) {
                alert("请先选择或输入音乐 URL / 路径！");
                return;
            }
            if (!dashboardBgmPreview.paused && dashboardBgmPreview.src.includes(url)) {
                dashboardBgmPreview.pause();
                testBgmBtn.innerHTML = '<i class="fas fa-play"></i> 试听';
            } else {
                dashboardBgmPreview.src = url;
                dashboardBgmPreview.play().then(() => {
                    testBgmBtn.innerHTML = '<i class="fas fa-pause"></i> 停止';
                }).catch(e => {
                    alert("播放试听音频失败: " + e.toString());
                });
            }
        });
        dashboardBgmPreview.addEventListener('ended', () => {
            testBgmBtn.innerHTML = '<i class="fas fa-play"></i> 试听';
        });
    }

    if (wallpaperFitSelect) {
        wallpaperFitSelect.addEventListener('change', async () => {
            const fitVal = wallpaperFitSelect.value;
            const urlVal = immersiveWallpaperInput ? immersiveWallpaperInput.value.trim() : "";
            updateWallpaperPreview(urlVal, fitVal);
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ wallpaper_fit: fitVal })
                });
            } catch (e) {
                console.error("保存壁纸适应模式失败:", e);
            }
        });
    }

    if (previewWallpaperBtn && immersiveWallpaperInput) {
        previewWallpaperBtn.addEventListener('click', () => {
            updateWallpaperPreview(immersiveWallpaperInput.value.trim());
        });
    }

    // --------------------------------------------------------------------------
    // Steam Wallpaper Engine 联动壁纸管理
    // --------------------------------------------------------------------------
    function initWallpaperEngineManager() {
        const scanBtn = document.getElementById('scan-we-btn');
        const customPathInput = document.getElementById('we-custom-path-input');
        const statusDiv = document.getElementById('we-scan-status');
        const gridDiv = document.getElementById('we-wallpaper-grid');
        const transparentBtn = document.getElementById('use-transparent-mode-btn');

        if (!gridDiv) return;

        async function fetchAndRenderWEWallpapers(customPath = "") {
            statusDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>正在扫描 Steam 创意工坊壁纸中...</span>`;
            gridDiv.innerHTML = '';

            try {
                const url = customPath ? `/api/wallpaper_engine/scan?custom_path=${encodeURIComponent(customPath)}` : '/api/wallpaper_engine/scan';
                const res = await fetch(url);
                const data = await res.json();

                if (data.success && data.items && data.items.length > 0) {
                    if (data.scanned_path && customPathInput && !customPathInput.value) {
                        customPathInput.value = data.scanned_path;
                    }
                    statusDiv.innerHTML = `<i class="fas fa-check-circle" style="color: #50fa7b;"></i> <span>已找到 ${data.items.length} 个创意工坊壁纸 (检索路径: ${data.scanned_path})</span>`;
                    
                    data.items.forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'we-wallpaper-card';
                        card.style.cssText = `
                            background: rgba(30, 31, 41, 0.7);
                            border: 1px solid rgba(255, 255, 255, 0.12);
                            border-radius: 12px;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                            transition: all 0.3s ease;
                            cursor: pointer;
                            position: relative;
                        `;

                        let badgeColor = '#bd93f9';
                        let typeText = item.type;
                        if (item.type === 'video') { badgeColor = '#ff79c6'; typeText = '视频 (MP4)'; }
                        else if (item.type === 'scene') { badgeColor = '#8be9fd'; typeText = '3D/场景'; }
                        else if (item.type === 'web') { badgeColor = '#50fa7b'; typeText = '网页 (HTML5)'; }

                        card.innerHTML = `
                            <div style="width: 100%; height: 130px; background: #181926; position: relative; overflow: hidden;">
                                <img src="${item.preview_url || ''}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                                <span style="position: absolute; top: 8px; right: 8px; background: ${badgeColor}; color: #181926; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${typeText}</span>
                            </div>
                            <div style="padding: 10px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div style="font-weight: 600; font-size: 13px; color: #f8f8f2; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.title}">${item.title}</div>
                                <button class="apply-we-btn action-btn outline" style="width: 100%; font-size: 12px; padding: 6px; border-color: rgba(255,255,255,0.2);">
                                    <i class="fas fa-check"></i> 应用此壁纸
                                </button>
                            </div>
                        `;

                        const applyBtn = card.querySelector('.apply-we-btn');
                        applyBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await selectWEWallpaper(item);
                        });
                        card.addEventListener('click', async () => {
                            await selectWEWallpaper(item);
                        });

                        gridDiv.appendChild(card);
                    });
                } else {
                    statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #ffb86c;"></i> <span>未在该路径找到 Steam 壁纸文件，请尝试在上方输入自定义 Workshop 路径</span>`;
                }
            } catch (err) {
                console.error("扫描 WE 壁纸库失败:", err);
                statusDiv.innerHTML = `<i class="fas fa-times-circle" style="color: #ff5555;"></i> <span>扫描失败，请检查网络或路径</span>`;
            }
        }

        async function selectWEWallpaper(item) {
            let mode = 'image';
            let mediaUrl = item.media_url || item.preview_url;
            let wallpaperUrl = item.preview_url;
            let bgmUrl = item.extracted_bgm_url || "";
            let noteText = "";

            if (item.type === 'video') {
                mode = 'video';
                noteText = "已成功设置为【沙盒视频壁纸】！在桌宠沉浸模式内独立全屏播放 60 帧视频，绝不影响或修改你系统原本的桌面壁纸！";
            } else if (item.type === 'web') {
                mode = 'web';
                noteText = "已成功设置为【沙盒网页壁纸】！在桌宠沉浸模式内独立全屏渲染 WebGL 特效，绝不修改你系统原本的桌面壁纸！";
            } else if (item.type === 'scene') {
                if (!item.extracted_bg_url) {
                    try {
                        const unpackRes = await fetch('/api/wallpaper_engine/unpack', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folder_path: item.folder_path })
                        });
                        const unpackData = await unpackRes.json();
                        if (unpackData.success) {
                            item.extracted_bg_url = unpackData.extracted_bg_url;
                            item.extracted_bgm_url = unpackData.extracted_bgm_url;
                        }
                    } catch (e) {
                        console.error("按需解包失败:", e);
                    }
                }

                mode = 'scene_extracted';
                wallpaperUrl = item.extracted_bg_url || item.preview_url;
                mediaUrl = wallpaperUrl;
                bgmUrl = item.extracted_bgm_url || "";
                noteText = "已成功设置为【沙盒 4K 极清动态场景壁纸】！\n\n自动在桌宠全屏舞台中呈现 4K 无损底图 + 流星与群星特效 + 原版 BGM 音频！遮挡一切桌面应用与任务栏，且 100% 沙盒隔离，完全不触动或修改你电脑原有的壁纸！";
            } else {
                mode = 'image';
                mediaUrl = item.preview_url;
                noteText = "已成功设置为【沙盒图片壁纸】。";
            }

            try {
                const res = await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        immersive_bg_mode: mode,
                        immersive_media_url: mediaUrl,
                        immersive_wallpaper: wallpaperUrl,
                        immersive_bgm_url: bgmUrl
                    })
                });
                const data = await res.json();
                if (data.success) {
                    updateWallpaperPreview(wallpaperUrl);
                    alert(`已成功选择壁纸《${item.title}》！\n\n${noteText}`);
                }
            } catch (err) {
                console.error("保存 WE 壁纸配置失败:", err);
            }
        }

        if (transparentBtn) {
            transparentBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch('/api/character/save_immersive_config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            immersive_bg_mode: 'transparent'
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("已成功切换为“桌面透明透传模式”！在沉浸模式下背景将保持透明，透传桌面正在运行的 Wallpaper Engine 动态动画。");
                    }
                } catch (err) {
                    console.error("保存透明模式失败:", err);
                }
            });
        }

        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                const customPath = customPathInput ? customPathInput.value.trim() : "";
                fetchAndRenderWEWallpapers(customPath);
            });
        }

        // 默认自动扫描一次
        fetchAndRenderWEWallpapers();
    }

    initWallpaperEngineManager();

    const themeSwatches = document.querySelectorAll('.theme-color-swatch:not([data-color="custom"])');
    const customThemePicker = document.getElementById('custom-theme-color-picker');
    
    function saveThemeColor(color) {
        applyDashboardThemeColor(color);
        document.querySelectorAll('.theme-color-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.color === color);
        });
        fetch('/api/settings/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ theme_color: color })
        }).catch(e => console.error(e));
    }
    
    themeSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            saveThemeColor(swatch.dataset.color);
        });
    });
    
    if (customThemePicker) {
        customThemePicker.addEventListener('input', (e) => {
            applyDashboardThemeColor(e.target.value);
            document.querySelectorAll('.theme-color-swatch').forEach(s => s.classList.remove('selected'));
            customThemePicker.closest('.theme-color-swatch').classList.add('selected');
        });
        customThemePicker.addEventListener('change', (e) => {
            saveThemeColor(e.target.value);
        });
    }

    const userPromptArea = document.getElementById('user-prompt');
    if (userPromptArea) {
        userPromptArea.addEventListener('change', async () => {
            try {
                const response = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ user_prompt: userPromptArea.value })
                });
                const data = await response.json();
                if (!data.success) {
                    alert("保存 User 提示词失败: " + data.error);
                }
            } catch (e) {
                alert("保存失败！");
            }
        });
    }

    const greetingToggle = document.getElementById('greeting-toggle');
    if (greetingToggle) {
        greetingToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_greeting: greetingToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const autoSpeakToggle = document.getElementById('auto-speak-toggle');
    if (autoSpeakToggle) {
        autoSpeakToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_auto_speak: autoSpeakToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const autoMinimizeGameToggle = document.getElementById('auto-minimize-fullscreen-game-toggle');
    if (autoMinimizeGameToggle) {
        autoMinimizeGameToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ auto_minimize_on_fullscreen_game: autoMinimizeGameToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const autoSpeakMultiplier = document.getElementById('auto-speak-multiplier');
    if (autoSpeakMultiplier) {
        autoSpeakMultiplier.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ auto_speak_multiplier: parseFloat(autoSpeakMultiplier.value) })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const bubbleDurationMultiplier = document.getElementById('bubble-duration-multiplier');
    if (bubbleDurationMultiplier) {
        bubbleDurationMultiplier.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ bubble_duration_multiplier: parseFloat(bubbleDurationMultiplier.value) })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const showThoughtBtnToggle = document.getElementById('show-thought-button-toggle');
    if (showThoughtBtnToggle) {
        showThoughtBtnToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ show_thought_button: showThoughtBtnToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const showToolCallsToggle = document.getElementById('show-tool-calls-toggle');
    if (showToolCallsToggle) {
        showToolCallsToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ show_tool_calls: showToolCallsToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const autoStartToggle = document.getElementById('auto-start-toggle');
    if (autoStartToggle) {
        autoStartToggle.addEventListener('change', async () => {
            try {
                const enable = autoStartToggle.checked;
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ auto_start_on_boot: enable })
                });
                if (window.__petIPC && typeof window.__petIPC.setAutostart === 'function') {
                    await window.__petIPC.setAutostart(enable);
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    const presetMaxDepth = document.getElementById('preset-max-depth');
    if (presetMaxDepth) {
        presetMaxDepth.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ preset_max_depth: parseInt(presetMaxDepth.value) })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const blockEnglishToggle = document.getElementById('block-english-toggle');
    if (blockEnglishToggle) {
        blockEnglishToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ preset_block_english: blockEnglishToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    // Fish Audio API Key / URL 变更自动保存
    const fishAudioKeyInput = document.getElementById('fish-audio-key-input');
    const fishAudioUrlInput = document.getElementById('fish-audio-url-input');
    const gptsovitsUrlInput = document.getElementById('gptsovits-url-input');

    if (fishAudioKeyInput) {
        fishAudioKeyInput.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_api_key: fishAudioKeyInput.value.trim(),
                        fish_audio_api_key: fishAudioKeyInput.value.trim()
                    })
                });
            } catch (e) { console.error(e); }
        });
    }

    if (fishAudioUrlInput) {
        fishAudioUrlInput.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_base_url: fishAudioUrlInput.value.trim(),
                        fish_audio_base_url: fishAudioUrlInput.value.trim()
                    })
                });
            } catch (e) { console.error(e); }
        });
    }

    if (gptsovitsUrlInput) {
        gptsovitsUrlInput.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_base_url: gptsovitsUrlInput.value.trim()
                    })
                });
            } catch (e) { console.error(e); }
        });
    }

    // 密码框明暗显示切换
    const toggleFishKeyBtn = document.getElementById('toggle-fish-key-vis-btn');
    if (toggleFishKeyBtn && fishAudioKeyInput) {
        toggleFishKeyBtn.addEventListener('click', () => {
            if (fishAudioKeyInput.type === 'password') {
                fishAudioKeyInput.type = 'text';
                toggleFishKeyBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                fishAudioKeyInput.type = 'password';
                toggleFishKeyBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    }

    // 测试发音
    const testTtsBtn = document.getElementById('test-tts-btn');
    const ttsTestInput = document.getElementById('tts-test-input');
    let testAudio = new Audio();
    if (testTtsBtn) {
        testTtsBtn.addEventListener('click', async () => {
            const text = ttsTestInput ? ttsTestInput.value.trim() : '你好呀！我是你的桌面伴侣。';
            if (!text) return;

            const charTtsLangSelect = document.getElementById('character-tts-language-select');
            const lang = charTtsLangSelect ? charTtsLangSelect.value : 'zh';

            testTtsBtn.disabled = true;
            testTtsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 合成中...';

            try {
                const resp = await fetch('/api/tts/speak', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        text: text,
                        language: lang
                    })
                });
                const data = await resp.json();
                if (data.success && data.audio_url) {
                    testAudio.src = data.audio_url;
                    await testAudio.play();
                    testTtsBtn.innerHTML = '<i class="fas fa-volume-high"></i> 播放中...';
                    testAudio.onended = () => {
                        testTtsBtn.disabled = false;
                        testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
                    };
                    testAudio.onerror = () => {
                        testTtsBtn.disabled = false;
                        testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
                    };
                } else {
                    alert("语音合成失败: " + (data.error || "未知错误"));
                    testTtsBtn.disabled = false;
                    testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
                }
            } catch (e) {
                alert("请求异常: " + e.message);
                testTtsBtn.disabled = false;
                testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
            }
        });
    }

    // 保存当前角色多语种专属音色
    const saveCharVoiceBtn = document.getElementById('save-char-voice-btn');
    const charTtsLangSelect = document.getElementById('character-tts-language-select');
    const charTtsZhInput = document.getElementById('character-tts-voice-zh');
    const charTtsJaInput = document.getElementById('character-tts-voice-ja');
    const charTtsEnInput = document.getElementById('character-tts-voice-en');

    if (saveCharVoiceBtn) {
        saveCharVoiceBtn.addEventListener('click', async () => {
            const lang = charTtsLangSelect ? charTtsLangSelect.value : 'zh';
            const voiceZh = charTtsZhInput ? charTtsZhInput.value.trim() : '';
            const voiceJa = charTtsJaInput ? charTtsJaInput.value.trim() : '';
            const voiceEn = charTtsEnInput ? charTtsEnInput.value.trim() : '';
            
            let activeVoiceId = voiceZh;
            if (lang === 'ja') activeVoiceId = voiceJa || voiceZh;
            else if (lang === 'en') activeVoiceId = voiceEn || voiceZh;

            saveCharVoiceBtn.disabled = true;
            saveCharVoiceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            try {
                const resp = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_language: lang,
                        tts_voice_zh: voiceZh,
                        tts_voice_ja: voiceJa,
                        tts_voice_en: voiceEn,
                        tts_voice_id: activeVoiceId
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    saveCharVoiceBtn.innerHTML = '<i class="fas fa-check"></i> 保存成功！';
                    setTimeout(() => {
                        saveCharVoiceBtn.disabled = false;
                        saveCharVoiceBtn.innerHTML = '<i class="fas fa-save"></i> 保存当前角色音色';
                    }, 2000);
                } else {
                    alert("保存失败: " + (data.error || "未知错误"));
                    saveCharVoiceBtn.disabled = false;
                    saveCharVoiceBtn.innerHTML = '<i class="fas fa-save"></i> 保存当前角色音色';
                }
            } catch (e) {
                alert("网络异常: " + e.message);
                saveCharVoiceBtn.disabled = false;
                saveCharVoiceBtn.innerHTML = '<i class="fas fa-save"></i> 保存当前角色音色';
            }
        });
    }

    const saveCharIdentityBtn = document.getElementById('save-character-identity-btn');
    if (saveCharIdentityBtn) {
        saveCharIdentityBtn.addEventListener('click', async () => {
            const charNameInput = document.getElementById('character-name-input');
            const charIdInput = document.getElementById('character-id-input');
            const newName = charNameInput ? charNameInput.value.trim() : "";
            const newId = charIdInput ? charIdInput.value.trim().toLowerCase() : "";

            if (!newName) {
                alert("角色中文名称不能为空！");
                return;
            }
            if (!newId) {
                alert("角色英文标识不能为空！");
                return;
            }
            if (!/^[a-z0-9_]+$/.test(newId)) {
                alert("角色英文标识仅允许小写英文字母、数字和下划线！");
                return;
            }

            try {
                saveCharIdentityBtn.disabled = true;
                saveCharIdentityBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

                const response = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        character_name: newName,
                        character_id: newId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    if (data.require_restart) {
                        alert("角色英文标识 (ID) 已修改，相关配置文件与素材目录已自动同步重命名！程序将自动重启装载新目录。");
                        if (window.electronAPI) {
                            window.electronAPI.restartApp();
                        } else {
                            location.reload();
                        }
                    } else {
                        alert("角色名称与标识设置保存成功！");
                        loadConfig();
                    }
                } else {
                    alert("保存失败: " + (data.message || data.error));
                }
            } catch (e) {
                alert("保存发生异常: " + e.toString());
            } finally {
                saveCharIdentityBtn.disabled = false;
                saveCharIdentityBtn.innerHTML = '<i class="fas fa-save"></i> 保存角色名称与英文标识';
            }
        });
    }

    if (charSelect) {
        charSelect.addEventListener('change', async (e) => {
            const targetCharId = e.target.value;
            const targetCharName = e.target.options[e.target.selectedIndex].text;
            const confirmSwitch = await window.asyncConfirm(`确定要切换灵魂为【${targetCharName}】吗？\n为保证大模型记忆、性格设定与立绘环境绝对纯净，将立即自动重启桌宠系统！`);
            if (confirmSwitch) {
                try {
                    await fetch('/api/switch_character', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ character_id: targetCharId })
                    });
                    await window.triggerAppRestart(`已成功切换为【${targetCharName}】，正在重启系统...`);
                } catch (e) {
                    alert("切换请求失败: " + e);
                }
            } else {
                // 恢复原值
                loadConfig();
            }
        });
    }

    // ========== 角色管理中心与头像管理 ==========
    let cachedCharacters = [];
    let cachedActiveCharId = 'rumia';

    function renderCharacterManagementGrid(characters, activeCharId) {
        const grid = document.getElementById('character-card-grid');
        if (!grid) return;

        if (characters) cachedCharacters = characters;
        if (activeCharId) cachedActiveCharId = activeCharId;

        if (!cachedCharacters || cachedCharacters.length === 0) {
            grid.innerHTML = '<div style="text-align: center; color: #6272a4; padding: 40px; grid-column: 1 / -1;"><i class="fas fa-ghost" style="font-size: 32px; margin-bottom: 10px;"></i><br>暂无可用角色</div>';
            return;
        }

        grid.innerHTML = cachedCharacters.map(c => {
            const isActive = c.character_id === cachedActiveCharId;
            const isProtected = c.character_id === 'rumia';
            const checkboxDisabled = isActive || isProtected;
            const disableReason = isActive ? '当前活跃角色不可删除' : (isProtected ? '基础角色受保护不可删除' : '');
            
            return `
                <div class="char-manage-card ${isActive ? 'is-active' : ''}" data-id="${c.character_id}">
                    <input type="checkbox" class="char-card-checkbox" data-id="${c.character_id}" ${checkboxDisabled ? 'disabled title="' + disableReason + '"' : ''}>
                    
                    <span class="char-card-status-badge ${isActive ? 'badge-active' : 'badge-idle'}">
                        ${isActive ? '🌟 活跃中' : '💤 待命'}
                    </span>
                    
                    <img class="char-avatar-img" src="${c.avatar_url}" alt="${c.character_name}" onerror="this.src='/static/images/default_robot_avatar.svg'">
                    
                    <h3 class="char-name-title">${c.character_name}</h3>
                    <div class="char-id-tag">ID: ${c.character_id}</div>
                    
                    <div class="char-persona-desc" title="${(c.persona_prompt || '').replace(/"/g, '&quot;')}">
                        ${c.persona_prompt || '暂未填写详细人设...'}
                    </div>
                    
                    <div class="char-card-actions">
                        ${isActive ? 
                            '<button class="action-btn outline" disabled style="opacity: 0.65; cursor: default;"><i class="fas fa-check"></i> 当前活跃</button>' : 
                            `<button class="action-btn switch-char-card-btn" data-id="${c.character_id}" data-name="${c.character_name}"><i class="fas fa-exchange-alt"></i> 切换灵魂</button>`
                        }
                        <button class="action-btn outline edit-char-card-btn" data-id="${c.character_id}"><i class="fas fa-cog"></i> 角色设置</button>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定切换按钮事件
        grid.querySelectorAll('.switch-char-card-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const charId = btn.getAttribute('data-id');
                const charName = btn.getAttribute('data-name');
                const confirmSwitch = await window.asyncConfirm(`确定要切换灵魂为【${charName} (${charId})】吗？\n为保证记忆环境纯净并加载全新人设，系统将立即重启生效！`);
                if (confirmSwitch) {
                    try {
                        await fetch('/api/switch_character', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ character_id: charId })
                        });
                        await window.triggerAppRestart(`已成功切换为【${charName}】，正在重启系统...`);
                    } catch (e) {
                        alert("切换角色请求失败: " + e);
                    }
                }
            });
        });

        // 绑定角色设置按钮事件
        grid.querySelectorAll('.edit-char-card-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const charId = btn.getAttribute('data-id');
                if (charId !== cachedActiveCharId) {
                    const wantSwitch = await window.asyncConfirm(`角色设置仅作用于当前活跃角色。\n是否切换活跃角色为【${charId}】并重启系统？`);
                    if (wantSwitch) {
                        try {
                            await fetch('/api/switch_character', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ character_id: charId })
                            });
                            await window.triggerAppRestart(`已切换活跃角色为【${charId}】，正在重启系统...`);
                        } catch(e) {
                            alert("切换失败: " + e);
                        }
                    }
                } else {
                    const navCharSettings = document.querySelector('.nav-item[data-target="character-settings-view"]');
                    if (navCharSettings) navCharSettings.click();
                }
            });
        });
    }

    // 全选 / 取消全选
    const selectAllBtn = document.getElementById('char-select-all-btn');
    if (selectAllBtn) {
        let allSelected = false;
        selectAllBtn.addEventListener('click', () => {
            allSelected = !allSelected;
            const checkboxes = document.querySelectorAll('.char-card-checkbox:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = allSelected);
            selectAllBtn.innerHTML = allSelected ? '<i class="fas fa-times-circle"></i> 取消全选' : '<i class="far fa-check-square"></i> 全选';
        });
    }

    // 批量删除 (至回收站)
    const batchDeleteBtn = document.getElementById('char-batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            const checkedBoxes = Array.from(document.querySelectorAll('.char-card-checkbox:checked'));
            const selectedIds = checkedBoxes.map(cb => cb.getAttribute('data-id')).filter(Boolean);
            
            if (selectedIds.length === 0) {
                alert("请先勾选需要删除的角色（当前活跃角色与基础角色受保护不可删除）。");
                return;
            }

            const confirmDel = await window.asyncConfirm(`⚠️ 危险操作确认：\n\n即将把以下 ${selectedIds.length} 个角色移至 Windows 回收站：\n【${selectedIds.join('、')}】\n\n您可以在 Windows 回收站中随时找回数据，确认继续吗？`);
            if (!confirmDel) return;

            batchDeleteBtn.disabled = true;
            batchDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在安全删除...';

            try {
                const res = await fetch('/api/characters/batch_delete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ character_ids: selectedIds })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    alert(`🗑️ ${data.message}`);
                    loadConfig();
                } else {
                    alert(`删除失败: ${data.message || '未知错误'}`);
                }
            } catch (e) {
                console.error(e);
                alert("批量删除请求发生异常: " + e);
            } finally {
                batchDeleteBtn.disabled = false;
                batchDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> 批量删除 (至回收站)';
            }
        });
    }

    // 角色专属头像上传与重置 (在角色设置面板)
    const avatarImg = document.getElementById('current-char-avatar-img');
    const avatarInput = document.getElementById('char-avatar-file-input');
    const uploadAvatarBtn = document.getElementById('upload-char-avatar-btn');
    const resetAvatarBtn = document.getElementById('reset-char-avatar-btn');
    const avatarUploadStatus = document.getElementById('avatar-upload-status');

    function refreshAvatarPreview(charId) {
        if (avatarImg && charId) {
            avatarImg.src = `/api/characters/${charId}/avatar?t=${Date.now()}`;
        }
    }

    if (uploadAvatarBtn && avatarInput) {
        uploadAvatarBtn.addEventListener('click', () => {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const charId = cachedActiveCharId;
            const formData = new FormData();
            formData.append('file', file);

            uploadAvatarBtn.disabled = true;
            uploadAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
            if (avatarUploadStatus) {
                avatarUploadStatus.style.display = 'block';
                avatarUploadStatus.className = 'help-text';
                avatarUploadStatus.innerText = '正在上传并处理头像...';
            }

            try {
                const res = await fetch(`/api/characters/${charId}/avatar`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.status === 'success') {
                    if (avatarUploadStatus) {
                        avatarUploadStatus.className = 'help-text text-success';
                        avatarUploadStatus.innerText = '✨ 头像上传成功！';
                        setTimeout(() => { avatarUploadStatus.style.display = 'none'; }, 3000);
                    }
                    if (avatarImg) {
                        avatarImg.src = data.avatar_url || `/api/characters/${charId}/avatar?t=${Date.now()}`;
                    }
                    loadConfig();
                } else {
                    if (avatarUploadStatus) {
                        avatarUploadStatus.className = 'help-text text-danger';
                        avatarUploadStatus.innerText = '上传失败: ' + (data.message || '未知错误');
                    }
                    alert('头像上传失败: ' + (data.message || '未知错误'));
                }
            } catch (err) {
                console.error(err);
                alert('上传请求异常: ' + err);
            } finally {
                uploadAvatarBtn.disabled = false;
                uploadAvatarBtn.innerHTML = '<i class="fas fa-upload"></i> 上传新头像';
                avatarInput.value = '';
            }
        });
    }

    if (resetAvatarBtn) {
        resetAvatarBtn.addEventListener('click', async () => {
            const charId = cachedActiveCharId;
            const confirmReset = await window.asyncConfirm(`确定要恢复【${charId}】为默认机器人头像吗？`);
            if (!confirmReset) return;

            resetAvatarBtn.disabled = true;
            try {
                const res = await fetch(`/api/characters/${charId}/avatar`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.status === 'success') {
                    if (avatarImg) {
                        avatarImg.src = `/api/characters/${charId}/avatar?t=${Date.now()}`;
                    }
                    if (avatarUploadStatus) {
                        avatarUploadStatus.style.display = 'block';
                        avatarUploadStatus.className = 'help-text text-success';
                        avatarUploadStatus.innerText = '已重置为默认头像';
                        setTimeout(() => { avatarUploadStatus.style.display = 'none'; }, 3000);
                    }
                    loadConfig();
                }
            } catch (err) {
                alert('重置头像失败: ' + err);
            } finally {
                resetAvatarBtn.disabled = false;
            }
        });
    }

    // 处理多模式切换
    const modeLazyBtn = document.getElementById('mode-lazy-btn');
    const modeProBtn = document.getElementById('mode-pro-btn');
    const modeImportBtn = document.getElementById('mode-import-btn');
    const modeExportBtn = document.getElementById('mode-export-btn');
    const modeDeleteBtn = document.getElementById('mode-delete-btn');
    const formLazyMode = document.getElementById('form-lazy-mode');
    const formProMode = document.getElementById('form-pro-mode');
    const formImportMode = document.getElementById('form-import-mode');
    const formExportMode = document.getElementById('form-export-mode');
    const formDeleteMode = document.getElementById('form-delete-mode');

    function switchMode(activeBtn, activeForm) {
        [modeLazyBtn, modeProBtn, modeImportBtn, modeExportBtn, modeDeleteBtn].forEach(btn => {
            if (!btn) return;
            btn.classList.add('outline');
            btn.classList.remove('active');
        });
        [formLazyMode, formProMode, formImportMode, formExportMode, formDeleteMode].forEach(form => {
            if (!form) return;
            form.style.display = 'none';
        });
        
        if (activeBtn) {
            activeBtn.classList.remove('outline');
            activeBtn.classList.add('active');
        }
        if (activeForm) {
            activeForm.style.display = 'block';
        }
    }

    if (modeLazyBtn && modeProBtn && modeImportBtn && modeExportBtn && modeDeleteBtn) {
        modeLazyBtn.addEventListener('click', () => switchMode(modeLazyBtn, formLazyMode));
        modeProBtn.addEventListener('click', () => switchMode(modeProBtn, formProMode));
        modeImportBtn.addEventListener('click', () => switchMode(modeImportBtn, formImportMode));
        modeExportBtn.addEventListener('click', () => switchMode(modeExportBtn, formExportMode));
        modeDeleteBtn.addEventListener('click', () => switchMode(modeDeleteBtn, formDeleteMode));
    }

    // 监听角色卡文件选择并预检
    const importFileInput = document.getElementById('import-char-file');
    const importCharIdInput = document.getElementById('import-char-id');
    const importPreviewBadge = document.getElementById('import-preview-badge');
    const importDetectedTitle = document.getElementById('import-detected-title');
    const importDetectedDesc = document.getElementById('import-detected-desc');

    if (importFileInput) {
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                if (importPreviewBadge) importPreviewBadge.style.display = 'none';
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/characters/inspect_zip', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    if (data.character_id && importCharIdInput) {
                        importCharIdInput.value = data.character_id;
                    }
                    if (importPreviewBadge) {
                        importPreviewBadge.style.display = 'block';
                        importDetectedTitle.textContent = `✨ 已识别角色: 【${data.character_name || data.character_id}】 (ID: ${data.character_id})`;
                        importDetectedDesc.textContent = data.persona_prompt ? `核心人设: ${data.persona_prompt}...` : '标准角色卡，准备就绪';
                    }
                }
            } catch (err) {
                console.warn('Inspect zip failed:', err);
            }
        });
    }

    // 处理导入角色卡
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const charId = document.getElementById('import-char-id').value.trim();
            const fileInput = document.getElementById('import-char-file');
            const statusText = document.getElementById('import-status');
            
            if (!charId) {
                alert("请填写底层英文 ID！");
                return;
            }
            if (!/^[a-z0-9_]+$/.test(charId)) {
                alert("英文 ID 只能包含小写字母、数字和下划线！");
                return;
            }
            if (!fileInput.files || fileInput.files.length === 0) {
                alert("请选择要导入的角色卡压缩包！");
                return;
            }

            const confirmImport = await window.asyncConfirm(`即将解压角色卡到 "${charId}"，并配置系统资产。确认继续吗？`);
            if (!confirmImport) return;

            importBtn.disabled = true;
            statusText.style.display = 'block';
            statusText.textContent = "正在上传并解析压缩包，请稍候...";
            statusText.className = "help-text";

            try {
                const formData = new FormData();
                formData.append('char_id', charId);
                formData.append('file', fileInput.files[0]);

                const res = await fetch('/api/characters/import', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    statusText.textContent = "角色导入成功！即将刷新页面...";
                    statusText.className = "help-text text-success";
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    statusText.textContent = "导入失败: " + (data.message || "未知错误");
                    statusText.className = "help-text text-danger";
                    importBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                statusText.textContent = "网络错误，请检查后端运行状态。";
                statusText.className = "help-text text-danger";
                importBtn.disabled = false;
            }
        });
    }

    // 处理删除角色
    const deleteBtn = document.getElementById('delete-char-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const charId = document.getElementById('delete-char-id').value.trim();
            const statusText = document.getElementById('delete-status');

            if (!charId) {
                alert("请选择要销毁的角色！");
                return;
            }

            const confirmDelete = await window.asyncConfirm(`【警告】即将永久销毁角色 "${charId}"，包括其所有资源文件、记忆、预设。\n此操作不可逆，请确认是否继续？`);
            if (!confirmDelete) return;

            const finalConfirm = await window.asyncConfirm(`再次确认：你真的要删除 "${charId}" 吗？`);
            if (!finalConfirm) return;

            deleteBtn.disabled = true;
            statusText.style.display = 'block';
            statusText.textContent = "正在执行销毁操作，请稍候...";
            statusText.className = "help-text";

            try {
                const res = await fetch(`/api/characters/${encodeURIComponent(charId)}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    statusText.textContent = "角色销毁成功！即将刷新页面...";
                    statusText.className = "help-text text-success";
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    statusText.textContent = "销毁失败: " + (data.message || "未知错误");
                    statusText.className = "help-text text-danger";
                    deleteBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                statusText.textContent = "网络错误，请检查后端运行状态。";
                statusText.className = "help-text text-danger";
                deleteBtn.disabled = false;
            }
        });
    }

    // 处理新角色生成 (懒人模式)
    const generateBtn = document.getElementById('generate-soul-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('new-char-name').value.trim();
            const descInput = document.getElementById('new-char-desc').value.trim();
            const statusText = document.getElementById('generate-status');
            
            if (!nameInput || !descInput) {
                alert("请填写角色名字和特质描述！");
                return;
            }

            const confirmGen = await window.asyncConfirm("将请求大模型提炼设定并创建底层文件，该过程大概需要10-20秒，确认开始吗？");
            if (!confirmGen) return;

            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在请求大模型塑魂...';
            statusText.style.display = 'block';

            try {
                const response = await fetch('/api/characters/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        mode: 'lazy',
                        name: nameInput, 
                        description: descInput 
                    })
                });
                
                const data = await response.json();
                if (data.status === 'success') {
                    alert(`✨ 灵魂注入成功！\n\n大贤者已在后台为您建好了名为【${data.character_id}】的灵魂容器。\n\n⚠️ 重要最后一步：\n请前往 services/static/images/${data.character_id}/ 目录，放入 15 张对应表情动作的立绘（详情见文档）。\n完成后点击左下角【重启大贤者】，即可在主页切换到您的新角色！`);
                    // 重新加载列表
                    loadConfig();
                    document.getElementById('new-char-name').value = '';
                    document.getElementById('new-char-desc').value = '';
                } else {
                    alert("生成失败: " + data.message);
                }
            } catch (e) {
                console.error(e);
                alert("请求失败，请检查网络或控制台报错。");
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-magic"></i> 开始炼丹 (交由大模型处理)';
                statusText.style.display = 'none';
            }
        });
    }

    // 处理新角色构建 (构建模式)
    const generateProBtn = document.getElementById('generate-pro-btn');
    if (generateProBtn) {
        generateProBtn.addEventListener('click', async () => {
            const charId = document.getElementById('pro-char-id').value.trim().toLowerCase();
            const charName = document.getElementById('pro-char-name').value.trim();
            const personaPrompt = document.getElementById('pro-persona-prompt').value.trim();
            const themeColor = document.getElementById('pro-theme-color').value.trim();
            const statusText = document.getElementById('generate-pro-status');
            
            if (!charId || !charName) {
                alert("英文唯一 ID 和中文角色名为必填项！");
                return;
            }

            // 校验 ID 格式 (仅小写字母、数字和下划线)
            if (!/^[a-z0-9_]+$/.test(charId)) {
                alert("英文唯一 ID 只能包含小写英文字母、数字和下划线！");
                return;
            }

            const confirmGen = await window.asyncConfirm(`即将从母本样本克隆沙盒副本【${charName} (${charId})】并即刻切换，确认启动构建吗？`);
            if (!confirmGen) return;

            generateProBtn.disabled = true;
            generateProBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在克隆母本并初始化...';
            statusText.style.display = 'block';
            statusText.innerText = '正在构建沙盒副本...';

            try {
                const response = await fetch('/api/characters/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        mode: 'construct',
                        character_id: charId,
                        character_name: charName,
                        persona_prompt: personaPrompt,
                        theme_color: themeColor
                    })
                });
                
                const data = await response.json();
                if (data.status === 'success') {
                    statusText.innerText = '沙盒副本已构建完成！';
                    alert(`✨ 角色【${data.character_name}】构建成功！\n\n大贤者已为您克隆纯净母本副本（集成莉莉白 7 表动态数据库与露米娅静态/Live2D 双皮肤），并已自动将全局活跃角色切换为【${data.character_name}】！\n\n页面即将刷新，您可以立即在「专属预设」、「动态数据库」、「立绘设置」等页面随意定制！`);
                    window.location.reload();
                } else {
                    statusText.innerText = '构建失败';
                    alert("构建失败: " + (data.message || "未知错误"));
                }
            } catch (e) {
                console.error(e);
                statusText.innerText = '构建失败';
                alert("请求失败，请检查网络或控制台报错。");
            } finally {
                generateProBtn.disabled = false;
                generateProBtn.innerHTML = '<i class="fas fa-rocket"></i> 🚀 启动构建工作台 (克隆样本并即刻切换)';
                setTimeout(() => { statusText.style.display = 'none'; }, 3000);
            }
        });
    }

    // ========== 日常模式：图表和聊天记录相关逻辑 ==========
    const previewBtn = document.getElementById('preview-prompt-btn');
    const previewModal = document.getElementById('preview-modal');
    const closePreviewBtn = document.getElementById('close-preview-btn');
    const previewLoading = document.getElementById('preview-loading');
    
    // Tab contents
    const previewContentPre = document.getElementById('preview-content-area-pre');
    const previewContentMain = document.getElementById('preview-content-area-main');
    const previewContentPost = document.getElementById('preview-content-area-post');
    const tabBtns = document.querySelectorAll('#preview-modal .tab-btn');
    const tabContents = document.querySelectorAll('#preview-modal .tab-content');

    let currentPreviewData = null;

    // Tab switching logic
    if (tabBtns) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-target');
                document.getElementById(targetId).classList.add('active');
            });
        });
    }

    function formatMessages(messages, hideHistory) {
        if (!messages) return "";
        let html = "";
        messages.forEach(msg => {
            if (hideHistory && msg.is_history) return;
            html += `${msg.role_name}\n${msg.content}\n\n=======================================================================\n\n`;
        });
        return html;
    }

    function renderPreview() {
        const hideHistory = document.getElementById('hide-history-toggle') ? document.getElementById('hide-history-toggle').checked : false;
        if (!currentPreviewData) return;
        
        if (previewContentPre) previewContentPre.innerText = formatMessages(currentPreviewData.pre_messages, hideHistory);
        if (previewContentMain) previewContentMain.innerText = formatMessages(currentPreviewData.main_messages, hideHistory);
        if (previewContentPost) previewContentPost.innerText = formatMessages(currentPreviewData.post_messages, hideHistory);
    }

    if (document.getElementById('hide-history-toggle')) {
        document.getElementById('hide-history-toggle').addEventListener('change', renderPreview);
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            previewModal.classList.remove('hidden');
            if (previewContentPre) previewContentPre.innerText = '';
            if (previewContentMain) previewContentMain.innerText = '';
            if (previewContentPost) previewContentPost.innerText = '';
            previewLoading.classList.remove('hidden');

            try {
                const response = await fetch('/api/settings/preview_prompt');
                const data = await response.json();
                previewLoading.classList.add('hidden');
                
                if (data.success) {
                    currentPreviewData = data;
                    renderPreview();
                } else {
                    if (previewContentMain) previewContentMain.innerText = `生成失败: ${data.error || '未知错误'}`;
                }
            } catch (e) {
                console.error(e);
                previewLoading.classList.add('hidden');
                if (previewContentMain) previewContentMain.innerText = "请求失败，请检查后端运行状态。";
            }
        });
    }

    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewModal.classList.add('hidden');
        });
    }

    // 点击模态框背景关闭
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.add('hidden');
        }
    });

    // ========== 重启应用 ==========
    const restartBtn = document.getElementById('restart-app-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', async () => {
            const confirmRestart = await window.asyncConfirm("确定要重新启动大贤者系统吗？\n如果程序没有自动打开，请手动双击启动！");
            if (confirmRestart) {
                if (typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('restart-app');
                } else {
                    alert("当前非 Electron 环境，请手动重启");
                }
            }
        });
    }

    // ========== 每日回忆 (日记) ==========
    const logDateSelect = document.getElementById('log-date-select');
    const logContentArea = document.getElementById('log-content-area');
    const subtabChat = document.getElementById('subtab-chat');
    const subtabDiary = document.getElementById('subtab-diary');
    const rewriteDiaryBtn = document.getElementById('rewrite-diary-btn');

    let currentChatLog = "";
    let currentDiary = "";

    async function loadLogsList() {
        logDateSelect.innerHTML = '<option value="">加载中...</option>';
        try {
            const response = await fetch('/api/settings/logs');
            const data = await response.json();
            if (data.success && data.dates && data.dates.length > 0) {
                logDateSelect.innerHTML = '';
                data.dates.forEach(date => {
                    const opt = document.createElement('option');
                    opt.value = date;
                    opt.innerText = date;
                    logDateSelect.appendChild(opt);
                });
            } else {
                logDateSelect.innerHTML = '<option value="">暂无记录</option>';
            }
        } catch (e) {
            logDateSelect.innerHTML = '<option value="">加载失败</option>';
        }
    }

    logDateSelect.addEventListener('change', async () => {
        const val = logDateSelect.value;
        if (!val) return;

        logContentArea.innerText = '正在读取回忆中...';
        try {
            const response = await fetch(`/api/settings/logs/${val}`);
            const data = await response.json();
            if (data.success) {
                currentChatLog = data.chat_content || "";
                currentDiary = data.diary_content || "";
                switchLogTab('chat');
                rewriteDiaryBtn.style.display = 'inline-flex';
            } else {
                logContentArea.innerText = `读取回忆失败: ${data.error || '未知错误'}`;
                rewriteDiaryBtn.style.display = 'none';
            }
        } catch (e) {
            logContentArea.innerText = '加载回忆失败，请稍后重试。';
        }
    });

    function renderWechatStyleLog(logText) {
        const container = document.createElement('div');
        container.className = 'wechat-chat-container';
        
        const lines = logText.split('\n');
        let lastTime = '';
        let currentMsg = null;

        const flushMsg = () => {
            if (!currentMsg) return;
            const timeStr = currentMsg.time.substring(0, 5); // HH:MM
            if (timeStr !== lastTime) {
                const timeDiv = document.createElement('div');
                timeDiv.className = 'wechat-timestamp';
                timeDiv.textContent = timeStr;
                container.appendChild(timeDiv);
                lastTime = timeStr;
            }
            
            const isUser = currentMsg.sender.toLowerCase() === 'you' || currentMsg.sender.toLowerCase().includes('you ') || currentMsg.sender === '你' || currentMsg.sender.toLowerCase() === 'user';
            
            const row = document.createElement('div');
            row.className = 'wechat-msg-row ' + (isUser ? 'is-user' : 'is-bot');
            
            const avatar = document.createElement('div');
            avatar.className = 'wechat-avatar';
            if (isUser) {
                avatar.innerHTML = '<i class="fas fa-user" style="color:#282a36; font-size:20px; line-height:36px; text-align:center; width:100%;"></i>';
                avatar.style.background = '#50fa7b';
            } else {
                avatar.innerHTML = '<i class="fas fa-robot" style="color:#f8f8f2; font-size:20px; line-height:36px; text-align:center; width:100%;"></i>';
                avatar.style.background = '#6272a4';
            }
            
            const msgContent = document.createElement('div');
            msgContent.className = 'wechat-msg-content';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'wechat-sender-name';
            nameDiv.textContent = isUser ? '你' : currentMsg.sender.replace(/\(.*?\)/g, '').trim();
            
            const bubble = document.createElement('div');
            bubble.className = 'wechat-bubble';
            bubble.innerHTML = currentMsg.content.replace(/\n/g, '<br>');
            
            msgContent.appendChild(nameDiv);
            msgContent.appendChild(bubble);
            
            row.appendChild(avatar);
            row.appendChild(msgContent);
            
            container.appendChild(row);
            currentMsg = null;
        };
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            const isNewEntry = /^\[\d{2}:\d{2}:\d{2}\]/.test(line);
            
            if (isNewEntry) {
                flushMsg();
                
                const match = line.match(/^\[(.*?)\]\s+(.*?)(?::|：)\s*(.*)$/);
                if (match && !match[2].includes('[物理互动]') && !match[2].includes('[系统]')) {
                    currentMsg = {
                        time: match[1],
                        sender: match[2].trim(),
                        content: match[3]
                    };
                } else {
                    const sysMsg = document.createElement('div');
                    sysMsg.className = 'wechat-timestamp';
                    sysMsg.textContent = line;
                    container.appendChild(sysMsg);
                }
            } else {
                if (currentMsg) {
                    currentMsg.content += '\n' + line;
                } else {
                    const sysMsg = document.createElement('div');
                    sysMsg.className = 'wechat-timestamp';
                    sysMsg.textContent = line;
                    container.appendChild(sysMsg);
                }
            }
        }
        flushMsg();
        
        return container;
    }

    function switchLogTab(tab) {
        if (tab === 'chat') {
            subtabChat.classList.add('active');
            subtabDiary.classList.remove('active');
            if (!currentChatLog) {
                logContentArea.innerText = "今天没有聊天对话记录哦。";
            } else {
                logContentArea.innerHTML = '';
                logContentArea.appendChild(renderWechatStyleLog(currentChatLog));
            }
            logContentArea.scrollTop = logContentArea.scrollHeight;
        } else {
            subtabChat.classList.remove('active');
            subtabDiary.classList.add('active');
            logContentArea.innerText = currentDiary || "今天没有写日记哦……";
            logContentArea.scrollTop = 0;
        }
    }

    subtabChat.addEventListener('click', () => switchLogTab('chat'));
    subtabDiary.addEventListener('click', () => switchLogTab('diary'));

    rewriteDiaryBtn.addEventListener('click', async () => {
        const val = logDateSelect.value;
        if (!val) return;
        if (!await window.asyncConfirm(`确定要重写 ${val} 的日记吗？`)) return;

        rewriteDiaryBtn.disabled = true;
        const oldHtml = rewriteDiaryBtn.innerHTML;
        rewriteDiaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重写中...';
        currentDiary = "正在努力重写日记中，请稍候...";
        switchLogTab('diary');

        try {
            const response = await fetch(`/api/settings/logs/${val}/rewrite`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                currentDiary = data.diary_content || "";
                switchLogTab('diary');
                alert("日记重写完成！");
            } else {
                alert(`重写失败: ${data.error}`);
            }
        } catch (e) {
            alert("请求失败！");
        } finally {
            rewriteDiaryBtn.disabled = false;
            rewriteDiaryBtn.innerHTML = oldHtml;
        }
    });

    // ========== 导出角色 ==========
    const btnExportCharacter = document.getElementById('btn-export-character');
    if (btnExportCharacter) {
        btnExportCharacter.addEventListener('click', async () => {
            const exportMemory = document.getElementById('export-memory-chk').checked;
            const exportDatabank = document.getElementById('export-databank-chk').checked;
            const statusText = document.getElementById('export-status-text');
            
            btnExportCharacter.disabled = true;
            statusText.style.display = 'block';
            statusText.className = 'help-text';
            statusText.innerText = '正在封装，请稍候...';
            
            try {
                // Determine current active character
                const charRes = await fetch('/api/character_info');
                const charData = await charRes.json();
                const charId = charData.character_id;
                
                const response = await fetch('/api/characters/export', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        char_id: charId,
                        export_memory: exportMemory,
                        export_databank: exportDatabank
                    })
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${charId}_export.zip`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    
                    statusText.className = 'help-text text-success';
                    statusText.innerText = '打包完成并已触发下载！';
                } else {
                    const errData = await response.json();
                    statusText.className = 'help-text text-danger';
                    statusText.innerText = `导出失败: ${errData.message || '未知错误'}`;
                }
            } catch (e) {
                statusText.className = 'help-text text-danger';
                statusText.innerText = `导出异常: ${e.message}`;
            } finally {
                btnExportCharacter.disabled = false;
            }
        });
    }

    // ========== 人格海 (RAG记忆向量星图) ==========
    let network = null;
    let selectedNodeId = null;
    const manualDistillBtn = document.getElementById('manual-distill-btn');
    const seedTestBtn = document.getElementById('seed-test-btn');
    const refreshGraphBtn = document.getElementById('refresh-graph-btn');
    const deleteNodeBtn = document.getElementById('delete-node-btn');
    const graphSearchInput = document.getElementById('graph-search-input');
    const infoCard = document.getElementById('graph-info-card');
    const infoTitle = document.getElementById('info-node-title');
    const infoContent = document.getElementById('info-node-content');

    async function loadMemoryGraph() {
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        container.innerHTML = '<div style="color:#8be9fd; padding: 40px; text-align:center; font-size:1.1em;"><i class="fas fa-spinner fa-spin"></i> 正在潜入人格海，扫描向量神经网络分布...</div>';
        
        try {
            const response = await fetch('/api/settings/memory_graph');
            const data = await response.json();

            if (!data.success) {
                container.innerHTML = `<div style="color:#ff5555; padding: 30px; text-align:center;">人格海星图读取失败: ${data.error}</div>`;
                return;
            }

            if (!data.nodes || data.nodes.length === 0) {
                container.innerHTML = `
                    <div style="color: #8be9fd; padding: 60px 20px; text-align: center;">
                        <i class="fas fa-water" style="font-size: 3em; color: rgba(139,233,253,0.4); margin-bottom: 15px;"></i>
                        <h3 style="margin: 5px 0;">当前角色人格海尚处于沉睡状态（0 个记忆节点）</h3>
                        <p style="color: #aaa; font-size: 0.9em;">快去和桌宠聊聊天，或者点击上方【注入测试回忆】唤醒她的人格海星图吧！</p>
                    </div>`;
                return;
            }

            const nodes = new vis.DataSet(data.nodes || []);
            const edges = new vis.DataSet(data.edges || []);
            const graphData = { nodes: nodes, edges: edges };

            const options = {
                nodes: {
                    borderWidth: 2,
                    font: { face: 'Segoe UI, Microsoft YaHei' }
                },
                edges: {
                    width: 2,
                    smooth: { type: 'continuous' }
                },
                physics: {
                    barnesHut: { gravitationalConstant: -2500, centralGravity: 0.3, springLength: 110, springConstant: 0.04 },
                    minVelocity: 0.75
                },
                interaction: { hover: true, tooltipDelay: 150 }
            };

            container.innerHTML = '';
            network = new vis.Network(container, graphData, options);

            network.on("click", function (params) {
                if (params.nodes.length > 0) {
                    selectedNodeId = params.nodes[0];
                    const node = nodes.get(selectedNodeId);
                    if (node) {
                        infoCard.classList.remove('hidden');
                        infoTitle.innerText = node.label || '记忆节点';
                        infoContent.innerText = node.title || node.label || '暂无详细文本';
                    }
                } else {
                    selectedNodeId = null;
                    infoCard.classList.add('hidden');
                }
            });

            // 搜索过滤支持
            if (graphSearchInput) {
                graphSearchInput.oninput = () => {
                    const query = graphSearchInput.value.trim().lower();
                    if (!query) return;
                    const matchedNodes = nodes.get().filter(n => 
                        (n.label && n.label.toLowerCase().includes(query)) || 
                        (n.title && n.title.toLowerCase().includes(query))
                    );
                    if (matchedNodes.length > 0) {
                        network.selectNodes(matchedNodes.map(n => n.id));
                        network.focus(matchedNodes[0].id, { scale: 1.2, animation: true });
                    }
                };
            }

        } catch (error) {
            container.innerHTML = `<div style="color:#ff5555; padding: 30px; text-align:center;">网络连接超时，人格海无法拉取。</div>`;
        }
    }

    if (refreshGraphBtn) refreshGraphBtn.addEventListener('click', loadMemoryGraph);

    if (deleteNodeBtn) {
        deleteNodeBtn.addEventListener('click', async () => {
            if (!selectedNodeId) return;
            if (!await window.asyncConfirm("确定要从人格海中彻底擦除该条记忆向量节点吗？此操作无法撤销。")) return;
            try {
                const res = await fetch(`/api/settings/memory_node/${encodeURIComponent(selectedNodeId)}`, { method: 'DELETE' });
                const d = await res.json();
                if (d.success) {
                    alert(d.message);
                    infoCard.classList.add('hidden');
                    selectedNodeId = null;
                    loadMemoryGraph();
                } else {
                    alert("擦除失败: " + d.error);
                }
            } catch (err) {
                alert("请求擦除失败!");
            }
        });
    }

    async function manualDistill(isTest = false) {
        if (!isTest && !await window.asyncConfirm("这将会消耗部分 API Token 将今天的聊天记录压缩为日记记忆实体，是否继续？")) return;
        
        const btn = isTest ? seedTestBtn : manualDistillBtn;
        if (!btn) return;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在处理...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/settings/memory_distill_now', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ seed_test: isTest })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadMemoryGraph();
            } else {
                alert("失败: " + data.error);
            }
        } catch (e) {
            alert("请求异常！");
        } finally {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }

    if (manualDistillBtn) manualDistillBtn.addEventListener('click', () => manualDistill(false));
    if (seedTestBtn) seedTestBtn.addEventListener('click', () => manualDistill(true));

    // 绑定 Nav Item 点击自动加载人格海
    const graphNavItem = document.querySelector('.nav-item[data-target="graph-view"]');
    if (graphNavItem) {
        graphNavItem.addEventListener('click', () => {
            setTimeout(loadMemoryGraph, 100);
        });
    }
});


// ==========================================
// 预设准备 (Presets Manager) 逻辑
// ==========================================

let globalPresetsData = [];
let customPresetsData = [];

function loadPresets() {
    fetch('/api/presets/list')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                globalPresetsData = data.global || [];
                customPresetsData = data.custom || [];
                renderPresetsList('global', globalPresetsData, 'global-presets-list');
                renderPresetsList('custom', customPresetsData, 'custom-presets-list');
            }
        })
        .catch(err => console.error("Load presets failed:", err));
}

function renderPresetsList(type, data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); padding: 10px;">暂无预设</div>';
        return;
    }
    
    container.innerHTML = '';
    data.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        
        // Badges
        let badgesHtml = '';
        if (preset.always_active) badgesHtml += '<span class="preset-badge active">Always Active</span>';
        if (preset.min_favorability !== undefined && preset.min_favorability !== null) badgesHtml += `<span class="preset-badge">Fav ≥ ${preset.min_favorability}</span>`;
        if (preset.max_favorability !== undefined && preset.max_favorability !== null) badgesHtml += `<span class="preset-badge">Fav ≤ ${preset.max_favorability}</span>`;
        if (preset.disable) badgesHtml += '<span class="preset-badge disabled">Disabled</span>';
        
        let kwStr = (preset.trigger_keywords && preset.trigger_keywords.length) ? preset.trigger_keywords.join(', ') : '';
        
        item.innerHTML = `
            <div class="preset-header">
                <div>
                    <div class="preset-title">
                        ${preset.name}
                    </div>
                    <div class="preset-badges" style="margin-top: 5px;">${badgesHtml}</div>
                </div>
                <div class="preset-actions">
                    <button class="preset-btn edit" onclick="editPreset('${type}', '${preset.name}')" title="编辑"><i class="fas fa-pen"></i></button>
                    <button class="preset-btn delete" onclick="deletePreset('${type}', '${preset.name}')" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function showPresetModal(type, preset = null) {
    document.getElementById('preset-modal').classList.remove('hidden');
    document.getElementById('preset-type').value = type;
    
    if (preset) {
        document.getElementById('preset-modal-title').innerHTML = '<i class="fas fa-edit"></i> 编辑预设';
        document.getElementById('preset-original-name').value = preset.name;
        document.getElementById('preset-name').value = preset.name;
        document.getElementById('preset-keywords').value = (preset.trigger_keywords || preset.key || []).join(', ');
        document.getElementById('preset-secondary-keywords').value = (preset.secondary_keywords || preset.keysecondary || []).join(', ');
        document.getElementById('preset-min-fav').value = preset.min_favorability !== undefined ? preset.min_favorability : '';
        document.getElementById('preset-max-fav').value = preset.max_favorability !== undefined ? preset.max_favorability : '';
        document.getElementById('preset-position').value = preset.position !== undefined ? preset.position : '1';
        document.getElementById('preset-order').value = preset.order !== undefined ? preset.order : '100';
        document.getElementById('preset-always-active').checked = !!(preset.always_active || preset.constant);
        document.getElementById('preset-disable').checked = !!preset.disable;
        document.getElementById('preset-prevent-recursion').checked = !!preset.prevent_recursion;
        document.getElementById('preset-prompt').value = preset.prompt || preset.content || '';
        document.getElementById('preset-source').value = preset.worldbook_source || '原生';
    } else {
        document.getElementById('preset-modal-title').innerHTML = '<i class="fas fa-plus"></i> 新增预设';
        document.getElementById('preset-original-name').value = '';
        document.getElementById('preset-name').value = '';
        document.getElementById('preset-keywords').value = '';
        document.getElementById('preset-secondary-keywords').value = '';
        document.getElementById('preset-min-fav').value = '';
        document.getElementById('preset-max-fav').value = '';
        document.getElementById('preset-position').value = '1';
        document.getElementById('preset-order').value = '100';
        document.getElementById('preset-always-active').checked = false;
        document.getElementById('preset-disable').checked = false;
        document.getElementById('preset-prevent-recursion').checked = false;
        document.getElementById('preset-prompt').value = '';
        document.getElementById('preset-source').value = '原生';
    }
}

function hidePresetModal() {
    document.getElementById('preset-modal').classList.add('hidden');
}

function editPreset(type, name) {
    const list = type === 'global' ? globalPresetsData : customPresetsData;
    const preset = list.find(p => p.name === name);
    if (preset) showPresetModal(type, preset);
}

async function deletePreset(type, name) {
    if (await window.asyncConfirm(`确定要删除预设 "${name}" 吗？此操作不可恢复。`)) {
        fetch('/api/presets/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ type, name })
        }).then(res => res.json()).then(data => {
            if (data.success) loadPresets();
            else alert("删除失败：" + data.error);
        });
    }
}

// Bind Events
document.addEventListener('DOMContentLoaded', () => {
    // Hooks for Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'global-presets-view' || target === 'custom-presets-view') {
                loadPresets();
            }
        });
    });

    const btnAddGlobal = document.getElementById('btn-add-global-preset');
    if (btnAddGlobal) btnAddGlobal.addEventListener('click', () => showPresetModal('global'));
    
    const btnAddCustom = document.getElementById('btn-add-custom-preset');
    if (btnAddCustom) btnAddCustom.addEventListener('click', () => showPresetModal('custom'));
    
    const btnClosePresetModal = document.getElementById('close-preset-modal-btn');
    if (btnClosePresetModal) btnClosePresetModal.addEventListener('click', hidePresetModal);
    
    const btnCancelPreset = document.getElementById('btn-cancel-preset');
    if (btnCancelPreset) btnCancelPreset.addEventListener('click', hidePresetModal);
    
    const alwaysActiveCheckbox = document.getElementById('preset-always-active');
    const disableCheckbox = document.getElementById('preset-disable');
    
    if (alwaysActiveCheckbox && disableCheckbox) {
        alwaysActiveCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) disableCheckbox.checked = false;
        });
        disableCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) alwaysActiveCheckbox.checked = false;
        });
    }
    
    const btnSavePreset = document.getElementById('btn-save-preset');
    if (btnSavePreset) {
        btnSavePreset.addEventListener('click', () => {
            const type = document.getElementById('preset-type').value;
            const originalName = document.getElementById('preset-original-name').value;
            const name = document.getElementById('preset-name').value.trim();
            const keywordsStr = document.getElementById('preset-keywords').value.trim();
            const secKeywordsStr = document.getElementById('preset-secondary-keywords').value.trim();
            const minFav = document.getElementById('preset-min-fav').value;
            const maxFav = document.getElementById('preset-max-fav').value;
            const position = document.getElementById('preset-position').value;
            const order = document.getElementById('preset-order').value;
            const alwaysActive = document.getElementById('preset-always-active').checked;
            const disablePreset = document.getElementById('preset-disable').checked;
            const preventRecursion = document.getElementById('preset-prevent-recursion').checked;
            const source = document.getElementById('preset-source').value;
            const prompt = document.getElementById('preset-prompt').value.trim();
            
            if (!name || !prompt) {
                alert("预设名称和提示词为必填项！");
                return;
            }
            
            // Delete original first if name changed
            if (originalName && originalName !== name) {
                // To safely rename, we should ideally do it in one atomic transaction, 
                // but since it's local, we can just delete and then save.
                fetch('/api/presets/delete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ type, name: originalName })
                });
            }
            
            const presetObj = {
                name: name,
                prompt: prompt,
                always_active: alwaysActive,
                disable: disablePreset,
                prevent_recursion: preventRecursion,
                worldbook_source: source,
                position: parseInt(position, 10) || 1,
                order: parseInt(order, 10) || 100
            };
            
            if (keywordsStr) presetObj.trigger_keywords = keywordsStr.split(',').map(s => s.trim()).filter(s => s);
            if (secKeywordsStr) presetObj.secondary_keywords = secKeywordsStr.split(',').map(s => s.trim()).filter(s => s);
            if (minFav !== '') presetObj.min_favorability = parseInt(minFav, 10);
            if (maxFav !== '') presetObj.max_favorability = parseInt(maxFav, 10);
            
            btnSavePreset.disabled = true;
            btnSavePreset.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            fetch('/api/presets/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ type, preset: presetObj })
            }).then(res => res.json()).then(data => {
                btnSavePreset.disabled = false;
                btnSavePreset.innerHTML = '<i class="fas fa-save"></i> 保存';
                
                if (data.success) {
                    hidePresetModal();
                    loadPresets();
                } else {
                    alert("保存失败：" + data.error);
                }
            });
        });
    }

    // Worldbook Import Logic
    const btnImportWorldbookCustom = document.getElementById('btn-import-worldbook');
    const btnImportWorldbookGlobal = document.getElementById('btn-import-worldbook-global');
    const uploadInput = document.getElementById('worldbook-upload-input');
    
    let importTargetType = 'custom';
    let currentImportBtn = null;
    let currentImportBtnOldHtml = '';
    
    if (uploadInput) {
        if (btnImportWorldbookCustom) {
            btnImportWorldbookCustom.addEventListener('click', () => {
                importTargetType = 'custom';
                currentImportBtn = btnImportWorldbookCustom;
                uploadInput.click();
            });
        }
        
        if (btnImportWorldbookGlobal) {
            btnImportWorldbookGlobal.addEventListener('click', () => {
                importTargetType = 'global';
                currentImportBtn = btnImportWorldbookGlobal;
                uploadInput.click();
            });
        }
        
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (currentImportBtn) {
                currentImportBtnOldHtml = currentImportBtn.innerHTML;
                currentImportBtn.disabled = true;
                currentImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', importTargetType);
            
            fetch('/api/worldbook/import', {
                method: 'POST',
                body: formData
            }).then(res => res.json()).then(data => {
                if (currentImportBtn) {
                    currentImportBtn.disabled = false;
                    currentImportBtn.innerHTML = currentImportBtnOldHtml;
                }
                uploadInput.value = ''; // clear
                
                if (data.success) {
                    alert(`成功导入 ${data.count} 条世界书设定到 ${importTargetType === 'global' ? '公用预设' : '专属预设'}！`);
                    loadPresets();
                } else {
                    alert("导入失败：" + data.error);
                }
            }).catch(err => {
                if (currentImportBtn) {
                    currentImportBtn.disabled = false;
                    currentImportBtn.innerHTML = currentImportBtnOldHtml;
                }
                uploadInput.value = '';
                alert("上传发生错误：" + err);
            });
        });
    }

    // ================== DataBank 渲染逻辑 ==================
    let currentDataBank = null;
    let currentSheetId = null;
    
    // --- 模板 GUI 状态 ---
    let currentTemplateRaw = null;
    let tplCurrentSheetId = null;
    
    // --- 模式切换逻辑 ---
    const modeDataBtn = document.getElementById('mode-data-btn');
    const modeTemplateBtn = document.getElementById('mode-template-btn');
    const dataModeContainer = document.getElementById('databank-data-mode');
    const templateModeContainer = document.getElementById('databank-template-mode');

    if(modeDataBtn && modeTemplateBtn) {
        modeDataBtn.addEventListener('click', () => {
            modeDataBtn.classList.add('active');
            modeDataBtn.classList.remove('outline');
            modeTemplateBtn.classList.remove('active');
            modeTemplateBtn.classList.add('outline');
            dataModeContainer.style.display = 'flex';
            templateModeContainer.style.display = 'none';
        });

        modeTemplateBtn.addEventListener('click', () => {
            modeTemplateBtn.classList.add('active');
            modeTemplateBtn.classList.remove('outline');
            modeDataBtn.classList.remove('active');
            modeDataBtn.classList.add('outline');
            dataModeContainer.style.display = 'none';
            templateModeContainer.style.display = 'flex';
            loadTemplateRaw();
        });
    }

    // ==========================================
    // DATA MODE (数据编辑模式)
    // ==========================================
    window.loadDataBank = function() {
        fetch('/api/databank')
            .then(res => res.json())
            .then(res => {
                if(res.status === 'success') {
                    currentDataBank = res.data;
                    renderDataBankSidebar(currentDataBank);
                } else {
                    document.getElementById('databank-empty-state').innerHTML = `<p style="color:red"><i class="fas fa-exclamation-triangle"></i> ${res.message}</p>`;
                }
            })
            .catch(err => {
                console.error("加载DataBank失败", err);
                document.getElementById('databank-empty-state').innerHTML = `<p style="color:red"><i class="fas fa-times-circle"></i> 请求失败</p>`;
            });
    }

    const refreshBtn = document.getElementById('refresh-databank-btn');
    if(refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if(window.loadDataBank) window.loadDataBank();
            if (templateModeContainer && templateModeContainer.style.display !== 'none') {
                loadTemplateRaw();
            }
        });
    }

    function renderDataBankSidebar(data) {
        const listEl = document.getElementById('databank-sheet-list');
        listEl.innerHTML = '';
        const keys = Object.keys(data).filter(k => k.startsWith('sheet_'));
        
        if (keys.length === 0) {
            listEl.innerHTML = '<li style="color:var(--text-secondary); text-align:center;">暂无数据表</li>';
            document.getElementById('databank-empty-state').style.display = 'block';
            document.getElementById('databank-table-container').style.display = 'none';
            currentSheetId = null;
            return;
        }

        let firstLi = null;
        let selectedLi = null;

        keys.forEach((key, index) => {
            const sheet = data[key];
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.margin = '5px 0';
            li.style.background = 'var(--bg-primary)';
            li.style.borderRadius = 'var(--border-radius)';
            li.style.cursor = 'pointer';
            li.style.transition = 'all 0.2s';
            li.innerHTML = `<strong>${sheet.name}</strong>`;
            
            li.addEventListener('mouseenter', () => li.style.transform = 'translateX(5px)');
            li.addEventListener('mouseleave', () => li.style.transform = 'none');
            
            li.addEventListener('click', () => {
                document.querySelectorAll('#databank-sheet-list li').forEach(el => el.style.borderLeft = 'none');
                li.style.borderLeft = '3px solid var(--accent-color)';
                currentSheetId = key;
                renderDataBankTable(sheet);
            });
            listEl.appendChild(li);
            
            if (index === 0) firstLi = li;
            if (key === currentSheetId) selectedLi = li;
        });

        if (selectedLi) selectedLi.click();
        else if (firstLi) firstLi.click();
    }

    function renderDataBankTable(sheet) {
        document.getElementById('databank-empty-state').style.display = 'none';
        document.getElementById('databank-table-container').style.display = 'flex';
        document.getElementById('databank-table-title').textContent = sheet.name;
        
        const tableEl = document.getElementById('databank-table');
        tableEl.innerHTML = '';
        
        const content = sheet.content || [];
        if (content.length === 0) {
            tableEl.innerHTML = '<tr><td colspan="100%" style="text-align:center;">此表暂无数据(包含表头)</td></tr>';
            return;
        }
        
        // 渲染表头 (数据模式下不允许修改表头，锁定)
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        content[0].forEach(cellText => {
            const th = document.createElement('th');
            th.textContent = cellText;
            headerRow.appendChild(th);
        });
        const opTh = document.createElement('th');
        opTh.textContent = "操作";
        opTh.style.width = "80px";
        opTh.style.textAlign = "center";
        headerRow.appendChild(opTh);
        thead.appendChild(headerRow);
        tableEl.appendChild(thead);
        
        // 渲染数据体
        const tbody = document.createElement('tbody');
        for (let i = 1; i < content.length; i++) {
            const tr = createDataRow(content[i]);
            tbody.appendChild(tr);
        }
        tableEl.appendChild(tbody);
    }

    window.createDataRowGlobal = function(rowData) { return createDataRow(rowData); };

    function createDataRow(rowData) {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.style.transition = 'background-color 0.2s';
        tr.addEventListener('mouseenter', () => tr.style.backgroundColor = 'rgba(255,255,255,0.05)');
        tr.addEventListener('mouseleave', () => tr.style.backgroundColor = 'transparent');
        
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // Ignore if clicking action buttons
            if (typeof openDataRowModal === 'function') {
                openDataRowModal(tr);
            }
        });

        rowData.forEach(cellText => {
            const td = document.createElement('td');
            td.textContent = cellText;
            tr.appendChild(td);
        });
        
        const opTd = document.createElement('td');
        opTd.style.textAlign = 'center';
        opTd.innerHTML = `<button class="action-btn danger" style="padding:2px 5px; min-width:unset;" title="删除此行"><i class="fas fa-trash"></i></button>`;
        opTd.querySelector('button').addEventListener('click', async (e) => {
            e.stopPropagation();
            if(await window.asyncConfirm("确认删除此行?")) tr.remove();
        });
        tr.appendChild(opTd);
        return tr;
    }

        const addRowBtn = document.getElementById('add-databank-row-btn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            if(!currentSheetId || !currentDataBank || !currentDataBank[currentSheetId]) return;
            const content = currentDataBank[currentSheetId].content;
            if(!content || content.length === 0) return alert("该表没有表头，无法添加");
            
            if (typeof window.openDataRowModal === 'function') {
                window.openDataRowModal(null);
            }
        });
    }

    const saveContentBtn = document.getElementById('save-databank-content-btn');
    if (saveContentBtn) {
        saveContentBtn.addEventListener('click', () => {
            if(!currentSheetId) return;
            
            const tableEl = document.getElementById('databank-table');
            const thead = tableEl.querySelector('thead');
            const tbody = tableEl.querySelector('tbody');
            if(!thead || !tbody) return;
            
            const newContent = [];
            const headers = Array.from(thead.querySelectorAll('th')).slice(0, -1).map(th => th.textContent.trim());
            newContent.push(headers);
            
            Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
                const rowData = Array.from(tr.querySelectorAll('td')).slice(0, -1).map(td => td.textContent.trim());
                newContent.push(rowData);
            });
            
            saveContentBtn.disabled = true;
            saveContentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            fetch('/api/databank/update_content', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sheet_id: currentSheetId, content: newContent })
            }).then(res => res.json()).then(data => {
                saveContentBtn.disabled = false;
                if(data.status === 'success') {
                    if(currentDataBank && currentDataBank[currentSheetId]) {
                        currentDataBank[currentSheetId].content = newContent;
                    }
                    saveContentBtn.innerHTML = '<i class="fas fa-check"></i> 保存成功！';
                    setTimeout(() => {
                        saveContentBtn.innerHTML = '<i class="fas fa-save"></i> 保存本表修改';
                    }, 2000);
                } else {
                    saveContentBtn.innerHTML = '<i class="fas fa-save"></i> 保存本表修改';
                    alert("保存失败: " + data.message);
                }
            }).catch(err => {
                saveContentBtn.disabled = false;
                saveContentBtn.innerHTML = '<i class="fas fa-save"></i> 保存本表修改';
                alert("请求出错: " + err);
            });
        });
    }

    // ==========================================
    // TEMPLATE GUI MODE (模板 GUI 构建器模式)
    // ==========================================
    function loadTemplateRaw() {
        fetch('/api/databank/template')
            .then(res => res.json())
            .then(res => {
                if(res.status === 'success') {
                    try {
                        currentTemplateRaw = JSON.parse(res.data);
                        renderTplSidebar();
                    } catch(e) {
                        alert("模板 JSON 格式损坏: " + e.message);
                    }
                } else {
                    alert("加载模板失败: " + res.message);
                }
            });
    }

    function renderTplSidebar() {
        const listEl = document.getElementById('databank-tpl-sheet-list');
        listEl.innerHTML = '';
        if(!currentTemplateRaw) return;
        
        const keys = Object.keys(currentTemplateRaw).filter(k => k.startsWith('sheet_'));
        let firstLi = null;
        let selectedLi = null;

        keys.forEach((key, index) => {
            const sheet = currentTemplateRaw[key];
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.margin = '5px 0';
            li.style.background = 'var(--bg-primary)';
            li.style.borderRadius = 'var(--border-radius)';
            li.style.cursor = 'pointer';
            li.innerHTML = `<strong>${sheet.name || key}</strong>`;
            
            li.addEventListener('click', () => {
                // 先同步当前正在编辑的表数据回内存 (防丢失)
                syncTplFormToMemory();
                
                document.querySelectorAll('#databank-tpl-sheet-list li').forEach(el => el.style.borderLeft = 'none');
                li.style.borderLeft = '3px solid var(--accent-color)';
                tplCurrentSheetId = key;
                renderTplEditorForm(key);
            });
            listEl.appendChild(li);
            
            if (index === 0) firstLi = li;
            if (key === tplCurrentSheetId) selectedLi = li;
        });

        if (selectedLi) selectedLi.click();
        else if (firstLi) firstLi.click();
        else {
            document.getElementById('tpl-empty-state').style.display = 'block';
            document.getElementById('tpl-editor-container').style.display = 'none';
        }
    }

    // 从 DOM 表单收集数据并同步回 currentTemplateRaw
    function syncTplFormToMemory() {
        if(!tplCurrentSheetId || !currentTemplateRaw || !currentTemplateRaw[tplCurrentSheetId]) return;
        const sheet = currentTemplateRaw[tplCurrentSheetId];
        
        const newUid = document.getElementById('tpl-fld-uid').value.trim();
        sheet.name = document.getElementById('tpl-fld-name').value.trim();
        sheet.uid = newUid;
        
        if(!sheet.exportConfig) sheet.exportConfig = {};
        sheet.exportConfig.entryType = document.getElementById('tpl-fld-entrytype').value;
        sheet.exportConfig.keywords = document.getElementById('tpl-fld-keywords').value.trim();
        sheet.exportConfig.injectLimit = parseInt(document.getElementById('tpl-fld-injectlimit').value) || 10;
        sheet.exportConfig.injectStrategy = document.getElementById('tpl-fld-injectstrategy').value || 'recent';
        
        if(!sheet.sourceData) sheet.sourceData = {};
        sheet.sourceData.note = document.getElementById('tpl-fld-note').value;
        sheet.sourceData.updateNode = document.getElementById('tpl-fld-updatenode').value;
        sheet.sourceData.insertNode = document.getElementById('tpl-fld-insertnode').value;
        sheet.sourceData.deleteNode = document.getElementById('tpl-fld-deletenode').value;
        
        // 读取列名（表头）与 列规则
        sheet.sourceData.columnRules = {};
        const colItems = document.querySelectorAll('#tpl-columns-list li');
        const headers = [];
        
        colItems.forEach(li => {
            const nameInput = li.querySelector('.tpl-col-input');
            const ruleInput = li.querySelector('.tpl-col-rule');
            if(nameInput) {
                const cname = nameInput.value.trim();
                if(cname) {
                    headers.push(cname);
                    if(ruleInput && ruleInput.value.trim()) {
                        sheet.sourceData.columnRules[cname] = ruleInput.value.trim();
                    }
                }
            }
        });
        
        if(!sheet.content) sheet.content = [];
        if(sheet.content.length === 0) sheet.content.push(headers);
        else sheet.content[0] = headers;
        
        // 如果 UID (表标识) 发生了修改，我们需要重命名外层 key
        if(newUid && newUid !== tplCurrentSheetId && newUid.startsWith('sheet_')) {
            currentTemplateRaw[newUid] = currentTemplateRaw[tplCurrentSheetId];
            if(currentTemplateRaw[tplCurrentSheetId].isSystem) {
                alert("这是系统默认的核心表，不可删除！");
                return;
            }
            delete currentTemplateRaw[tplCurrentSheetId];
            tplCurrentSheetId = newUid; // Update the reference
            renderTplSidebar(); // Re-render sidebar to reflect key change
        }
    }

    function renderTplEditorForm(key) {
        document.getElementById('tpl-empty-state').style.display = 'none';
        document.getElementById('tpl-editor-container').style.display = 'flex';
        
        const sheet = currentTemplateRaw[key];
        
        // 填充基础设置
        const uidInput = document.getElementById('tpl-fld-uid');
        uidInput.value = key;
        uidInput.readOnly = sheet.isSystem ? true : false;
        if(sheet.isSystem) {
            uidInput.style.background = 'var(--bg-primary)';
            uidInput.title = "系统保留标识，不可修改";
        } else {
            uidInput.style.background = '';
            uidInput.title = "";
        }
        
        const delBtn = document.getElementById('btn-tpl-delete-sheet');
        if (delBtn) {
            if (sheet.isSystem) {
                delBtn.disabled = true;
                delBtn.style.opacity = '0.5';
                delBtn.style.cursor = 'not-allowed';
                delBtn.title = "系统默认核心表，为防止崩溃不可删除";
            } else {
                delBtn.disabled = false;
                delBtn.style.opacity = '1';
                delBtn.style.cursor = 'pointer';
                delBtn.title = "";
            }
        }
        
        document.getElementById('tpl-fld-name').value = sheet.name || '';
        document.getElementById('tpl-fld-entrytype').value = sheet.exportConfig?.entryType || 'constant';
        document.getElementById('tpl-fld-keywords').value = sheet.exportConfig?.keywords || '';
        document.getElementById('tpl-fld-injectlimit').value = sheet.exportConfig?.injectLimit || 10;
        document.getElementById('tpl-fld-injectstrategy').value = sheet.exportConfig?.injectStrategy || 'recent';
        
        // 填充提示词
        document.getElementById('tpl-fld-note').value = sheet.sourceData?.note || '';
        document.getElementById('tpl-fld-updatenode').value = sheet.sourceData?.updateNode || '';
        document.getElementById('tpl-fld-insertnode').value = sheet.sourceData?.insertNode || '';
        document.getElementById('tpl-fld-deletenode').value = sheet.sourceData?.deleteNode || '';
        
        // 渲染列
        renderTplColumns(sheet);
    }

    function renderTplColumns(sheet) {
        const listEl = document.getElementById('tpl-columns-list');
        listEl.innerHTML = '';
        
        let headers = [];
        if (sheet.content && sheet.content.length > 0) {
            headers = sheet.content[0];
        } else {
            headers = ['row_id']; // 默认初始列
        }
        
        const columnRules = (sheet.sourceData && sheet.sourceData.columnRules) || {};
        
        headers.forEach((colName, index) => {
            const rule = columnRules[colName] || '';
            const li = createColCard(colName, rule, index === 0 && colName === 'row_id');
            listEl.appendChild(li);
        });
    }

    function createColCard(colName = '', rule = '', isReadOnlyPK = false) {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '8px';
        li.style.background = 'var(--bg-secondary)';
        li.style.padding = '10px';
        li.style.borderRadius = 'var(--border-radius)';
        li.style.border = '1px solid var(--border-color)';
        
        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.gap = '10px';
        topRow.style.alignItems = 'center';
        
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'modern-input tpl-col-input';
        inp.style.flex = '1';
        inp.value = colName;
        inp.placeholder = "列名 (如: 当前主导情绪)";
        if(isReadOnlyPK) inp.readOnly = true; // 保护主键
        
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn danger';
        delBtn.style.padding = '5px 10px';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.addEventListener('click', () => { li.remove(); });
        if(isReadOnlyPK) delBtn.disabled = true; // 保护主键
        
        topRow.appendChild(inp);
        topRow.appendChild(delBtn);
        
        const botRow = document.createElement('div');
        const ruleInp = document.createElement('textarea');
        ruleInp.className = 'modern-input tpl-col-rule';
        ruleInp.style.width = '100%';
        ruleInp.style.height = '40px';
        ruleInp.style.resize = 'vertical';
        ruleInp.placeholder = "列级规则约束 (选填，例如：只能使用2个汉字，或者：只读严禁修改)";
        ruleInp.value = rule;
        botRow.appendChild(ruleInp);
        
        li.appendChild(topRow);
        li.appendChild(botRow);
        return li;
    }

    const tplAddColBtn = document.getElementById('tpl-add-column-btn');
    if(tplAddColBtn) {
        tplAddColBtn.addEventListener('click', () => {
            const listEl = document.getElementById('tpl-columns-list');
            const li = createColCard('', '', false);
            listEl.appendChild(li);
        });
    }

    const addTplSheetBtn = document.getElementById('add-tpl-sheet-btn');
    if(addTplSheetBtn) {
        addTplSheetBtn.addEventListener('click', () => {
            if(!currentTemplateRaw) return;
            const newKey = "sheet_new_" + Date.now();
            currentTemplateRaw[newKey] = {
                "uid": newKey,
                "name": "新建数据表",
                "exportConfig": { "entryType": "constant", "keywords": "", "injectLimit": 10, "injectStrategy": "recent" },
                "sourceData": { "note": "", "updateNode": "", "insertNode": "", "deleteNode": "" },
                "content": [ ["row_id", "新列1"] ],
                "updateConfig": { "batchSize": 4, "contextDepth": 4, "skipFloors": -1, "uiSentinel": -1, "updateFrequency": -1 },
                "orderNo": 99
            };
            renderTplSidebar();
        });
    }

    const delTplSheetBtn = document.getElementById('btn-tpl-delete-sheet');
    if(delTplSheetBtn) {
        delTplSheetBtn.addEventListener('click', async () => {
            if(!tplCurrentSheetId || !currentTemplateRaw) return;
            if(!await window.asyncConfirm(`确定要彻底删除表 ${tplCurrentSheetId} 吗？`)) return;
            if(currentTemplateRaw[tplCurrentSheetId].isSystem) {
                alert("这是系统默认的核心表，不可删除！");
                return;
            }
            delete currentTemplateRaw[tplCurrentSheetId];
            tplCurrentSheetId = null;
            renderTplSidebar();
        });
    }

    const saveTplBtn = document.getElementById('save-databank-template-btn');
    if(saveTplBtn) {
        saveTplBtn.addEventListener('click', async () => {
            // 同步当前表单数据
            syncTplFormToMemory();
            
            if(!await window.asyncConfirm("确定要将当前所有的架构和提示词保存到模板文件中吗？")) return;
            
            saveTplBtn.disabled = true;
            saveTplBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            fetch('/api/databank/update_template', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ raw_json: JSON.stringify(currentTemplateRaw, null, 2) })
            }).then(res => res.json()).then(data => {
                saveTplBtn.disabled = false;
                saveTplBtn.innerHTML = '<i class="fas fa-save"></i> 保存全部模板结构';
                if(data.status === 'success') {
                    alert("模板架构覆写成功！");
                } else {
                    alert("保存失败: " + data.message);
                }
            }).catch(err => {
                saveTplBtn.disabled = false;
                saveTplBtn.innerHTML = '<i class="fas fa-save"></i> 保存全部模板结构';
                alert("请求出错: " + err);
            });
        });
    }

    const exportTplBtn = document.getElementById('btn-tpl-export');
    if(exportTplBtn) {
        exportTplBtn.addEventListener('click', () => {
            syncTplFormToMemory();
            const jsonStr = JSON.stringify(currentTemplateRaw, null, 2);
            const blob = new Blob([jsonStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "TavernDB_template_export.json";
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // ========== 工具设置加载 ==========
    window.loadToolsList = async function() {
        const container = document.getElementById('tools-container');
        if (!container) return;

        try {
            const response = await fetch('/api/tools');
            const data = await response.json();

            if (data.status === 'success' && data.tools) {
                container.innerHTML = ''; // 清空

                data.tools.forEach(tool => {
                    const card = document.createElement('div');
                    card.className = 'tool-card';
                    card.style.cssText = `
                        background: rgba(30, 32, 40, 0.6);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(10px);
                        position: relative;
                        overflow: hidden;
                    `;

                    // Hover effect (inline setup since we lack external CSS definition for .tool-card hover easily here)
                    card.onmouseenter = () => {
                        card.style.transform = 'translateY(-5px)';
                        card.style.borderColor = 'var(--accent-color)';
                        card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
                    };
                    card.onmouseleave = () => {
                        card.style.transform = 'translateY(0)';
                        card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        card.style.boxShadow = 'none';
                    };

                    card.innerHTML = `
                        <div style="display: flex; align-items: center; margin-bottom: 12px; color: var(--accent-color);">
                            <i class="${tool.icon} fa-fw" style="font-size: 24px; margin-right: 12px;"></i>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${tool.name}</h3>
                        </div>
                        <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; font-family: monospace; font-size: 13px; color: #4ade80; border-left: 3px solid #4ade80;">
                            ${tool.command}
                        </div>
                        <p style="color: #a0a0a0; font-size: 14px; line-height: 1.5; margin: 0; flex-grow: 1;">
                            ${tool.description}
                        </p>
                    `;
                    
                    if (tool.command.startsWith('[LAUNCH_APP')) {
                        card.style.cursor = 'pointer';
                        card.title = '点击配置应用启动白名单';
                        card.addEventListener('click', async () => {
                            try {
                                const cfgRes = await fetch('/api/settings/config');
                                const cfgData = await cfgRes.json();
                                if (cfgData.success) {
                                    window.currentAppLauncherConfig = cfgData.app_launcher || {};
                                    window.renderAppLauncherList();
                                    document.getElementById('app-launcher-modal').classList.remove('hidden');
                                }
                            } catch (e) {
                                alert('获取配置失败：' + e);
                            }
                        });
                    } else if (tool.command.startsWith('[ANALYZE_SCREEN')) {
                        card.style.cursor = 'pointer';
                        card.title = '点击配置视觉识别引擎';
                        card.addEventListener('click', () => {
                            document.getElementById('vision-tool-modal').classList.remove('hidden');
                        });
                    } else if (tool.command.startsWith('[WEATHER')) {
                        card.style.cursor = 'pointer';
                        card.title = '点击配置天气服务商、地区与经纬度';
                        card.addEventListener('click', async () => {
                            try {
                                const cfgRes = await fetch('/api/settings/config');
                                const cfgData = await cfgRes.json();
                                if (cfgData.success) {
                                    window.openWeatherModal(cfgData);
                                }
                            } catch (e) {
                                alert('获取天气配置失败：' + e);
                            }
                        });
                    }

                    container.appendChild(card);
                });

                // 城市经纬度字典
                const CITY_COORDS_MAP = {
                    "北京": [39.9042, 116.4074],
                    "上海": [31.2304, 121.4737],
                    "广州": [23.1291, 113.2644],
                    "深圳": [22.5431, 114.0579],
                    "杭州": [30.2741, 120.1551],
                    "南京": [32.0603, 118.7969],
                    "成都": [30.5728, 104.0668],
                    "武汉": [30.5928, 114.3055],
                    "重庆": [29.5630, 106.5516],
                    "西安": [34.3416, 108.9398],
                    "天津": [39.0842, 117.2008],
                    "苏州": [31.2990, 120.5853],
                    "长沙": [28.2282, 112.9388],
                    "郑州": [34.7466, 113.6253],
                    "青岛": [36.0671, 120.3826],
                    "合肥": [31.8206, 117.2272],
                    "福州": [26.0745, 119.2965],
                    "厦门": [24.4798, 118.0894],
                    "昆明": [24.8801, 102.8329],
                    "沈阳": [41.8057, 123.4315],
                    "大连": [38.9140, 121.6147],
                    "哈尔滨": [45.8038, 126.5349],
                    "济南": [36.6512, 117.1201],
                    "长春": [43.8171, 125.3235],
                    "石家庄": [38.0428, 114.5149],
                    "南宁": [22.8170, 108.3665],
                    "南昌": [28.6820, 115.8579],
                    "贵阳": [26.6470, 106.6302],
                    "海口": [20.0440, 110.1999],
                    "三亚": [18.2528, 109.5119],
                    "乌鲁木齐": [43.8256, 87.6168],
                    "兰州": [36.0611, 103.8343],
                    "银川": [38.4872, 106.2309],
                    "西宁": [36.6171, 101.7782],
                    "呼和浩特": [40.8427, 111.7508],
                    "香港": [22.3193, 114.1694],
                    "澳门": [22.1987, 113.5439],
                    "台北": [25.0330, 121.5654]
                };

                // 打开天气配置 Modal
                window.openWeatherModal = function(cfg) {
                    const modal = document.getElementById('weather-tool-modal');
                    if (!modal) return;

                    const cityPreset = document.getElementById('weather-city-preset');
                    const cityInput = document.getElementById('weather-city-input');
                    const latInput = document.getElementById('weather-lat-input');
                    const lonInput = document.getElementById('weather-lon-input');
                    const providerSelect = document.getElementById('weather-provider-select');
                    const apiKeyGroup = document.getElementById('weather-api-key-group');
                    const apiKeyInput = document.getElementById('weather-api-key-input');
                    const keyHelpText = document.getElementById('weather-key-help-text');
                    const testResult = document.getElementById('weather-test-result');

                    if (testResult) testResult.style.display = 'none';

                    // 回填数据
                    const currentCity = cfg.weather_city || '';
                    if (cityInput) cityInput.value = currentCity;
                    if (latInput) latInput.value = cfg.weather_lat !== undefined ? cfg.weather_lat : '';
                    if (lonInput) lonInput.value = cfg.weather_lon !== undefined ? cfg.weather_lon : '';
                    if (cityPreset) cityPreset.value = CITY_COORDS_MAP[currentCity] ? currentCity : '';

                    const currentProvider = cfg.weather_provider || 'auto';
                    if (providerSelect) providerSelect.value = currentProvider;
                    if (apiKeyInput) apiKeyInput.value = cfg.weather_api_key || '';

                    // 切换 Key 组可见性
                    const updateKeyVisibility = () => {
                        const p = providerSelect ? providerSelect.value : 'auto';
                        if (p === 'auto') {
                            apiKeyGroup.style.display = 'none';
                        } else {
                            apiKeyGroup.style.display = 'block';
                            if (p === 'qweather') {
                                keyHelpText.innerHTML = '和风天气 Key 申请：访问 <a href="https://dev.qweather.com" target="_blank" style="color:var(--accent-color);">dev.qweather.com</a> 免费申请（个人 1000次/天）。';
                            } else if (p === 'amap') {
                                keyHelpText.innerHTML = '高德地图 Key 申请：访问 <a href="https://lbs.amap.com" target="_blank" style="color:var(--accent-color);">lbs.amap.com</a> 申请“Web服务”类型的 API Key。';
                            } else if (p === 'seniverse') {
                                keyHelpText.innerHTML = '心知天气 Key 申请：访问 <a href="https://www.seniverse.com" target="_blank" style="color:var(--accent-color);">seniverse.com</a> 获取 API 密钥。';
                            }
                        }
                    };
                    updateKeyVisibility();

                    if (providerSelect && !providerSelect.dataset.bound) {
                        providerSelect.dataset.bound = 'true';
                        providerSelect.addEventListener('change', updateKeyVisibility);
                    }

                    if (cityPreset && !cityPreset.dataset.bound) {
                        cityPreset.dataset.bound = 'true';
                        cityPreset.addEventListener('change', () => {
                            const val = cityPreset.value;
                            if (val && CITY_COORDS_MAP[val]) {
                                cityInput.value = val;
                                latInput.value = CITY_COORDS_MAP[val][0];
                                lonInput.value = CITY_COORDS_MAP[val][1];
                            }
                        });
                    }

                    modal.classList.remove('hidden');
                };

                // 绑定 Weather Modal 关闭与操作按钮
                const btnCloseWeatherTool = document.getElementById('close-weather-tool-modal-btn');
                if (btnCloseWeatherTool && !btnCloseWeatherTool.dataset.bound) {
                    btnCloseWeatherTool.dataset.bound = 'true';
                    btnCloseWeatherTool.addEventListener('click', () => {
                        document.getElementById('weather-tool-modal').classList.add('hidden');
                    });
                }

                // 一键定位按钮
                const btnAutoLocate = document.getElementById('btn-auto-locate-weather');
                if (btnAutoLocate && !btnAutoLocate.dataset.bound) {
                    btnAutoLocate.dataset.bound = 'true';
                    btnAutoLocate.addEventListener('click', async () => {
                        const originalHTML = btnAutoLocate.innerHTML;
                        btnAutoLocate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在探测...';
                        btnAutoLocate.disabled = true;

                        try {
                            const res = await fetch('/api/tools/weather/locate');
                            const data = await res.json();
                            if (data.status === 'success' && data.location) {
                                const loc = data.location;
                                const cityInput = document.getElementById('weather-city-input');
                                const latInput = document.getElementById('weather-lat-input');
                                const lonInput = document.getElementById('weather-lon-input');
                                const cityPreset = document.getElementById('weather-city-preset');

                                if (cityInput) cityInput.value = loc.city || '';
                                if (latInput) latInput.value = loc.lat || '';
                                if (lonInput) lonInput.value = loc.lon || '';
                                if (cityPreset && CITY_COORDS_MAP[loc.city]) {
                                    cityPreset.value = loc.city;
                                }

                                alert(`📍 定位成功！识别到当前网络位置为：${loc.province || ''} ${loc.city || ''} (经纬度: ${loc.lon}, ${loc.lat})`);
                            } else {
                                alert('自动定位失败：' + (data.message || '未知错误'));
                            }
                        } catch (e) {
                            alert('网络请求失败：' + e);
                        } finally {
                            btnAutoLocate.innerHTML = originalHTML;
                            btnAutoLocate.disabled = false;
                        }
                    });
                }

                // 测试天气接口按钮
                const btnTestWeather = document.getElementById('btn-test-weather');
                if (btnTestWeather && !btnTestWeather.dataset.bound) {
                    btnTestWeather.dataset.bound = 'true';
                    btnTestWeather.addEventListener('click', async () => {
                        const testResult = document.getElementById('weather-test-result');
                        const provider = document.getElementById('weather-provider-select').value;
                        const apiKey = document.getElementById('weather-api-key-input').value.trim();
                        const city = document.getElementById('weather-city-input').value.trim();
                        const lat = document.getElementById('weather-lat-input').value.trim();
                        const lon = document.getElementById('weather-lon-input').value.trim();

                        const originalHTML = btnTestWeather.innerHTML;
                        btnTestWeather.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在测试天气...';
                        btnTestWeather.disabled = true;

                        if (testResult) {
                            testResult.style.display = 'block';
                            testResult.style.borderColor = 'rgba(189, 147, 249, 0.4)';
                            testResult.style.color = '#bd93f9';
                            testResult.innerText = '正在向天气服务商发送测试请求并执行多级容灾检测...';
                        }

                        try {
                            const res = await fetch('/api/tools/weather/test', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    weather_provider: provider,
                                    weather_api_key: apiKey,
                                    weather_city: city,
                                    weather_lat: lat ? parseFloat(lat) : null,
                                    weather_lon: lon ? parseFloat(lon) : null
                                })
                            });
                            const data = await res.json();
                            if (data.status === 'success') {
                                testResult.style.borderColor = 'rgba(80, 250, 123, 0.5)';
                                testResult.style.color = '#50fa7b';
                                testResult.innerText = data.report || '测试成功！已正常获取天气数据。';
                            } else {
                                testResult.style.borderColor = 'rgba(255, 107, 139, 0.5)';
                                testResult.style.color = '#ff6b8b';
                                testResult.innerText = `[测试报错] ${data.message}`;
                            }
                        } catch (e) {
                            if (testResult) {
                                testResult.style.borderColor = 'rgba(255, 107, 139, 0.5)';
                                testResult.style.color = '#ff6b8b';
                                testResult.innerText = `[网络故障] 请求天气测试接口失败: ${e}`;
                            }
                        } finally {
                            btnTestWeather.innerHTML = originalHTML;
                            btnTestWeather.disabled = false;
                        }
                    });
                }

                // 保存天气配置按钮
                const btnSaveWeather = document.getElementById('btn-save-weather');
                if (btnSaveWeather && !btnSaveWeather.dataset.bound) {
                    btnSaveWeather.dataset.bound = 'true';
                    btnSaveWeather.addEventListener('click', async () => {
                        const provider = document.getElementById('weather-provider-select').value;
                        const apiKey = document.getElementById('weather-api-key-input').value.trim();
                        const city = document.getElementById('weather-city-input').value.trim();
                        const lat = document.getElementById('weather-lat-input').value.trim();
                        const lon = document.getElementById('weather-lon-input').value.trim();

                        const originalHTML = btnSaveWeather.innerHTML;
                        btnSaveWeather.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
                        btnSaveWeather.disabled = true;

                        try {
                            const payload = {
                                weather_provider: provider,
                                weather_api_key: apiKey,
                                weather_city: city,
                                weather_lat: lat ? parseFloat(lat) : null,
                                weather_lon: lon ? parseFloat(lon) : null
                            };

                            const res = await fetch('/api/settings/config', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify(payload)
                            });
                            const data = await res.json();
                            if (data.status === 'success' || data.success) {
                                alert('☀️ 天气与定位配置已成功保存并实时生效！');
                                document.getElementById('weather-tool-modal').classList.add('hidden');
                            } else {
                                alert('保存失败：' + (data.message || '未知错误'));
                            }
                        } catch (e) {
                            alert('保存失败：' + e);
                        } finally {
                            btnSaveWeather.innerHTML = originalHTML;
                            btnSaveWeather.disabled = false;
                        }
                    });
                }

                // 渲染 App Launcher 列表
                window.renderAppLauncherList = function() {
                    const listContainer = document.getElementById('app-launcher-list');
                    if (!listContainer) return;
                    listContainer.innerHTML = '';
                    
                    const keys = Object.keys(window.currentAppLauncherConfig || {});
                    if (keys.length === 0) {
                        listContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">暂未配置任何应用，请在下方添加。</div>';
                        return;
                    }
                    
                    keys.forEach(alias => {
                        const path = window.currentAppLauncherConfig[alias];
                        const itemDiv = document.createElement('div');
                        itemDiv.style.display = 'flex';
                        itemDiv.style.alignItems = 'center';
                        itemDiv.style.justifyContent = 'space-between';
                        itemDiv.style.padding = '8px';
                        itemDiv.style.marginBottom = '8px';
                        itemDiv.style.backgroundColor = 'rgba(255,255,255,0.05)';
                        itemDiv.style.borderRadius = '6px';
                        
                        const textDiv = document.createElement('div');
                        textDiv.style.flex = '1';
                        textDiv.style.overflow = 'hidden';
                        textDiv.innerHTML = `<strong style="color: var(--accent-color);">${alias}</strong> <span style="color: #aaa; font-size: 12px; margin-left: 8px;" title="${path}">${path}</span>`;
                        
                        const delBtn = document.createElement('button');
                        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        delBtn.className = 'action-btn';
                        delBtn.style.padding = '4px 8px';
                        delBtn.style.backgroundColor = 'rgba(255, 107, 139, 0.2)';
                        delBtn.style.color = '#ff6b8b';
                        delBtn.style.border = 'none';
                        delBtn.addEventListener('click', () => {
                            delete window.currentAppLauncherConfig[alias];
                            window.renderAppLauncherList();
                        });
                        
                        itemDiv.appendChild(textDiv);
                        itemDiv.appendChild(delBtn);
                        listContainer.appendChild(itemDiv);
                    });
                };

                // 绑定 App Launcher Modal 事件
                const btnCloseAppLauncher = document.getElementById('close-app-launcher-modal-btn');
                const btnSaveAppLauncher = document.getElementById('save-app-launcher-btn');
                const btnAddApp = document.getElementById('add-app-btn');
                
                if (btnCloseAppLauncher && !btnCloseAppLauncher.dataset.bound) {
                    btnCloseAppLauncher.dataset.bound = 'true';
                    btnCloseAppLauncher.addEventListener('click', () => {
                        document.getElementById('app-launcher-modal').classList.add('hidden');
                    });
                }
                
                if (btnAddApp && !btnAddApp.dataset.bound) {
                    btnAddApp.dataset.bound = 'true';
                    btnAddApp.addEventListener('click', () => {
                        const aliasInput = document.getElementById('new-app-alias');
                        const pathInput = document.getElementById('new-app-path');
                        const alias = aliasInput.value.trim();
                        const path = pathInput.value.trim();
                        
                        if (!alias || !path) {
                            alert('唤醒词和应用路径不能为空！');
                            return;
                        }
                        
                        window.currentAppLauncherConfig = window.currentAppLauncherConfig || {};
                        window.currentAppLauncherConfig[alias] = path;
                        
                        aliasInput.value = '';
                        pathInput.value = '';
                        window.renderAppLauncherList();
                    });
                }
                
                if (btnSaveAppLauncher && !btnSaveAppLauncher.dataset.bound) {
                    btnSaveAppLauncher.dataset.bound = 'true';
                    btnSaveAppLauncher.addEventListener('click', async () => {
                        try {
                            const parsed = window.currentAppLauncherConfig || {};
                            
                            const btn = btnSaveAppLauncher;
                            const originalHTML = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
                            
                            const res = await fetch('/api/settings/config', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ app_launcher: parsed })
                            });
                            const data = await res.json();
                            if (data.status === 'success') {
                                alert('应用启动白名单已保存！');
                                document.getElementById('app-launcher-modal').classList.add('hidden');
                            } else {
                                alert('保存失败：' + data.message);
                            }
                            btn.innerHTML = originalHTML;
                        } catch (e) {
                            alert('保存失败：' + e);
                        }
                    });
                }
                
                // 绑定 Vision Tool Modal 关闭事件
                const btnCloseVisionTool = document.getElementById('close-vision-tool-modal-btn');
                if (btnCloseVisionTool && !btnCloseVisionTool.dataset.bound) {
                    btnCloseVisionTool.dataset.bound = 'true';
                    btnCloseVisionTool.addEventListener('click', () => {
                        document.getElementById('vision-tool-modal').classList.add('hidden');
                    });
                }
            } else {
                container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff6b8b;">获取工具列表失败。</div>';
            }
        } catch (e) {
            console.error('加载工具列表报错:', e);
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff6b8b;">网络或系统错误，加载失败。</div>';
        }
    };
});

// ==========================================
// 自定义大脑引擎 (Custom Brain Engines) 管理逻辑
// ==========================================
let customEnginesData = [];

async function loadCustomEngines() {
    try {
        const res = await fetch('/api/engines');
        const data = await res.json();
        if (data.success) {
            customEnginesData = data.engines;
            renderCustomEnginesDropdown();
            renderCustomEnginesList();
        }
    } catch(e) {
        console.error("加载自定义引擎失败:", e);
    }
}

function renderCustomEnginesDropdown() {
    const selects = [
        document.getElementById('api-provider-select'),
        document.getElementById('pre-api-provider-select'),
        document.getElementById('post-api-provider-select'),
        document.getElementById('vision-engine-select')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        
        // 移除已有的自定义选项
        Array.from(select.options).forEach(opt => {
            if (opt.value.startsWith('custom_')) opt.remove();
        });
        
        // 添加新的自定义选项
        customEnginesData.forEach(engine => {
            const opt = document.createElement('option');
            opt.value = engine.id;
            opt.innerText = `[自定义] ${engine.name} (${engine.model_name})`;
            select.appendChild(opt);
        });
    });
}

function renderCustomEnginesList() {
    const listContainer = document.getElementById('custom-engines-list');
    if (!listContainer) return;
    
    if (customEnginesData.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-secondary); padding: 10px; text-align: center;">暂无自定义引擎</div>';
        return;
    }
    
    listContainer.innerHTML = '';
    customEnginesData.forEach(engine => {
        const item = document.createElement('div');
        item.style.background = 'var(--bg-secondary)';
        item.style.padding = '10px';
        item.style.borderRadius = 'var(--border-radius)';
        item.style.border = '1px solid var(--border-color)';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        
        const tempText = engine.temperature !== undefined ? `${parseFloat(engine.temperature).toFixed(2)}` : '0.70 (默认)';
        item.innerHTML = `
            <div>
                <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                    ${engine.name}
                    <span style="font-size: 11px; background: rgba(189, 147, 249, 0.2); color: #bd93f9; padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(189, 147, 249, 0.3);">Temp: ${tempText}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">模型: ${engine.model_name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">URL: ${engine.base_url}</div>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="action-btn outline" onclick="editCustomEngine('${engine.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn danger" onclick="deleteCustomEngine('${engine.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

window.editCustomEngine = function(id) {
    const engine = customEnginesData.find(e => e.id === id);
    if (!engine) return;
    document.getElementById('engine-id').value = engine.id;
    document.getElementById('engine-name').value = engine.name;
    document.getElementById('engine-base-url').value = engine.base_url;
    document.getElementById('engine-api-key').value = engine.api_key || '';
    document.getElementById('engine-model-name').value = engine.model_name;

    const engTemp = engine.temperature !== undefined ? parseFloat(engine.temperature) : 0.7;
    const tempSlider = document.getElementById('engine-temperature-slider');
    const tempInput = document.getElementById('engine-temperature');
    const tempVal = document.getElementById('engine-temperature-val');
    if (tempSlider) tempSlider.value = engTemp;
    if (tempInput) tempInput.value = engTemp;
    if (tempVal) tempVal.textContent = engTemp.toFixed(2);

    document.getElementById('btn-save-engine').disabled = true; // 需重新测试才能保存
    
    document.getElementById('engine-model-select').style.display = 'none';
    document.getElementById('engine-model-name').style.display = 'block';
};

window.deleteCustomEngine = async function(id) {
    if(!await window.asyncConfirm("确定要删除此引擎配置吗？")) return;
    try {
        const res = await fetch(`/api/engines/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            await loadCustomEngines();
            // 重新设置 select value 避免空状态
            const apiSelect = document.getElementById('api-provider-select');
            if(apiSelect.value === id) {
                if (apiSelect.options.length > 0) {
                    apiSelect.selectedIndex = 0;
                } else {
                    apiSelect.value = '';
                }
                // Trigger change to save backend
                apiSelect.dispatchEvent(new Event('change'));
            }
        } else {
            alert("删除失败: " + data.error);
        }
    } catch(e) {
        alert("请求异常");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const manageBtn = document.getElementById('manage-engines-btn');
    const modal = document.getElementById('engine-modal');
    const closeBtn = document.getElementById('close-engine-modal-btn');
    
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            // 清空表单
            document.getElementById('engine-id').value = '';
            document.getElementById('engine-name').value = '';
            document.getElementById('engine-base-url').value = '';
            document.getElementById('engine-api-key').value = '';
            document.getElementById('engine-model-name').value = '';

            const tempSlider = document.getElementById('engine-temperature-slider');
            const tempInput = document.getElementById('engine-temperature');
            const tempVal = document.getElementById('engine-temperature-val');
            if (tempSlider) tempSlider.value = 0.7;
            if (tempInput) tempInput.value = 0.7;
            if (tempVal) tempVal.textContent = '0.70';

            document.getElementById('btn-save-engine').disabled = true;
            document.getElementById('engine-test-status').style.display = 'none';
            document.getElementById('engine-model-select').style.display = 'none';
            document.getElementById('engine-model-name').style.display = 'block';
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    // 引擎弹窗内温度滑块与数值输入联动
    const engineTempSlider = document.getElementById('engine-temperature-slider');
    const engineTempInput = document.getElementById('engine-temperature');
    const engineTempVal = document.getElementById('engine-temperature-val');
    if (engineTempSlider && engineTempInput) {
        engineTempSlider.addEventListener('input', (e) => {
            const num = parseFloat(e.target.value) || 0.7;
            engineTempInput.value = num;
            if (engineTempVal) engineTempVal.textContent = num.toFixed(2);
        });
        engineTempInput.addEventListener('input', (e) => {
            const num = Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.7));
            engineTempSlider.value = num;
            if (engineTempVal) engineTempVal.textContent = num.toFixed(2);
        });
    }
    
    // 快速预设自动填入
    const quickPreset = document.getElementById('engine-quick-preset');
    if (quickPreset) {
        quickPreset.addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('engine-base-url').value = e.target.value;
                const nameInput = document.getElementById('engine-name');
                if (!nameInput.value) {
                    const text = e.target.options[e.target.selectedIndex].text;
                    nameInput.value = text.split(' (')[0].trim();
                }
            }
        });
    }
    
    // 拉取模型列表
    const btnFetchModels = document.getElementById('btn-fetch-models');
    if (btnFetchModels) {
        btnFetchModels.addEventListener('click', async () => {
            const baseUrl = document.getElementById('engine-base-url').value.trim();
            const apiKey = document.getElementById('engine-api-key').value.trim();
            
            if(!baseUrl) {
                alert("请先填写 API Base URL！");
                return;
            }
            
            btnFetchModels.disabled = true;
            btnFetchModels.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 拉取中...';
            
            try {
                const res = await fetch('/api/engines/fetch_models', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ base_url: baseUrl, api_key: apiKey })
                });
                const data = await res.json();
                if(data.success && data.models.length > 0) {
                    const sel = document.getElementById('engine-model-select');
                    const inp = document.getElementById('engine-model-name');
                    sel.innerHTML = '';
                    data.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.innerText = m;
                        sel.appendChild(opt);
                    });
                    sel.style.display = 'block';
                    inp.style.display = 'none';
                    inp.value = data.models[0];
                    
                    sel.onchange = () => { inp.value = sel.value; };
                } else {
                    alert("获取失败或列表为空：" + (data.error || ""));
                }
            } catch(e) {
                alert("网络请求失败");
            } finally {
                btnFetchModels.disabled = false;
                btnFetchModels.innerHTML = '<i class="fas fa-cloud-download-alt"></i> 拉取模型列表';
            }
        });
    }
    
    const btnTest = document.getElementById('btn-test-engine');
    const btnSave = document.getElementById('btn-save-engine');
    const statusText = document.getElementById('engine-test-status');
    
    if (btnTest) {
        btnTest.addEventListener('click', async () => {
            const baseUrl = document.getElementById('engine-base-url').value.trim();
            const apiKey = document.getElementById('engine-api-key').value.trim();
            const modelName = document.getElementById('engine-model-name').value.trim();
            const temperature = engineTempInput ? (parseFloat(engineTempInput.value) || 0.7) : 0.7;
            
            if(!baseUrl || !modelName) {
                alert("请先填写 API Base URL 和模型名称！如果不知道模型名称，可以先拉取列表。");
                return;
            }
            
            btnTest.disabled = true;
            btnTest.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试中...';
            statusText.style.display = 'none';
            btnSave.disabled = true;
            
            try {
                const res = await fetch('/api/engines/test', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, model_name: modelName, temperature: temperature })
                });
                const data = await res.json();
                
                statusText.style.display = 'block';
                if(data.success) {
                    statusText.innerText = "✅ 连接成功！";
                    statusText.style.color = "#50fa7b";
                    btnSave.disabled = false;
                } else {
                    statusText.innerText = `❌ 连接失败: ${data.error}`;
                    statusText.style.color = "#ff5555";
                }
            } catch(e) {
                statusText.style.display = 'block';
                statusText.innerText = "❌ 连接异常";
                statusText.style.color = "#ff5555";
            } finally {
                btnTest.disabled = false;
                btnTest.innerHTML = '<i class="fas fa-plug"></i> 测试连接';
            }
        });
    }
    
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const id = document.getElementById('engine-id').value;
            const name = document.getElementById('engine-name').value.trim();
            const baseUrl = document.getElementById('engine-base-url').value.trim();
            const apiKey = document.getElementById('engine-api-key').value.trim();
            const modelName = document.getElementById('engine-model-name').value.trim();
            const temperature = engineTempInput ? (parseFloat(engineTempInput.value) || 0.7) : 0.7;
            
            if(!name || !baseUrl || !modelName) {
                alert("请填写完整的名称、URL 和模型名！");
                return;
            }
            
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            try {
                const res = await fetch('/api/engines/save', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        id, name, base_url: baseUrl, api_key: apiKey, model_name: modelName, temperature: temperature
                    })
                });
                const data = await res.json();
                
                if(data.success) {
                    await loadCustomEngines();
                    // Set active selection to this new engine
                    const apiSelect = document.getElementById('api-provider-select');
                    if(apiSelect) {
                        apiSelect.value = data.engine.id;
                        apiSelect.dispatchEvent(new Event('change'));
                    }
                    
                    alert("保存成功！您现在可以从下拉菜单中选择它了。");
                    modal.classList.add('hidden');
                } else {
                    alert("保存失败: " + data.error);
                }
            } catch(e) {
                alert("请求异常");
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="fas fa-save"></i> 保存引擎';
            }
        });
    }
});

// --- DataBank Modal Editor Logic ---
let currentRowElement = null;

window.openDataRowModal = function(trElement) {
    const databankRowModal = document.getElementById('databank-row-modal');
    const databankRowForm = document.getElementById('databank-row-form');
    currentRowElement = trElement;
    
    const tableEl = document.getElementById('databank-table');
    const thead = tableEl.querySelector('thead');
    if(!thead) return;
    
    const headers = Array.from(thead.querySelectorAll('th')).slice(0, -1).map(th => th.textContent.trim());
    const cells = trElement ? Array.from(trElement.querySelectorAll('td')).slice(0, -1).map(td => td.textContent) : [];
    
    databankRowForm.innerHTML = '';
    
    headers.forEach((header, index) => {
        let val = cells[index] || '';
        if (!trElement && header === 'row_id') {
            val = 'row_' + Math.random().toString(16).substring(2, 10);
        }
        
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.marginBottom = '15px';
        
        const label = document.createElement('label');
        label.textContent = header;
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        
        const input = document.createElement('textarea');
        input.className = 'modern-input';
        input.style.width = '100%';
        input.style.resize = 'vertical';
        input.style.minHeight = '40px';
        input.style.fontFamily = 'monospace';
        input.value = val;
        
        if (header === 'row_id') {
            input.style.backgroundColor = 'var(--bg-secondary)';
            input.placeholder = "通常由系统自动生成";
        }
        
        group.appendChild(label);
        group.appendChild(input);
        databankRowForm.appendChild(group);
    });
    
    databankRowModal.classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    const closeDatabankRowModalBtn = document.getElementById('close-databank-row-modal-btn');
    if (closeDatabankRowModalBtn) {
        closeDatabankRowModalBtn.addEventListener('click', () => {
            document.getElementById('databank-row-modal').classList.add('hidden');
        });
    }

    const saveDatabankRowBtn = document.getElementById('save-databank-row-btn');
    if (saveDatabankRowBtn) {
        saveDatabankRowBtn.addEventListener('click', () => {
            const databankRowForm = document.getElementById('databank-row-form');
            const inputs = Array.from(databankRowForm.querySelectorAll('textarea'));
            const newValues = inputs.map(input => input.value);
            
            if (currentRowElement) {
                // Update existing row
                const tds = currentRowElement.querySelectorAll('td');
                newValues.forEach((val, index) => {
                    if (tds[index]) tds[index].textContent = val;
                });
            } else {
                const tbody = document.getElementById('databank-table').querySelector('tbody');
                if (tbody && window.createDataRowGlobal) {
                    tbody.appendChild(window.createDataRowGlobal(newValues));
                }
            }
            document.getElementById('databank-row-modal').classList.add('hidden');
        });
    }
});

// ==================== SPRITE SETTINGS LOGIC ====================
document.addEventListener('DOMContentLoaded', () => {
    const spriteView = document.getElementById('sprite-settings-view');
    if (!spriteView) return;

    const setSelect = document.getElementById('sprite-set-select');
    const btnSetActive = document.getElementById('set-active-sprite-btn');
    const btnCreateSet = document.getElementById('create-sprite-set-btn');

    function customPrompt(message, defaultValue = "") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0'; overlay.style.left = '0';
            overlay.style.width = '100vw'; overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            
            const box = document.createElement('div');
            box.style.background = '#282a36';
            box.style.padding = '20px';
            box.style.borderRadius = '8px';
            box.style.color = '#fff';
            box.style.minWidth = '300px';
            
            const text = document.createElement('div');
            text.textContent = message;
            text.style.marginBottom = '10px';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.style.width = '100%';
            input.style.padding = '8px';
            input.style.marginBottom = '15px';
            input.style.background = '#1e1f29';
            input.style.color = '#fff';
            input.style.border = '1px solid #6272a4';
            input.style.boxSizing = 'border-box';
            
            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.justifyContent = 'flex-end';
            btnRow.style.gap = '10px';
            
            const btnCancel = document.createElement('button');
            btnCancel.textContent = '取消';
            btnCancel.className = 'action-btn outline';
            btnCancel.onclick = () => { document.body.removeChild(overlay); resolve(null); };
            
            const btnOk = document.createElement('button');
            btnOk.textContent = '确定';
            btnOk.className = 'action-btn';
            btnOk.onclick = () => { document.body.removeChild(overlay); resolve(input.value); };
            
            btnRow.appendChild(btnCancel);
            btnRow.appendChild(btnOk);
            box.appendChild(text);
            box.appendChild(input);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            input.focus();
        });
    }

    const btnRenameSet = document.getElementById('rename-sprite-set-btn');

    const previewContainer = document.getElementById('sprite-preview-container');

    // Hook nav-item click to refresh sprite view
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'sprite-settings-view') {
                loadSpriteSets();
            }
        });
    });

    let hasLoadedSprites = false;
    async function loadSpriteSets() {
        try {
            const res = await fetch('/api/sprites/list');
            const data = await res.json();
            if (data.success) {
                const currentSelection = setSelect.value;
                renderSpriteSelect(data.sets, data.active_set);
                if (hasLoadedSprites && currentSelection && Object.keys(data.sets).includes(currentSelection)) {
                    setSelect.value = currentSelection;
                }
                hasLoadedSprites = true;
                renderSpriteGrid(data.sets, setSelect.value);
            }
        } catch (e) {
            console.error('Failed to load sprites', e);
        }
    }

    function renderSpriteSelect(sets, activeSet) {
        setSelect.innerHTML = '';
        Object.keys(sets).forEach(setName => {
            const opt = document.createElement('option');
            opt.value = setName;
            opt.textContent = setName + (setName === activeSet ? ' (当前使用)' : '');
            setSelect.appendChild(opt);
        });
        if (Object.keys(sets).includes(activeSet)) {
            setSelect.value = activeSet;
        }

        setSelect.onchange = () => {
            renderSpriteGrid(sets, setSelect.value);
        };
    }

    function renderSpriteGrid(sets, selectedSet) {
        const typeBadge = document.getElementById('sprite-set-type-badge');
        const live2dBox = document.getElementById('live2d-preview-box');
        const pngContainer = document.getElementById('png-sprite-container');
        const setData = sets[selectedSet];

        if (setData && setData.type === 'live2d') {
            if (typeBadge) {
                typeBadge.innerHTML = '💫 Live2D 动态模型 (Soullink 驱动)';
                typeBadge.style.background = 'rgba(189, 147, 249, 0.2)';
                typeBadge.style.color = '#bd93f9';
                typeBadge.style.borderColor = '#bd93f9';
            }
            if (live2dBox) live2dBox.classList.remove('hidden');
            if (pngContainer) pngContainer.classList.add('hidden');

            const canvas = document.getElementById('dashboard-live2d-canvas');
            if (canvas && window.SoullinkLive2D && setData.model_url) {
                window.SoullinkLive2D.load(canvas, setData.model_url).then(() => {
                    const scale = setData.scale !== undefined ? setData.scale : 1.0;
                    const offX = setData.offset_x !== undefined ? setData.offset_x : 0.0;
                    const offY = setData.offset_y !== undefined ? setData.offset_y : 0.0;
                    window.SoullinkLive2D.setTransform(scale, offX, offY);

                    const scaleSlider = document.getElementById('live2d-scale-slider');
                    const scaleVal = document.getElementById('live2d-scale-val');
                    const offXSlider = document.getElementById('live2d-offset-x-slider');
                    const offXVal = document.getElementById('live2d-offset-x-val');
                    const offYSlider = document.getElementById('live2d-offset-y-slider');
                    const offYVal = document.getElementById('live2d-offset-y-val');

                    if (scaleSlider) scaleSlider.value = scale;
                    if (scaleVal) scaleVal.textContent = scale.toFixed(2) + 'x';
                    if (offXSlider) offXSlider.value = offX;
                    if (offXVal) offXVal.textContent = Math.round(offX) + 'px';
                    if (offYSlider) offYSlider.value = offY;
                    if (offYVal) offYVal.textContent = Math.round(offY) + 'px';
                });
            }
            return;
        }

        // 普通 PNG 套装
        if (typeBadge) {
            typeBadge.innerHTML = '🎨 普通 PNG 立绘';
            typeBadge.style.background = 'rgba(80, 250, 123, 0.2)';
            typeBadge.style.color = '#50fa7b';
            typeBadge.style.borderColor = '#50fa7b';
        }
        if (live2dBox) live2dBox.classList.add('hidden');
        if (pngContainer) pngContainer.classList.remove('hidden');

        previewContainer.innerHTML = '';
        const imagesDict = (setData && setData.images) ? setData.images : (sets[selectedSet] || {});
        
        const emotions = ['normal', 'angry', 'shy', 'crying', 'sleeping', 'peeking_left', 'peeking_right'];
        
        emotions.forEach(emotion => {
            const groupDiv = document.createElement('div');
            groupDiv.style.background = 'rgba(0,0,0,0.3)';
            groupDiv.style.padding = '15px';
            groupDiv.style.borderRadius = '8px';
            
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '10px';
            
            const title = document.createElement('h3');
            title.textContent = `情绪: ${emotion}`;
            title.style.margin = '0';
            title.style.color = '#ff79c6';
            
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'action-btn outline';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传立绘';
            uploadBtn.onclick = () => uploadSprites(selectedSet, emotion);
            
            header.appendChild(title);
            header.appendChild(uploadBtn);
            groupDiv.appendChild(header);
            
            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '10px';
            
            const imgs = imagesDict[emotion] || [];
            if (imgs.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = '暂无立绘';
                empty.style.color = '#777';
                grid.appendChild(empty);
            } else {
                imgs.forEach(url => {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.position = 'relative';
                    imgContainer.style.width = '100px';
                    imgContainer.style.height = '120px';
                    imgContainer.style.background = '#282a36';
                    imgContainer.style.borderRadius = '5px';
                    imgContainer.style.overflow = 'hidden';
                    
                    const img = document.createElement('img');
                    img.src = url + '?t=' + new Date().getTime(); // prevent cache
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    
                    const delBtn = document.createElement('button');
                    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                    delBtn.style.position = 'absolute';
                    delBtn.style.top = '5px';
                    delBtn.style.right = '5px';
                    delBtn.style.background = 'rgba(255,85,85,0.8)';
                    delBtn.style.color = 'white';
                    delBtn.style.border = 'none';
                    delBtn.style.borderRadius = '3px';
                    delBtn.style.cursor = 'pointer';
                    delBtn.style.padding = '5px';
                    
                    delBtn.onclick = () => deleteSprite(selectedSet, url.split('/').pop());
                    
                    imgContainer.appendChild(img);
                    imgContainer.appendChild(delBtn);
                    grid.appendChild(imgContainer);
                });
            }
            
            groupDiv.appendChild(grid);
            previewContainer.appendChild(groupDiv);
        });
    }

    async function uploadSprites(setName, emotion) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            
            const formData = new FormData();
            formData.append('set_name', setName);
            formData.append('emotion', emotion);
            for(let i=0; i<files.length; i++) {
                formData.append('files', files[i]);
            }
            
            try {
                const res = await fetch('/api/sprites/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    alert('上传成功！');
                    loadSpriteSets();
                } else {
                    alert('上传失败: ' + data.message);
                }
            } catch(err) {
                console.error(err);
                alert('上传错误');
            }
        };
        input.click();
    }

    async function deleteSprite(setName, filename) {
        if (!confirm(`确定要删除 ${filename} 吗？`)) return;
        
        try {
            const res = await fetch('/api/sprites/delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: setName, filename: filename })
            });
            const data = await res.json();
            if (data.success) {
                alert('删除成功！');
                loadSpriteSets();
            } else {
                alert('删除失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('删除错误');
        }
    }

    btnSetActive.addEventListener('click', async () => {
        const setName = setSelect.value;
        if (!setName) return;
        
        const confirmSet = await window.asyncConfirm(`确定要将当前使用的立绘套装切换为【${setName}】吗？\n为确保底层 Live2D 骨骼模型与表情图集彻底重新装载，系统将立即自动重启！`);
        if (!confirmSet) return;

        try {
            const res = await fetch('/api/sprites/set_active', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: setName })
            });
            const data = await res.json();
            if (data.success) {
                await window.triggerAppRestart(`立绘套装已成功更换为【${setName}】，正在重启桌宠系统...`);
            } else {
                alert('激活失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('激活发生异常: ' + err);
        }
    });

    if (btnRenameSet) {
        btnRenameSet.addEventListener('click', async () => {
            const oldName = setSelect.value;
            if (!oldName) return;
            const newName = await customPrompt(`请输入套装 '${oldName}' 的新名字：`, oldName);
            if (!newName || newName === oldName) return;
            
            try {
                const res = await fetch('/api/sprites/rename_set', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ old_name: oldName, new_name: newName })
                });
                const data = await res.json();
                if (data.success) {
                    alert('重命名成功！');
                    setSelect.value = newName;
                    loadSpriteSets();
                } else {
                    alert('重命名失败: ' + data.message);
                }
            } catch(err) {
                console.error(err);
                alert('重命名错误');
            }
        });
    }

    btnCreateSet.addEventListener('click', async () => {
        const newName = await customPrompt("请输入新套装的名字（仅限英文、数字、下划线）：", "new_outfit");
        if (!newName) return;
        
        try {
            const res = await fetch('/api/sprites/create_set', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: newName })
            });
            const data = await res.json();
            if (data.success) {
                alert('套装创建成功！');
                loadSpriteSets();
            } else {
                alert('创建失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('创建错误');
        }
    });

    // 绑定 Live2D 情绪测试按钮
    document.querySelectorAll('.btn-test-live2d-emotion').forEach(btn => {
        btn.addEventListener('click', () => {
            const emotion = btn.getAttribute('data-emotion');
            if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                window.SoullinkLive2D.setEmotion(emotion);
            }
        });
    });

    // 绑定 Live2D 预览画布鼠标视线跟随
    const dashboardLive2dCanvas = document.getElementById('dashboard-live2d-canvas');
    if (dashboardLive2dCanvas) {
        dashboardLive2dCanvas.addEventListener('mousemove', (e) => {
            if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                window.SoullinkLive2D.focus(e.clientX, e.clientY, dashboardLive2dCanvas);
            }
        });
        dashboardLive2dCanvas.addEventListener('mouseleave', () => {
            if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
                window.SoullinkLive2D.targetFocusX = 0;
                window.SoullinkLive2D.targetFocusY = 0;
            }
        });
    }

    // 绑定 Live2D 剪裁缩放与微调滑块
    const scaleSlider = document.getElementById('live2d-scale-slider');
    const scaleVal = document.getElementById('live2d-scale-val');
    const offXSlider = document.getElementById('live2d-offset-x-slider');
    const offXVal = document.getElementById('live2d-offset-x-val');
    const offYSlider = document.getElementById('live2d-offset-y-slider');
    const offYVal = document.getElementById('live2d-offset-y-val');
    const btnResetTransform = document.getElementById('btn-reset-live2d-transform');
    const btnSaveTransform = document.getElementById('btn-save-live2d-transform');

    const updateLive2dTransform = () => {
        const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
        const offX = offXSlider ? parseFloat(offXSlider.value) : 0.0;
        const offY = offYSlider ? parseFloat(offYSlider.value) : 0.0;

        if (scaleVal) scaleVal.textContent = scale.toFixed(2) + 'x';
        if (offXVal) offXVal.textContent = Math.round(offX) + 'px';
        if (offYVal) offYVal.textContent = Math.round(offY) + 'px';

        if (window.SoullinkLive2D && window.SoullinkLive2D.isLoaded) {
            window.SoullinkLive2D.setTransform(scale, offX, offY);
        }
    };

    if (scaleSlider) scaleSlider.addEventListener('input', updateLive2dTransform);
    if (offXSlider) offXSlider.addEventListener('input', updateLive2dTransform);
    if (offYSlider) offYSlider.addEventListener('input', updateLive2dTransform);

    if (btnResetTransform) {
        btnResetTransform.addEventListener('click', () => {
            if (scaleSlider) scaleSlider.value = 1.0;
            if (offXSlider) offXSlider.value = 0;
            if (offYSlider) offYSlider.value = 0;
            updateLive2dTransform();
        });
    }

    if (btnSaveTransform) {
        btnSaveTransform.addEventListener('click', async () => {
            const selectedSet = setSelect.value;
            if (!selectedSet) return;
            const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;
            const offX = offXSlider ? parseFloat(offXSlider.value) : 0.0;
            const offY = offYSlider ? parseFloat(offYSlider.value) : 0.0;

            btnSaveTransform.disabled = true;
            btnSaveTransform.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中';
            try {
                const res = await fetch('/api/sprites/live2d_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        set_name: selectedSet,
                        scale: scale,
                        offset_x: offX,
                        offset_y: offY
                    })
                });
                const data = await res.json();
                if (data.success) {
                    btnSaveTransform.innerHTML = '<i class="fas fa-check"></i> 已保存';
                    setTimeout(() => {
                        btnSaveTransform.innerHTML = '<i class="fas fa-save"></i> 保存布局';
                        btnSaveTransform.disabled = false;
                    }, 1500);
                } else {
                    alert('保存失败: ' + (data.error || '未知错误'));
                    btnSaveTransform.disabled = false;
                    btnSaveTransform.innerHTML = '<i class="fas fa-save"></i> 保存布局';
                }
            } catch (e) {
                alert('请求失败: ' + e);
                btnSaveTransform.disabled = false;
                btnSaveTransform.innerHTML = '<i class="fas fa-save"></i> 保存布局';
            }
        });
    }

    // === Live2D 模型导入 Modal 逻辑 ===
    const openLive2dModalBtn = document.getElementById('open-import-live2d-modal-btn');
    const live2dModal = document.getElementById('live2d-import-modal');
    const closeLive2dModalBtn = document.getElementById('close-live2d-modal-btn');
    const cancelLive2dImportBtn = document.getElementById('btn-cancel-live2d-import');
    const chooseLive2dFileBtn = document.getElementById('btn-choose-live2d-file');
    const live2dFileInput = document.getElementById('live2d-file-input');
    const chosenLive2dFilename = document.getElementById('chosen-live2d-filename');
    const live2dLocalPathInput = document.getElementById('live2d-local-path-input');
    const live2dSetNameInput = document.getElementById('live2d-set-name-input');
    const submitLive2dImportBtn = document.getElementById('btn-submit-live2d-import');
    const live2dImportStatus = document.getElementById('live2d-import-status');

    if (openLive2dModalBtn && live2dModal) {
        openLive2dModalBtn.addEventListener('click', () => {
            live2dModal.classList.remove('hidden');
            if (live2dImportStatus) live2dImportStatus.style.display = 'none';
        });
    }

    const closeLive2dModal = () => {
        if (live2dModal) live2dModal.classList.add('hidden');
        if (live2dFileInput) live2dFileInput.value = '';
        if (chosenLive2dFilename) chosenLive2dFilename.textContent = '选择 .zip 模型压缩包...';
    };

    if (closeLive2dModalBtn) closeLive2dModalBtn.addEventListener('click', closeLive2dModal);
    if (cancelLive2dImportBtn) cancelLive2dImportBtn.addEventListener('click', closeLive2dModal);
    if (live2dModal) {
        live2dModal.addEventListener('click', (e) => {
            if (e.target === live2dModal) closeLive2dModal();
        });
    }

    if (chooseLive2dFileBtn && live2dFileInput) {
        chooseLive2dFileBtn.addEventListener('click', () => live2dFileInput.click());
        live2dFileInput.addEventListener('change', () => {
            if (live2dFileInput.files && live2dFileInput.files[0]) {
                const f = live2dFileInput.files[0];
                if (chosenLive2dFilename) chosenLive2dFilename.textContent = f.name;
                if (live2dSetNameInput && !live2dSetNameInput.value) {
                    live2dSetNameInput.value = f.name.replace(/\.[^/.]+$/, "");
                }
            }
        });
    }

    if (submitLive2dImportBtn) {
        submitLive2dImportBtn.addEventListener('click', async () => {
            const file = live2dFileInput ? live2dFileInput.files[0] : null;
            const localPath = live2dLocalPathInput ? live2dLocalPathInput.value.trim() : '';
            const setName = live2dSetNameInput ? live2dSetNameInput.value.trim() : '';

            if (!file && !localPath) {
                alert('请选择要上传的 .zip 文件，或输入本地文件绝对路径！');
                return;
            }

            submitLive2dImportBtn.disabled = true;
            submitLive2dImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在解压并校验 Live2D 模型...';
            if (live2dImportStatus) {
                live2dImportStatus.style.display = 'block';
                live2dImportStatus.style.color = '#8be9fd';
                live2dImportStatus.textContent = '正在解压并检测 .model3.json 结构...';
            }

            try {
                const formData = new FormData();
                if (file) {
                    formData.append('file', file);
                }
                if (localPath) {
                    formData.append('zip_path', localPath);
                }
                if (setName) {
                    formData.append('set_name', setName);
                }

                const res = await fetch('/api/sprites/import_live2d', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    closeLive2dModal();
                    await window.triggerAppRestart(`🎉 恭喜！Live2D 模型套装「${data.set_name}」导入成功并已设为默认套装！\n系统正在重启以载入新模型...`);
                } else {
                    alert('导入失败: ' + (data.message || '未知错误'));
                }
            } catch (err) {
                console.error(err);
                alert('导入请求异常: ' + err.message);
            } finally {
                submitLive2dImportBtn.disabled = false;
                submitLive2dImportBtn.innerHTML = '<i class="fas fa-magic"></i> 开始导入并设为当前套装';
                if (live2dImportStatus) live2dImportStatus.style.display = 'none';
            }
        });
    }
});


// ==================== DASHBOARD STATS LOGIC ====================
let chartsInstances = {};

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats/dashboard');
        const data = await res.json();
        if (data.status === 'success') {
            renderDashboardStats(data.data);
        }
    } catch (e) {
        console.error("Failed to load dashboard stats", e);
    }
}

function renderDashboardStats(stats) {
    // 1. Total Time
    const totalMin = Math.floor(stats.total_time / 60);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    document.getElementById('stats-total-time').textContent = `${hours}h ${mins}m`;

    // Shared Chart Options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#f8f8f2', font: { family: 'monospace' } } },
            tooltip: { backgroundColor: 'rgba(40,42,54,0.9)', titleColor: '#ff79c6', bodyColor: '#8be9fd' }
        },
        scales: {
            x: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(98, 114, 164, 0.2)' } },
            y: { ticks: { color: '#6272a4' }, grid: { color: 'rgba(98, 114, 164, 0.2)' } }
        }
    };
    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#f8f8f2' } },
            tooltip: { backgroundColor: 'rgba(40,42,54,0.9)', titleColor: '#ff79c6', bodyColor: '#8be9fd' }
        }
    };

    // 2. Character Time Pie Chart
    const charLabels = Object.keys(stats.character_time);
    const charData = charLabels.map(k => Math.round(stats.character_time[k] / 60));
    
    if (chartsInstances.charPie) chartsInstances.charPie.destroy();
    const ctxPie = document.getElementById('chart-character-time').getContext('2d');
    chartsInstances.charPie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: charLabels,
            datasets: [{
                data: charData,
                backgroundColor: charLabels.map((k, i) => (stats.character_colors && stats.character_colors[k]) ? stats.character_colors[k] : ['#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#bd93f9', '#ff5555'][i % 6]),
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: pieOptions
    });

    // 3. Weekly Usage Bar Chart
    if (chartsInstances.weeklyBar) chartsInstances.weeklyBar.destroy();
    const ctxBar = document.getElementById('chart-weekly-usage').getContext('2d');
    chartsInstances.weeklyBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: stats.weekly_usage.labels,
            datasets: [{
                label: '活跃时长 (分钟)',
                data: stats.weekly_usage.data,
                backgroundColor: 'rgba(139, 233, 253, 0.6)',
                borderColor: '#8be9fd',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: commonOptions
    });

    // 4. Daily Dialogs Line Chart
    if (chartsInstances.dialogsLine) chartsInstances.dialogsLine.destroy();
    const ctxLine = document.getElementById('chart-daily-dialogs').getContext('2d');
    chartsInstances.dialogsLine = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: stats.daily_dialogs.labels,
            datasets: [{
                label: '对话次数',
                data: stats.daily_dialogs.data,
                backgroundColor: 'rgba(255, 121, 198, 0.2)',
                borderColor: '#ff79c6',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#ffb86c'
            }]
        },
        options: commonOptions
    });

    // 5. Activity Table
    const tbody = document.getElementById('stats-activity-table').querySelector('tbody');
    tbody.innerHTML = '';
    stats.recent_activity.forEach(act => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        const td1 = document.createElement('td');
        td1.textContent = act.date;
        td1.style.padding = '10px';
        td1.style.color = '#bd93f9';
        
        const td2 = document.createElement('td');
        td2.textContent = act.open_time;
        td2.style.padding = '10px';
        td2.style.color = '#50fa7b';
        
        const td3 = document.createElement('td');
        td3.textContent = act.close_time;
        td3.style.padding = '10px';
        td3.style.color = '#ff5555';
        
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
    });
}

// System Version and One-Click Update Management
async function initAboutVersionView() {
    const versionBadge = document.getElementById('current-version-badge');
    const commitBadge = document.getElementById('commit-hash-badge');
    const btnCheckUpdate = document.getElementById('btn-check-version-update');
    const btnPerformUpdate = document.getElementById('btn-perform-git-update');
    const btnRestartApp = document.getElementById('btn-restart-app-after-update');
    const statusContainer = document.getElementById('update-status-container');
    const statusHeader = document.getElementById('update-status-header');
    const changelogList = document.getElementById('update-changelog-list');

    if (!versionBadge || !btnCheckUpdate) return;

    // Load initial local version info
    try {
        const res = await fetch('/api/system/version');
        const data = await res.json();
        if (data.status === 'success') {
            versionBadge.textContent = `当前版本: v${data.version}`;
            if (data.commit) {
                commitBadge.textContent = `git (${data.commit})`;
            }
        }
    } catch (e) {
        console.error('加载系统版本信息失败:', e);
    }

    // Bind Check Update Click
    btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 连接远程仓库中...';
        btnPerformUpdate.classList.add('hidden');
        btnRestartApp.classList.add('hidden');
        statusContainer.classList.remove('hidden');
        statusHeader.style.color = '#bd93f9';
        statusHeader.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> 正在向 GitHub 远程仓库获取更新，请稍候...';
        changelogList.textContent = '';

        try {
            const res = await fetch('/api/system/check_update', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                if (data.has_update) {
                    statusHeader.style.color = '#50fa7b';
                    statusHeader.innerHTML = `<i class="fas fa-arrow-circle-up"></i> 发现新版本！远程最新版本为: v${data.latest_version} (HEAD: ${data.local_commit} -> Remote: ${data.remote_commit})`;
                    if (data.commit_logs && data.commit_logs.length > 0) {
                        changelogList.textContent = '【近期更新说明】:\n' + data.commit_logs.join('\n');
                    } else {
                        changelogList.textContent = '暂无详细更新日志描述。';
                    }
                    btnPerformUpdate.classList.remove('hidden');
                } else {
                    statusHeader.style.color = '#8be9fd';
                    statusHeader.innerHTML = `<i class="fas fa-check-circle"></i> 当前已是最新版本 (v${data.current_version})！代码处于主分支最新状态。`;
                    changelogList.textContent = '暂无待更新内容。';
                }
            } else {
                statusHeader.style.color = '#ff5555';
                statusHeader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 检测更新失败`;
                changelogList.textContent = data.message || '网络连接超时或未配置 Git 环境。';
            }
        } catch (e) {
            statusHeader.style.color = '#ff5555';
            statusHeader.innerHTML = `<i class="fas fa-times-circle"></i> 请求发生错误`;
            changelogList.textContent = e.toString();
        } finally {
            btnCheckUpdate.disabled = false;
            btnCheckUpdate.innerHTML = '<i class="fas fa-sync-alt"></i> 检查远程更新';
        }
    });

    // Bind Perform Update Click
    btnPerformUpdate.addEventListener('click', async () => {
        btnPerformUpdate.disabled = true;
        btnPerformUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在安全更新代码...';
        statusHeader.style.color = '#ffb86c';
        statusHeader.innerHTML = '<i class="fas fa-download fa-spin"></i> 正在拉取远程最新增量代码 (git pull)...';

        try {
            const res = await fetch('/api/system/perform_update', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                statusHeader.style.color = '#50fa7b';
                statusHeader.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                changelogList.textContent = data.output || '更新成功！';
                btnPerformUpdate.classList.add('hidden');
                btnRestartApp.classList.remove('hidden');
            } else {
                statusHeader.style.color = '#ff5555';
                statusHeader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 更新过程遭遇错误`;
                changelogList.textContent = data.message || '更新失败。';
            }
        } catch (e) {
            statusHeader.style.color = '#ff5555';
            statusHeader.innerHTML = `<i class="fas fa-times-circle"></i> 更新请求异常`;
            changelogList.textContent = e.toString();
        } finally {
            btnPerformUpdate.disabled = false;
            btnPerformUpdate.innerHTML = '<i class="fas fa-download"></i> 一键更新至最新版';
        }
    });

    // Bind Restart App Click
    btnRestartApp.addEventListener('click', async () => {
        if (confirm('确认立即重启桌宠应用以加载最新版本的代码吗？')) {
            if (typeof window.triggerAppRestart === 'function') {
                window.triggerAppRestart();
            } else {
                try {
                    await fetch('/api/restart', { method: 'POST' });
                    alert('系统正在重启中，请稍候...');
                } catch (e) {
                    alert('触发重启时发生错误: ' + e.toString());
                }
            }
        }
    });

    // Bind Offline ZIP Force Update
    const inputZipUpdateFile = document.getElementById('input-zip-update-file');
    const btnImportZipCard = document.getElementById('btn-import-zip-update-card');

    if (btnImportZipCard && inputZipUpdateFile) {
        btnImportZipCard.addEventListener('click', () => {
            inputZipUpdateFile.click();
        });

        inputZipUpdateFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.toLowerCase().endsWith('.zip')) {
                alert('请选择 .zip 格式的源码压缩包！');
                inputZipUpdateFile.value = '';
                return;
            }

            if (!confirm(`确定要从本地 ZIP 压缩包「${file.name}」强制导入更新代码吗？\n（个人数据、记忆库与 API 配置将被安全保留）`)) {
                inputZipUpdateFile.value = '';
                return;
            }

            btnImportZipCard.disabled = true;
            btnImportZipCard.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> 正在解压并覆盖更新...';

            statusContainer.classList.remove('hidden');
            statusHeader.style.color = '#ffb86c';
            statusHeader.innerHTML = '<i class="fas fa-file-import fa-spin"></i> 正在上传并解析 ZIP 增量代码包...';
            changelogList.textContent = `已选文件: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)\n正在安全校验目录并执行增量写入，请稍候...`;

            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/system/import_update_zip', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (res.ok && data.status === 'success') {
                    statusHeader.style.color = '#50fa7b';
                    statusHeader.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                    changelogList.textContent = `✅ 成功覆盖同步 ${data.updated_count} 个核心代码文件\n🛡️ 安全保留 ${data.skipped_count} 个用户个人数据与本地配置文件\n\n代码已成功写入本地项目，请点击「重启桌宠生效」加载新版本！`;
                    
                    if (data.new_version) {
                        const currentBadge = document.getElementById('current-version-badge');
                        if (currentBadge) currentBadge.textContent = `当前版本: v${data.new_version}`;
                    }

                    btnPerformUpdate.classList.add('hidden');
                    btnRestartApp.classList.remove('hidden');
                } else {
                    statusHeader.style.color = '#ff5555';
                    statusHeader.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 离线包导入更新失败`;
                    changelogList.textContent = data.message || '未知错误。';
                }
            } catch (err) {
                statusHeader.style.color = '#ff5555';
                statusHeader.innerHTML = `<i class="fas fa-times-circle"></i> 导入更新请求异常`;
                changelogList.textContent = err.toString();
            } finally {
                btnImportZipCard.disabled = false;
                btnImportZipCard.innerHTML = '<i class="fas fa-upload" style="margin-right: 8px;"></i> 选择本地 ZIP 文件更新';
                inputZipUpdateFile.value = '';
            }
        });
    }

    // Bind Export Logs Click
    const handleExportLogs = () => {
        window.location.href = '/api/system/export_logs';
    };

    const btnExportLogs = document.getElementById('btn-export-all-logs');
    if (btnExportLogs) {
        btnExportLogs.addEventListener('click', handleExportLogs);
    }

    const btnExportLogsCard = document.getElementById('btn-export-all-logs-card');
    if (btnExportLogsCard) {
        btnExportLogsCard.addEventListener('click', handleExportLogs);
    }
}

// Hook into nav logic
document.addEventListener('DOMContentLoaded', () => {
    initAboutVersionView();
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'dashboard-stats-view') {
                loadDashboardStats();
            }
        });
    });
});
