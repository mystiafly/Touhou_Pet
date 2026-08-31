// useConfig.js - 大脑引擎、多模型分配、系统设置与通用预设模块 (Vue 3 纯净驱动)
window.useConfigModule = function(Vue) {
    const { ref, reactive, onMounted } = Vue;

    const config = reactive({
        api_provider: 'gemini',
        pre_api_provider: '',
        post_api_provider: '',
        vision_engine: '',
        flow_mode: false,
        temperature: 0.7,
        history_step_multiplier: 1.0,
        enable_greeting: true,
        enable_auto_speak: true,
        auto_speak_multiplier: 1.0,
        bubble_duration_multiplier: 1.0,
        show_thought_button: true,
        show_tool_calls: true,
        auto_start_on_boot: false,
        auto_minimize_on_fullscreen_game: false,
        enable_tts_click: true,
        enable_tts_auto: true,
        user_prompt: '',
        gemini_api_key: '',
        gemini_base_url: '',
        gemini_model_name: '',
        deepseek_api_key: '',
        deepseek_base_url: '',
        deepseek_model_name: '',
        custom_engine_api_key: '',
        custom_engine_base_url: '',
        custom_engine_model_name: ''
    });

    const customEngines = ref([]);
    const globalPresets = ref([]);
    const customPresets = ref([]);
    const toolsList = ref([]);
    const appVersion = ref('1.42.0');
    const commitHash = ref('');
    const updateInfo = reactive({
        checking: false,
        hasUpdate: false,
        latestVersion: '',
        commitLogs: [],
        message: ''
    });

    async function loadConfig() {
        try {
            await loadCustomEngines();
            await loadSystemVersion();
            const res = await fetch('/api/settings/config');
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                Object.assign(config, data);
            }
        } catch (e) {
            console.error('加载系统配置异常:', e);
        }
    }

    async function loadSystemVersion() {
        try {
            const res = await fetch('/api/system/version');
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                appVersion.value = data.version || '1.42.0';
                commitHash.value = data.commit || '';
            }
        } catch (e) {
            console.error('获取系统版本异常:', e);
        }
    }

    async function saveConfig(partialConfig) {
        try {
            const res = await fetch('/api/settings/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(partialConfig || config)
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                alert('设置已成功保存并实时生效！');
            } else {
                alert('保存配置失败: ' + (data.error || data.message || ''));
            }
        } catch (e) {
            alert('保存配置异常: ' + e);
        }
    }

    async function loadCustomEngines() {
        try {
            const res = await fetch('/api/engines');
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                customEngines.value = data.engines || [];
            }
        } catch (e) {
            console.error('加载自定义引擎异常:', e);
        }
    }

    async function checkUpdate() {
        updateInfo.checking = true;
        updateInfo.message = '正在与 GitHub 远程仓库同步检查...';
        try {
            const res = await fetch('/api/system/check_update', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                updateInfo.hasUpdate = Boolean(data.has_update);
                updateInfo.latestVersion = data.latest_version || '';
                updateInfo.commitLogs = data.commit_logs || [];
                if (data.has_update) {
                    updateInfo.message = `发现新版本: v${data.latest_version}！`;
                } else {
                    updateInfo.message = '当前已是最新版本！';
                    alert('当前大贤者桌宠系统已是最新版本 (v' + (data.current_version || appVersion.value) + ')！');
                }
            } else {
                updateInfo.message = '检查更新失败: ' + (data.message || '');
            }
        } catch (e) {
            updateInfo.message = '检查更新请求异常: ' + e;
        } finally {
            updateInfo.checking = false;
        }
    }

    async function performUpdate() {
        const confirmed = await window.asyncConfirm('确定要立即一键更新到最新版本吗？更新完成后将自动重启应用。');
        if (!confirmed) return;
        try {
            const res = await fetch('/api/system/perform_update', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                alert('更新成功！系统正在自动重启...');
                setTimeout(() => window.location.reload(), 2500);
            } else {
                alert('一键更新失败: ' + (data.message || ''));
            }
        } catch (e) {
            alert('一键更新请求异常: ' + e);
        }
    }

    async function exportLogs() {
        try {
            const res = await fetch('/api/system/export_logs');
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                alert('系统日志已打包保存至: ' + (data.zip_path || 'data/'));
            } else {
                alert('打包导出日志失败: ' + (data.message || ''));
            }
        } catch (e) {
            alert('打包导出日志异常: ' + e);
        }
    }

    async function restartApp() {
        const confirmed = await window.asyncConfirm('确定要重启大贤者桌宠系统吗？');
        if (!confirmed) return;
        try {
            if (window.electronAPI && window.electronAPI.restartApp) {
                window.electronAPI.restartApp();
            } else {
                await fetch('/api/settings/exit', { method: 'POST' });
                alert('系统正在重启中，请稍候 2~3 秒刷新页面。');
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (e) {
            window.location.reload();
        }
    }

    return {
        config,
        customEngines,
        globalPresets,
        customPresets,
        toolsList,
        appVersion,
        commitHash,
        updateInfo,
        loadConfig,
        saveConfig,
        loadCustomEngines,
        checkUpdate,
        performUpdate,
        exportLogs,
        restartApp
    };
};
