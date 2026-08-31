// useTTS.js - TTS 语音引擎配置、声音调试与试听模块 (Vue 3 纯净驱动)
window.useTTSModule = function(Vue) {
    const { ref, reactive, computed } = Vue;

    const TTS_PROVIDER_DEFAULTS = {
        'edge-tts': {
            url: '内置免密高速通道',
            model: 'Microsoft Neural',
            tip: '当前选择：<strong>Microsoft Edge-TTS（推荐）</strong>。内置官方神经网络语音通道，零延迟、免密免费、高保真。',
            needKey: false,
            keyPlaceholder: 'Edge-TTS 无需 API Key'
        },
        'fish_audio': {
            url: 'https://api.fish.audio/v1/tts',
            model: 'fish-speech-1.5',
            tip: '当前选择：<strong>Fish Audio 官方</strong>。高质量二次元情感克隆语音，需填写 API Key。',
            needKey: true,
            keyPlaceholder: 'Bearer Token (如: 8a7b...)'
        },
        'siliconflow': {
            url: 'https://api.siliconflow.cn/v1/audio/speech',
            model: 'fishaudio/fish-speech-1.5',
            tip: '当前选择：<strong>硅基流动 (SiliconFlow)</strong>。国内高速代理，支持 Fish-Speech-1.5。',
            needKey: true,
            keyPlaceholder: 'sk-...'
        },
        'custom_openai': {
            url: 'https://api.openai.com/v1/audio/speech',
            model: 'tts-1',
            tip: '当前选择：<strong>OpenAI 兼容 TTS 接口</strong>。标准 OpenAI /v1/audio/speech 协议。',
            needKey: true,
            keyPlaceholder: 'sk-...'
        },
        'gpt_sovits': {
            url: 'http://127.0.0.1:9880',
            model: 'GPT-SoVITS-v2',
            tip: '当前选择：<strong>本地 GPT-SoVITS</strong>。本地显卡部署，完全离线运行。',
            needKey: false,
            keyPlaceholder: '本地部署无需 Key'
        },
        'stepfun': {
            url: 'https://api.stepfun.com/v1/audio/speech',
            model: 'step-tts-mini',
            tip: '当前选择：<strong>阶跃星辰 (StepFun)</strong>。自然拟真中文语音。',
            needKey: true,
            keyPlaceholder: 'sk-...'
        }
    };

    const ttsState = reactive({
        tts_provider: 'edge-tts',
        tts_base_url: '',
        tts_api_key: '',
        tts_model_name: '',
        character_voice: '',
        character_tts_lang: 'zh',
        tts_speed: 1.0,
        tts_pitch: 0.0,
        showKey: false,
        isTesting: false,
        testText: '你好呀！我是桌宠，今天也要一起开心度过哦！',
        gptSovitsStatusText: '未检测',
        gptSovitsStatusClass: 'badge-secondary',
        isLaunchingGptSovits: false
    });

    const currentProviderTip = computed(() => {
        const def = TTS_PROVIDER_DEFAULTS[ttsState.tts_provider] || TTS_PROVIDER_DEFAULTS['edge-tts'];
        return def.tip;
    });

    const currentKeyPlaceholder = computed(() => {
        const def = TTS_PROVIDER_DEFAULTS[ttsState.tts_provider] || TTS_PROVIDER_DEFAULTS['edge-tts'];
        return def.keyPlaceholder;
    });

    let testAudio = new Audio();

    function onProviderChange(provider, skipSave = false) {
        ttsState.tts_provider = provider;
        const def = TTS_PROVIDER_DEFAULTS[provider];
        if (def) {
            if (!ttsState.tts_base_url || Object.values(TTS_PROVIDER_DEFAULTS).some(d => d.url === ttsState.tts_base_url)) {
                ttsState.tts_base_url = def.url;
            }
            if (!ttsState.tts_model_name || Object.values(TTS_PROVIDER_DEFAULTS).some(d => d.model === ttsState.tts_model_name)) {
                ttsState.tts_model_name = def.model;
            }
        }
        if (!skipSave) {
            saveTTSConfig();
        }
    }

    async function saveTTSConfig() {
        try {
            const res = await fetch('/api/settings/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tts_provider: ttsState.tts_provider,
                    tts_base_url: ttsState.tts_base_url,
                    tts_api_key: ttsState.tts_api_key,
                    tts_model_name: ttsState.tts_model_name,
                    character_voice: ttsState.character_voice,
                    character_tts_lang: ttsState.character_tts_lang,
                    tts_speed: ttsState.tts_speed,
                    tts_pitch: ttsState.tts_pitch
                })
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                // saved
            }
        } catch (e) {
            console.error('保存 TTS 配置异常:', e);
        }
    }

    async function testTTS(textOverride) {
        const text = textOverride || ttsState.testText || '测试语音合成。';
        ttsState.isTesting = true;
        try {
            const res = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    emotion: 'normal',
                    language: ttsState.character_tts_lang,
                    voice_id: ttsState.character_voice,
                    skip_refine: true
                })
            });
            const data = await res.json();
            if (data.success && data.audio_url) {
                testAudio.src = data.audio_url + '?t=' + Date.now();
                testAudio.playbackRate = parseFloat(ttsState.tts_speed) || 1.0;
                await testAudio.play();
            } else {
                alert('TTS 试听生成失败: ' + (data.error || '未知错误'));
            }
        } catch (e) {
            alert('TTS 试听请求失败: ' + e);
        } finally {
            ttsState.isTesting = false;
        }
    }

    async function checkGptSovitsStatus() {
        try {
            ttsState.gptSovitsStatusText = '检测中...';
            const res = await fetch('/api/tts/gpt_sovits/status');
            const data = await res.json();
            if (data.status === 'running') {
                ttsState.gptSovitsStatusText = '运行中 (PID: ' + (data.pid || '已连接') + ')';
                ttsState.gptSovitsStatusClass = 'badge-success';
            } else {
                ttsState.gptSovitsStatusText = '未运行';
                ttsState.gptSovitsStatusClass = 'badge-warning';
            }
        } catch (e) {
            ttsState.gptSovitsStatusText = '连接失败';
            ttsState.gptSovitsStatusClass = 'badge-danger';
        }
    }

    async function launchGptSovitsService() {
        ttsState.isLaunchingGptSovits = true;
        try {
            const res = await fetch('/api/tts/gpt_sovits/launch', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                alert('已成功发起 GPT-SoVITS 启动指令！请等待模型就绪。');
                setTimeout(checkGptSovitsStatus, 3000);
            } else {
                alert('启动 GPT-SoVITS 失败: ' + (data.message || ''));
            }
        } catch (e) {
            alert('发送启动指令异常: ' + e);
        } finally {
            ttsState.isLaunchingGptSovits = false;
        }
    }

    return {
        ttsState,
        currentProviderTip,
        currentKeyPlaceholder,
        onProviderChange,
        saveTTSConfig,
        testTTS,
        checkGptSovitsStatus,
        launchGptSovitsService
    };
};
