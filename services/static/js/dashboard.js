
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
        });
    });

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
                
                const geminiOption = apiSelect.querySelector('option[value="gemini"]');
                const dsFlashOption = apiSelect.querySelector('option[value="deepseek-v4-flash"]');
                const dsProOption = apiSelect.querySelector('option[value="deepseek-v4-pro"]');
                const dsChatOption = apiSelect.querySelector('option[value="deepseek-chat"]');
                
                if (geminiOption) geminiOption.innerText = configData.has_gemini ? "Gemini 2.5 (检测到 Key)" : "Gemini 2.5 (未检测到 Key)";
                if (dsFlashOption) dsFlashOption.innerText = configData.has_deepseek ? "DeepSeek V4 Flash (已配 Key)" : "DeepSeek V4 Flash (未配 Key)";
                if (dsProOption) dsProOption.innerText = configData.has_deepseek ? "DeepSeek V4 Pro (已配 Key)" : "DeepSeek V4 Pro (未配 Key)";
                if (dsChatOption) dsChatOption.innerText = configData.has_deepseek ? "DeepSeek V3 (已配 Key)" : "DeepSeek V3 (未配 Key)";
                
                const userPromptArea = document.getElementById('user-prompt');
                if (userPromptArea && configData.user_prompt !== undefined) {
                    userPromptArea.value = configData.user_prompt;
                }
                
                const greetingToggle = document.getElementById('greeting-toggle');
                if (greetingToggle) {
                    greetingToggle.checked = configData.enable_greeting !== false;
                }
                
                const autoSpeakToggle = document.getElementById('auto-speak-toggle');
                if (autoSpeakToggle) {
                    autoSpeakToggle.checked = configData.enable_auto_speak !== false;
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

                if (configData.theme_color) {
                    applyDashboardThemeColor(configData.theme_color);
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

    charSelect.addEventListener('change', async (e) => {
        const confirmSwitch = confirm(`确定要切换灵魂为 ${e.target.options[e.target.selectedIndex].text} 吗？\n为保证记忆环境纯净，这将会自动重启桌宠！`);
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

    // 处理双模式切换
    const modeLazyBtn = document.getElementById('mode-lazy-btn');
    const modeProBtn = document.getElementById('mode-pro-btn');
    const formLazyMode = document.getElementById('form-lazy-mode');
    const formProMode = document.getElementById('form-pro-mode');

    if (modeLazyBtn && modeProBtn) {
        modeLazyBtn.addEventListener('click', () => {
            modeLazyBtn.classList.add('active');
            modeLazyBtn.classList.remove('outline');
            modeProBtn.classList.add('outline');
            modeProBtn.classList.remove('active');
            formLazyMode.style.display = 'block';
            formProMode.style.display = 'none';
        });

        modeProBtn.addEventListener('click', () => {
            modeProBtn.classList.add('active');
            modeProBtn.classList.remove('outline');
            modeLazyBtn.classList.add('outline');
            modeLazyBtn.classList.remove('active');
            formProMode.style.display = 'block';
            formLazyMode.style.display = 'none';
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

            const confirmGen = confirm("将请求大模型提炼设定并创建底层文件，该过程大概需要10-20秒，确认开始吗？");
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

            const confirmGen = confirm(`即将物理写入 ${charId} 的底层配置，确认操作吗？`);
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
        restartBtn.addEventListener('click', () => {
            const confirmRestart = confirm("确定要重新启动大贤者系统吗？\n如果程序没有自动打开，请手动双击启动！");
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

    function switchLogTab(tab) {
        if (tab === 'chat') {
            subtabChat.classList.add('active');
            subtabDiary.classList.remove('active');
            logContentArea.innerText = currentChatLog || "今天没有聊天对话记录哦。";
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
        if (!confirm(`确定要重写 ${val} 的日记吗？`)) return;

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

    // ========== 记忆图谱 ==========
    let network = null;
    const manualDistillBtn = document.getElementById('manual-distill-btn');
    const seedTestBtn = document.getElementById('seed-test-btn');
    const infoCard = document.getElementById('graph-info-card');
    const infoTitle = document.getElementById('info-node-title');
    const infoContent = document.getElementById('info-node-content');

    async function loadMemoryGraph() {
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        container.innerHTML = '<div style="color:#aaa; padding: 20px; text-align:center;">正在扫描长短期记忆拓扑，构建图谱中...</div>';
        
        try {
            const response = await fetch('/api/settings/memory_graph');
            const data = await response.json();

            if (!data.success) {
                container.innerHTML = `<div style="color:#ff5555; padding: 20px; text-align:center;">图谱构建失败: ${data.error}</div>`;
                return;
            }

            const nodes = new vis.DataSet(data.nodes || []);
            const edges = new vis.DataSet(data.edges || []);
            const graphData = { nodes: nodes, edges: edges };

            const options = {
                nodes: {
                    borderWidth: 2,
                    font: { face: 'Segoe UI' }
                },
                edges: {
                    width: 2,
                    smooth: { type: 'continuous' }
                },
                physics: {
                    barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 95, springConstant: 0.04 },
                    minVelocity: 0.75
                },
                interaction: { hover: true, tooltipDelay: 200 }
            };

            container.innerHTML = '';
            network = new vis.Network(container, graphData, options);

            network.on("click", function (params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    if (node) {
                        infoCard.classList.remove('hidden');
                        infoTitle.innerText = node.label || 'Node';
                        infoContent.innerText = node.title || 'No detailed memory data available.';
                    }
                } else {
                    infoCard.classList.add('hidden');
                }
            });

        } catch (error) {
            container.innerHTML = `<div style="color:#ff5555; padding: 20px; text-align:center;">网络错误或响应超时，构建失败！</div>`;
        }
    }

    async function manualDistill(isTest = false) {
        if (!isTest && !confirm("这将会消耗部分 API Token 将今天的聊天记录压缩为日记记忆实体，是否继续？")) return;
        
        const btn = isTest ? seedTestBtn : manualDistillBtn;
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
                loadMemoryGraph(); // 刷新图谱
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

    manualDistillBtn.addEventListener('click', () => manualDistill(false));
    seedTestBtn.addEventListener('click', () => manualDistill(true));
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
        
        let kwStr = (preset.trigger_keywords && preset.trigger_keywords.length) ? preset.trigger_keywords.join(', ') : '';
        
        item.innerHTML = `
            <div class="preset-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div>
                    <div class="preset-title">
                        ${preset.name}
                    </div>
                    <div class="preset-badges" style="margin-top: 5px;">${badgesHtml}</div>
                </div>
                <div class="preset-actions" onclick="event.stopPropagation();">
                    <button class="preset-btn edit" onclick="editPreset('${type}', '${preset.name}')" title="编辑"><i class="fas fa-pen"></i></button>
                    <button class="preset-btn delete" onclick="deletePreset('${type}', '${preset.name}')" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="preset-body">
                ${kwStr ? `<div style="font-size:12px; color:var(--text-secondary); margin-bottom:5px;"><b>关键词:</b> ${kwStr}</div>` : ''}
                <div class="preset-prompt">${preset.prompt || ''}</div>
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

function deletePreset(type, name) {
    if (confirm(`确定要删除预设 "${name}" 吗？此操作不可恢复。`)) {
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
            if (item.getAttribute('data-target') === 'presets-view') {
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
        opTd.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm("确认删除此行?")) tr.remove();
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
                "exportConfig": { "entryType": "constant", "keywords": "" },
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
        delTplSheetBtn.addEventListener('click', () => {
            if(!tplCurrentSheetId || !currentTemplateRaw) return;
            if(!confirm(`确定要彻底删除表 ${tplCurrentSheetId} 吗？`)) return;
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
        saveTplBtn.addEventListener('click', () => {
            // 同步当前表单数据
            syncTplFormToMemory();
            
            if(!confirm("确定要将当前所有的架构和提示词保存到模板文件中吗？")) return;
            
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

    // ========== 工具情况加载 ==========
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
                                    const appLauncher = cfgData.app_launcher || {};
                                    document.getElementById('edit-app-launcher-json').value = JSON.stringify(appLauncher, null, 2);
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

                // 绑定 App Launcher Modal 事件
                const btnCloseAppLauncher = document.getElementById('close-app-launcher-modal-btn');
                const btnSaveAppLauncher = document.getElementById('save-app-launcher-btn');
                
                if (btnCloseAppLauncher && !btnCloseAppLauncher.dataset.bound) {
                    btnCloseAppLauncher.dataset.bound = 'true';
                    btnCloseAppLauncher.addEventListener('click', () => {
                        document.getElementById('app-launcher-modal').classList.add('hidden');
                    });
                }
                
                if (btnSaveAppLauncher && !btnSaveAppLauncher.dataset.bound) {
                    btnSaveAppLauncher.dataset.bound = 'true';
                    btnSaveAppLauncher.addEventListener('click', async () => {
                        try {
                            const val = document.getElementById('edit-app-launcher-json').value.trim();
                            const parsed = val ? JSON.parse(val) : {};
                            
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
                            alert('JSON 格式不正确或保存失败：' + e);
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
    }

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
    if(!confirm("确定要删除此引擎配置吗？")) return;
    try {
        const res = await fetch(`/api/engines/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            await loadCustomEngines();
            // 重新设置 select value 避免空状态
            const apiSelect = document.getElementById('api-provider-select');
            if(apiSelect.value === id) {
                apiSelect.value = 'gemini';
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
                // Add new row (Need to access createDataRow via some scope, or rewrite it here)
                // wait, createDataRow is scoped inside DOMContentLoaded in dashboard.js.
                // We must expose createDataRow globally, or use a custom event, or reconstruct the row.
                const tbody = document.getElementById('databank-table').querySelector('tbody');
                if (tbody) {
                    if (window.createDataRowGlobal) {
                        tbody.appendChild(window.createDataRowGlobal(newValues));
                    }
                }
            }
            document.getElementById('databank-row-modal').classList.add('hidden');
        });
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
