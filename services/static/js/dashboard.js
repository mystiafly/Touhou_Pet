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
        });
    });

    // ========== 大脑引擎配置 ==========
    const apiSelect = document.getElementById('api-provider-select');
    const charSelect = document.getElementById('character-select');

    // 加载基础配置
    async function loadConfig() {
        try {
            const [configRes, charRes] = await Promise.all([
                fetch('/api/settings/config'),
                fetch('/api/character_info')
            ]);
            const configData = await configRes.json();
            const charData = await charRes.json();

            if (configData.success) {
                apiSelect.value = configData.api_provider;
                
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
                    autoSpeakMultiplier.value = configData.auto_speak_multiplier.toString();
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
            }
        } catch (e) {
            alert("切换引擎请求失败！");
        }
    });

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
    const previewContentArea = document.getElementById('preview-content-area');

    let currentPreviewMessages = [];

    function renderPreview() {
        const hideHistory = document.getElementById('hide-history-toggle').checked;
        let html = "";
        currentPreviewMessages.forEach(msg => {
            if (hideHistory && msg.is_history) return;
            html += `${msg.role_name}\n${msg.content}\n\n=======================================================================\n\n`;
        });
        previewContentArea.innerText = html;
    }

    if (document.getElementById('hide-history-toggle')) {
        document.getElementById('hide-history-toggle').addEventListener('change', renderPreview);
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            previewModal.classList.remove('hidden');
            previewContentArea.innerText = '';
            previewLoading.classList.remove('hidden');

            try {
                const response = await fetch('/api/settings/preview_prompt');
                const data = await response.json();
                previewLoading.classList.add('hidden');
                
                if (data.success) {
                    currentPreviewMessages = data.messages;
                    renderPreview();
                } else {
                    previewContentArea.innerText = `生成失败: ${data.error || '未知错误'}`;
                }
            } catch (e) {
                console.error(e);
                previewLoading.classList.add('hidden');
                previewContentArea.innerText = "请求失败，请检查后端运行状态。";
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
        document.getElementById('preset-keywords').value = (preset.trigger_keywords || []).join(', ');
        document.getElementById('preset-min-fav').value = preset.min_favorability !== undefined ? preset.min_favorability : '';
        document.getElementById('preset-max-fav').value = preset.max_favorability !== undefined ? preset.max_favorability : '';
        document.getElementById('preset-always-active').checked = !!preset.always_active;
        document.getElementById('preset-prompt').value = preset.prompt || '';
    } else {
        document.getElementById('preset-modal-title').innerHTML = '<i class="fas fa-plus"></i> 新增预设';
        document.getElementById('preset-original-name').value = '';
        document.getElementById('preset-name').value = '';
        document.getElementById('preset-keywords').value = '';
        document.getElementById('preset-min-fav').value = '';
        document.getElementById('preset-max-fav').value = '';
        document.getElementById('preset-always-active').checked = false;
        document.getElementById('preset-prompt').value = '';
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
            const minFav = document.getElementById('preset-min-fav').value;
            const maxFav = document.getElementById('preset-max-fav').value;
            const alwaysActive = document.getElementById('preset-always-active').checked;
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
                always_active: alwaysActive
            };
            
            if (keywordsStr) presetObj.trigger_keywords = keywordsStr.split(',').map(s => s.trim()).filter(s => s);
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
});
