// dashboard_app.js - 大贤者控制台 Vue 3 核心统一调度主入口 (100% 数据驱动架构)
(function() {
    // --- 1. GLOBAL TOAST & ASYNC CONFIRM MODALS ---
    window.alert = function(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.backgroundColor = 'rgba(20, 20, 30, 0.95)';
        toast.style.color = '#fff';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '10px';
        toast.style.border = '1px solid rgba(255, 121, 198, 0.4)';
        toast.style.zIndex = '9999999';
        toast.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease';
        toast.style.transform = 'translateY(10px)';
        toast.style.opacity = '0';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
        toast.style.fontFamily = 'sans-serif';
        toast.style.fontSize = '14px';
        document.body.appendChild(toast);
        void toast.offsetWidth;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    };

    window.asyncConfirm = function(message) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.backdropFilter = 'blur(6px)';

            const box = document.createElement('div');
            box.style.backgroundColor = 'var(--bg-panel, #21222c)';
            box.style.padding = '30px';
            box.style.borderRadius = '14px';
            box.style.minWidth = '320px';
            box.style.maxWidth = '440px';
            box.style.boxShadow = '0 12px 36px rgba(0,0,0,0.6)';
            box.style.border = '1px solid rgba(255,255,255,0.12)';
            box.style.textAlign = 'center';

            const msgEl = document.createElement('p');
            msgEl.style.color = '#fff';
            msgEl.style.fontSize = '15px';
            msgEl.style.marginBottom = '25px';
            msgEl.style.lineHeight = '1.6';
            msgEl.style.whiteSpace = 'pre-wrap';
            msgEl.textContent = message;

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.justifyContent = 'center';
            btnContainer.style.gap = '16px';

            const btnNo = document.createElement('button');
            btnNo.textContent = '取消';
            btnNo.className = 'action-btn';
            btnNo.style.padding = '8px 22px';

            const btnYes = document.createElement('button');
            btnYes.textContent = '确认';
            btnYes.className = 'action-btn danger';
            btnYes.style.padding = '8px 22px';

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

    // --- 2. VUE 3 ROOT APP INITIALIZATION ---
    if (typeof Vue === 'undefined') {
        console.error('[VUE 3 INIT ERROR] Vue 运行时未就绪！');
        return;
    }

    const { createApp, ref, reactive, onMounted } = Vue;

    const app = createApp({
        setup() {
            const activeView = ref('engine-view');

            // 组合各大领域高内聚模块
            const theme = reactive(window.useThemeModule ? window.useThemeModule(Vue) : {});
            const character = reactive(window.useCharacterModule ? window.useCharacterModule(Vue) : {});
            const tts = reactive(window.useTTSModule ? window.useTTSModule(Vue) : {});
            const databank = reactive(window.useDataBankModule ? window.useDataBankModule(Vue) : {});
            const memory = reactive(window.useMemoryModule ? window.useMemoryModule(Vue) : {});
            const live2d = reactive(window.useLive2DDebugModule ? window.useLive2DDebugModule(Vue) : {});
            const stats = reactive(window.useStatsLogsModule ? window.useStatsLogsModule(Vue) : {});
            const config = reactive(window.useConfigModule ? window.useConfigModule(Vue) : {});

            function switchView(viewId) {
                activeView.value = viewId;
                // 按需懒加载各视图所需的数据
                if (viewId === 'graph-view' && memory.loadMemoryGraph) {
                    memory.loadMemoryGraph();
                } else if (viewId === 'logs-view' && stats.loadLogsList) {
                    stats.loadLogsList();
                } else if (viewId === 'databank-view' && databank.loadDataBank) {
                    databank.loadDataBank();
                } else if (viewId === 'dashboard-stats-view' && stats.loadDashboardStats) {
                    stats.loadDashboardStats();
                } else if (viewId === 'sprite-settings-view' && character.loadSpriteSets) {
                    character.loadSpriteSets();
                } else if (viewId === 'reactions-view' && character.loadReactions) {
                    character.loadReactions();
                }
            }

            // 挂载全局便捷桥接 (向后完全兼容任何行内 onclick)
            window.selectTtsEngine = function(provider) {
                if (tts.onProviderChange) tts.onProviderChange(provider);
            };
            window.checkGptSovitsStatus = function() {
                if (tts.checkGptSovitsStatus) tts.checkGptSovitsStatus();
            };
            window.launchGptSovitsService = function() {
                if (tts.launchGptSovitsService) tts.launchGptSovitsService();
            };

            onMounted(async () => {
                if (theme.initTheme) theme.initTheme();
                if (config.loadConfig) await config.loadConfig();
                if (character.loadCharacters) await character.loadCharacters();
                if (character.loadCharacterInfo) await character.loadCharacterInfo();
                if (character.loadSpriteSets) await character.loadSpriteSets();
                if (character.loadReactions) await character.loadReactions();
            });

            return {
                activeView,
                switchView,
                theme,
                character,
                tts,
                databank,
                memory,
                live2d,
                stats,
                config
            };
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const appMountEl = document.getElementById('vue-dashboard-app') || document.querySelector('.dashboard-container');
        if (appMountEl) {
            window.__dashboardApp = app.mount(appMountEl);
            console.log('✨ [VUE 3] 大贤者控制台纯净模块化架构已成功挂载！');
        }
    });
})();
