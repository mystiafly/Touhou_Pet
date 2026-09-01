
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
            const activeSection = document.getElementById(targetId);
            if (activeSection) activeSection.classList.add('active');

            // 切换对应视图时触发数据加载
            if (targetId === 'character-management-view') {
                if (window.loadCharacters) window.loadCharacters();
            }
            if (targetId === 'sprite-settings-view') {
                if (window.loadSpriteSets) window.loadSpriteSets();
            }
            if (targetId === 'reactions-view') {
                if (window.loadReactions) window.loadReactions();
            }
            if (targetId === 'dashboard-stats-view') {
                if (window.loadDashboardStats) window.loadDashboardStats();
            }
            if (targetId === 'global-presets-view' || targetId === 'custom-presets-view') {
                if (window.loadPresets) window.loadPresets();
            }
            if (targetId === 'graph-view') {
                if (window.loadMemoryGraph) window.loadMemoryGraph();
            }
            if (targetId === 'logs-view') {
                if (window.loadLogsList) window.loadLogsList();
            }
            if (targetId === 'databank-view') {
                if (window.loadDataBank) window.loadDataBank();
            }
            if (targetId === 'tools-view' && !window.toolsLoaded) {
                if (window.loadToolsList) window.loadToolsList();
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

});
