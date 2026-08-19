// useConfig.js - 大脑引擎、多模型分配、系统设置与通用预设模块
window.useConfigModule = function(Vue) {
    const { ref, reactive } = Vue;

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
        user_prompt: ''
    });

    const customEngines = ref([]);
    const globalPresets = ref([]);
    const customPresets = ref([]);
    const toolsList = ref([]);
    const appVersion = ref('1.30.0');

    async function loadConfig() {
        try {
            await loadCustomEngines();
            const res = await fetch('/api/settings/config');
            const data = await res.json();
            if (data.success) {
                Object.assign(config, data);
            }
        } catch (e) {
            console.error('加载系统配置异常:', e);
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
            if (!data.success) {
                alert('保存配置失败: ' + (data.error || ''));
            }
        } catch (e) {
            console.error('保存配置异常:', e);
        }
    }

    async function loadCustomEngines() {
        try {
            const res = await fetch('/api/settings/custom_engines');
            const data = await res.json();
            if (data.success && data.engines) {
                customEngines.value = data.engines;
            }
        } catch (e) {
            console.error('加载自定义引擎异常:', e);
        }
    }

    async function loadPresets() {
        try {
            const [globalRes, customRes] = await Promise.all([
                fetch('/api/presets/global'),
                fetch('/api/presets/character')
            ]);
            const gData = await globalRes.json();
            const cData = await customRes.json();
            if (gData.success) globalPresets.value = gData.presets || [];
            if (cData.success) customPresets.value = cData.presets || [];
        } catch (e) {
            console.error('加载预设异常:', e);
        }
    }

    async function restartApp() {
        const confirmed = await window.asyncConfirm('确定要重启大贤者桌宠系统吗？');
        if (!confirmed) return;
        try {
            await fetch('/api/system/restart', { method: 'POST' });
            alert('系统正在重启中，请稍候 2~3 秒刷新页面。');
        } catch (e) {
            alert('发送重启指令异常');
        }
    }

    return {
        config,
        customEngines,
        globalPresets,
        customPresets,
        toolsList,
        appVersion,
        loadConfig,
        saveConfig,
        loadCustomEngines,
        loadPresets,
        restartApp
    };
};
