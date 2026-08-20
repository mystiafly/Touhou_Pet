// dashboard_app.js - 大贤者控制台 Vue 3 主入口程序
(function() {
    // --- GLOBAL ALERT & ASYNC CONFIRM OVERRIDES ---
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
        void toast.offsetWidth;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

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

    // --- VUE 3 ROOT APP INITIALIZATION ---
    if (typeof Vue === 'undefined') {
        console.error('[VUE 3 INIT ERROR] Vue 运行时未就绪！');
        return;
    }

    const { createApp, ref, onMounted } = Vue;

    const app = createApp({
        setup() {
            const activeView = ref('engine-view');

            // 组合各业务模块
            const theme = window.useThemeModule(Vue);
            const character = window.useCharacterModule(Vue);
            const tts = window.useTTSModule(Vue);
            const databank = window.useDataBankModule(Vue);
            const memory = window.useMemoryModule(Vue);
            const live2d = window.useLive2DDebugModule(Vue);
            const stats = window.useStatsLogsModule(Vue);
            const config = window.useConfigModule(Vue);

            function switchView(viewId) {
                activeView.value = viewId;
                if (viewId === 'graph-view') {
                    memory.loadMemoryGraph();
                } else if (viewId === 'logs-view') {
                    stats.loadLogsList();
                } else if (viewId === 'databank-view') {
                    databank.loadDataBank();
                } else if (viewId === 'dashboard-stats-view') {
                    stats.loadDashboardStats();
                } else if (viewId === 'sprite-settings-view') {
                    character.loadSpriteSets();
                } else if (viewId === 'reactions-view') {
                    character.loadReactions();
                }
            }

            onMounted(async () => {
                theme.initTheme();
                await config.loadConfig();
                await character.loadCharacters();
                await character.loadCharacterInfo();
                await character.loadSpriteSets();
                await character.loadReactions();
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
            app.mount(appMountEl);
            console.log('✨ [VUE 3] 大贤者控制台根实例已成功挂载！');
        }
    });
})();
