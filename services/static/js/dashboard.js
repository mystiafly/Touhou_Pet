
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
            try {
                const charsResponse = await fetch('/api/characters/list');
                const charsData = await charsResponse.json();
                if (charsData.status === "success") {
                    charSelect.innerHTML = "";
                    charsData.characters.forEach(c => {
                        const option = document.createElement("option");
                        option.value = c.character_id;
                        option.innerText = `${c.character_name} (${c.character_id})`;
                        charSelect.appendChild(option);
                    });
                }
            } catch (e) {
                console.error("加载角色列表失败:", e);
            }

            if (charData.character_id) {
                charSelect.value = charData.character_id;
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

    charSelect.addEventListener('change', async (e) => {
        const confirmSwitch = await window.asyncConfirm(`确定要切换灵魂为 ${e.target.options[e.target.selectedIndex].text} 吗？\n为保证记忆环境纯净，这将会自动重启桌宠！`);
        if (confirmSwitch) {
            try {
                await fetch('/api/switch_character', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ character_id: e.target.value })
                });
                
                // 触发主进程重启
                if (window.electronAPI) {
                    window.electronAPI.restartApp();
                } else {
                    alert("重启指令已发送，请手动重启程序。");
                }
            } catch (e) {
                alert("切换请求失败！");
            }
        } else {
            // 恢复原值
            loadConfig();
        }
    });

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

    // 处理新角色生成 (高手模式)
    const generateProBtn = document.getElementById('generate-pro-btn');
    if (generateProBtn) {
        generateProBtn.addEventListener('click', async () => {
            const charId = document.getElementById('pro-char-id').value.trim();
            const charName = document.getElementById('pro-char-name').value.trim();
            const personaPrompt = document.getElementById('pro-persona-prompt').value.trim();
            const basePrompt = document.getElementById('pro-base-prompt') ? document.getElementById('pro-base-prompt').value.trim() : "";
            const dynamicTail = document.getElementById('pro-dynamic-tail') ? document.getElementById('pro-dynamic-tail').value.trim() : "";
            const themeColor = document.getElementById('pro-theme-color').value.trim();
            const appLauncher = document.getElementById('pro-app-launcher').value.trim();
            const envPresets = document.getElementById('pro-env-presets').value.trim();
            const statusText = document.getElementById('generate-pro-status');
            
            if (!charId || !charName || !personaPrompt) {
                alert("英文 ID、中文名、核心提示词为必填项！");
                return;
            }

            // 简单校验 ID 格式
            if (!/^[a-z_]+$/.test(charId)) {
                alert("英文 ID 只能包含小写字母和下划线！");
                return;
            }

            const confirmGen = await window.asyncConfirm(`即将物理写入 ${charId} 的底层配置，确认操作吗？`);
            if (!confirmGen) return;

            generateProBtn.disabled = true;
            generateProBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在急速写入...';
            statusText.style.display = 'block';
            statusText.innerText = '正在写入...';

            try {
                const response = await fetch('/api/characters/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        mode: 'pro',
                        character_id: charId,
                        character_name: charName,
                        persona_prompt: personaPrompt,
                        base_prompt: basePrompt,
                        dynamic_tail: dynamicTail,
                        theme_color: themeColor,
                        app_launcher: appLauncher,
                        env_presets: envPresets
                    })
                });
                
                const data = await response.json();
                if (data.status === 'success') {
                    statusText.innerText = '配置已物理写入磁盘！';
                    alert(`✨ 灵魂注入成功！\n\n大贤者已在后台为您建好了名为【${data.character_id}】的灵魂容器。\n\n⚠️ 重要最后一步：\n请前往 services/static/images/${data.character_id}/ 目录，放入 15 张对应表情动作的立绘（详情见文档）。\n完成后点击左下角【重启大贤者】，即可在主页切换到您的新角色！\n\n如果您需要配置更复杂的现实环境逻辑，可以直接编辑生成的 env_presets.json 文件。`);
                    loadConfig();
                } else {
                    statusText.innerText = '写入失败';
                    alert("生成失败: " + data.message);
                }
            } catch (e) {
                console.error(e);
                statusText.innerText = '写入失败';
                alert("请求失败，请检查网络或控制台报错。");
            } finally {
                generateProBtn.disabled = false;
                generateProBtn.innerHTML = '<i class="fas fa-bolt"></i> 瞬间注入 (纯 Python 极速写入)';
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
                    }

                    container.appendChild(card);
                });

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
        
        item.innerHTML = `
            <div>
                <div style="font-weight: bold; margin-bottom: 5px;">${engine.name}</div>
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
                    body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, model_name: modelName })
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
                        id, name, base_url: baseUrl, api_key: apiKey, model_name: modelName
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
        previewContainer.innerHTML = '';
        const imagesDict = sets[selectedSet] || {};
        
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
        
        try {
            const res = await fetch('/api/sprites/set_active', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ set_name: setName })
            });
            const data = await res.json();
            if (data.success) {
                alert('套装已激活！提示：由于立绘资源属于底层引擎加载内容，请重新启动桌宠以使更换生效。');
                loadSpriteSets();
            } else {
                alert('激活失败: ' + data.message);
            }
        } catch(err) {
            console.error(err);
            alert('激活错误');
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
});

// === Reactions (Coping Words) Logic ===
document.addEventListener('DOMContentLoaded', () => {
    const btnRefreshReactions = document.getElementById('btn-refresh-reactions');
    const btnRegenerateReactions = document.getElementById('btn-regenerate-reactions');
    const reactionsContainer = document.getElementById('reactions-content');
    const reactionsLoading = document.getElementById('reactions-loading');
    
    // Also load when nav item is clicked
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.getAttribute('data-target') === 'reactions-view') {
                loadReactions();
            }
        });
    });

    if(btnRefreshReactions) {
        btnRefreshReactions.addEventListener('click', loadReactions);
    }
    
    if(btnRegenerateReactions) {
        btnRegenerateReactions.addEventListener('click', async () => {
            const confirmed = await window.asyncConfirm("确定要清空当前的应付词库，并根据最新的人设重新生成吗？\n后台生成可能需要几十秒的时间，请耐心等待并刷新。");
            if (confirmed) {
                try {
                    await fetch('/api/pet_reactions/regenerate', { method: 'POST' });
                    loadReactions();
                } catch(e) {
                    console.error("Failed to regenerate reactions", e);
                }
            }
        });
    }

    const emotionMap = {
        'normal': '日常 (Normal)',
        'angry': '生气 (Angry)',
        'crying': '委屈 (Crying)',
        'shy': '害羞 (Shy)',
        'sleeping': '沉睡 (Sleeping)'
    };
    const emotionColors = {
        'normal': '#8be9fd',
        'angry': '#ff5555',
        'crying': '#bd93f9',
        'shy': '#ff79c6',
        'sleeping': '#f1fa8c'
    };

    function renderReactions(data, isGenerating) {
        reactionsContainer.innerHTML = '';
        if (isGenerating) {
            reactionsContainer.innerHTML = `<div style="padding: 15px; background: rgba(255, 121, 198, 0.2); border-left: 4px solid #ff79c6; border-radius: 4px; color: #fff; margin-bottom: 15px;">
                <i class="fas fa-magic fa-spin"></i> 系统检测到词库过少，正在后台自动调用大模型生成补全...请稍后刷新查看。下方显示的是临时保底数据。
            </div>`;
        }

        const emotions = ['normal', 'angry', 'crying', 'shy', 'sleeping'];
        emotions.forEach(emo => {
            const list = data[emo] || [];
            const color = emotionColors[emo] || '#fff';
            
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px;`;
            
            const title = document.createElement('h4');
            title.style.cssText = `color: ${color}; margin-top: 0; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;`;
            title.innerHTML = `<span>${emotionMap[emo] || emo}</span> <span style="font-size: 12px; opacity: 0.7;">(${list.length} 句)</span>`;
            groupDiv.appendChild(title);
            
            const tagsContainer = document.createElement('div');
            tagsContainer.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; min-height: 30px;`;
            
            if (list.length === 0) {
                tagsContainer.innerHTML = `<span style="color: #666; font-size: 12px; font-style: italic;">暂无应付词</span>`;
            } else {
                list.forEach(text => {
                    const tag = document.createElement('span');
                    tag.style.cssText = `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 15px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;`;
                    tag.innerHTML = `<span>${text}</span> <i class="fas fa-times delete-btn" style="cursor: pointer; color: #ff5555; opacity: 0.7;" title="删除"></i>`;
                    
                    tag.querySelector('.delete-btn').addEventListener('click', () => deleteReaction(emo, text));
                    tagsContainer.appendChild(tag);
                });
            }
            groupDiv.appendChild(tagsContainer);
            
            // Add form
            const addForm = document.createElement('div');
            addForm.style.cssText = `display: flex; gap: 8px;`;
            addForm.innerHTML = `
                <input type="text" class="modern-input reaction-input" placeholder="添加新应付词..." style="flex: 1; padding: 6px 12px; font-size: 13px;">
                <button class="action-btn outline btn-add-reaction" style="padding: 6px 12px; font-size: 13px;"><i class="fas fa-plus"></i></button>
            `;
            
            const inputField = addForm.querySelector('.reaction-input');
            const addBtn = addForm.querySelector('.btn-add-reaction');
            
            const doAdd = () => {
                const text = inputField.value.trim();
                if(text) {
                    addReaction(emo, text);
                    inputField.value = '';
                }
            };
            addBtn.addEventListener('click', doAdd);
            inputField.addEventListener('keypress', (e) => { if(e.key === 'Enter') doAdd(); });
            
            groupDiv.appendChild(addForm);
            reactionsContainer.appendChild(groupDiv);
        });
    }

    async function loadReactions() {
        if(!reactionsContainer) return;
        reactionsLoading.style.display = 'block';
        reactionsContainer.style.display = 'none';
        
        try {
            const res = await fetch('/api/pet_reactions?_t=' + Date.now());
            const data = await res.json();
            if (data.success) {
                renderReactions(data.reactions, data.is_generating);
                reactionsContainer.style.display = 'flex';
            } else {
                window.alert('加载应付词库失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            reactionsLoading.style.display = 'none';
        }
    }

    async function addReaction(emotion, text) {
        try {
            const res = await fetch('/api/pet_reactions/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion, text })
            });
            const data = await res.json();
            if(data.success) {
                loadReactions();
            } else {
                window.alert('添加失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteReaction(emotion, text) {
        try {
            const res = await fetch('/api/pet_reactions/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion, text })
            });
            const data = await res.json();
            if(data.success) {
                loadReactions();
            } else {
                window.alert('删除失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
        }
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
            try {
                await fetch('/api/restart', { method: 'POST' });
                alert('系统正在重启中，请稍候...');
            } catch (e) {
                alert('触发重启时发生错误: ' + e.toString());
            }
        }
    });

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
