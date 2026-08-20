// useCharacter.js - 角色配置、立绘与换装管理、反应词库与离线语音收录模块
window.useCharacterModule = function(Vue) {
    const { ref, reactive, computed, onMounted } = Vue;

    const charactersList = ref([]);
    const currentCharacterId = ref('rumia');
    const characterInfo = reactive({
        name: '',
        system_prompt: '',
        user_prompt: '',
        enable_greeting: false,
        enable_auto_speak: false,
        greeting_text: '',
        avatar_url: ''
    });

    // 立绘与换装管理状态
    const spriteSets = ref({});
    const activeSpriteSet = ref('');
    const selectedSpriteSet = ref('');
    const isLive2DMode = computed(() => {
        const set = spriteSets.value[selectedSpriteSet.value];
        return set && set.type === 'live2d';
    });

    // 反应词库状态
    const reactions = reactive({
        normal: [],
        angry: [],
        crying: [],
        shy: [],
        sleeping: []
    });
    const reactionsDetail = reactive({
        normal: [],
        angry: [],
        crying: [],
        shy: [],
        sleeping: []
    });
    const newReactionInputs = reactive({
        normal: '',
        angry: '',
        crying: '',
        shy: '',
        sleeping: ''
    });

    const emotionNames = {
        normal: '平稳/日常',
        angry: '生气/反抗',
        crying: '委屈/哭泣',
        shy: '害羞/傲娇',
        sleeping: '困顿/睡眠'
    };

    const emotionIcons = {
        normal: 'fas fa-smile',
        angry: 'fas fa-angry',
        crying: 'fas fa-sad-tear',
        shy: 'fas fa-flushed',
        sleeping: 'fas fa-bed'
    };

    const isGeneratingReactions = ref(false);
    const isBatchRecording = ref(false);
    const batchProgress = reactive({
        total: 0,
        completed: 0,
        percent: 0,
        current_emotion: '',
        current_text: '',
        errors: []
    });

    let batchPollTimer = null;
    const previewAudio = new Audio();

    // 1. 加载角色列表与当前角色详情
    async function loadCharacters() {
        try {
            const res = await fetch('/api/characters/list');
            const data = await res.json();
            if (data.success && data.characters) {
                charactersList.value = data.characters;
            }
        } catch (e) {
            console.error('加载角色列表失败:', e);
        }
    }

    async function loadCharacterInfo() {
        try {
            const res = await fetch('/api/character_info');
            const data = await res.json();
            if (data) {
                currentCharacterId.value = data.character_id || currentCharacterId.value;
                characterInfo.name = data.name || '';
                characterInfo.system_prompt = data.system_prompt || '';
                characterInfo.user_prompt = data.user_prompt || '';
                characterInfo.enable_greeting = !!data.enable_greeting;
                characterInfo.enable_auto_speak = !!data.enable_auto_speak;
                characterInfo.greeting_text = data.greeting_text || '';
                characterInfo.avatar_url = data.avatar_url || '';
            }
        } catch (e) {
            console.error('加载角色详情失败:', e);
        }
    }

    async function switchCharacter(charId) {
        try {
            const res = await fetch('/api/switch_character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ character_id: charId })
            });
            const data = await res.json();
            if (data.success) {
                currentCharacterId.value = charId;
                await loadCharacterInfo();
                await loadSpriteSets();
                await loadReactions();
            } else {
                alert('切换角色失败: ' + (data.error || ''));
            }
        } catch (e) {
            console.error('切换角色异常:', e);
        }
    }

    async function saveCharacterPrompt() {
        try {
            const res = await fetch('/api/character/save_prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_id: currentCharacterId.value,
                    name: characterInfo.name,
                    system_prompt: characterInfo.system_prompt,
                    user_prompt: characterInfo.user_prompt,
                    enable_greeting: characterInfo.enable_greeting,
                    enable_auto_speak: characterInfo.enable_auto_speak,
                    greeting_text: characterInfo.greeting_text
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('角色人设保存成功');
            } else {
                alert('保存失败: ' + (data.error || ''));
            }
        } catch (e) {
            console.error('保存角色设定异常:', e);
        }
    }

    // 2. 立绘与换装管理
    async function loadSpriteSets() {
        try {
            const res = await fetch(`/api/sprites/list?character_id=${currentCharacterId.value}`);
            const data = await res.json();
            if (data.success) {
                spriteSets.value = data.sets || {};
                activeSpriteSet.value = data.active_set || '';
                selectedSpriteSet.value = data.active_set || Object.keys(data.sets || {})[0] || '';
            }
        } catch (e) {
            console.error('加载立绘套装失败:', e);
        }
    }

    async function setActiveSpriteSet(setName) {
        try {
            const res = await fetch('/api/sprites/set_active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_id: currentCharacterId.value,
                    set_name: setName
                })
            });
            const data = await res.json();
            if (data.success) {
                activeSpriteSet.value = setName;
                alert('立绘套装切换成功');
            } else {
                alert('切换立绘失败: ' + data.message);
            }
        } catch (e) {
            console.error('设置活动立绘异常:', e);
        }
    }

    async function uploadSprites(formData) {
        try {
            const res = await fetch('/api/sprites/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert('立绘上传成功');
                await loadSpriteSets();
            } else {
                alert('上传失败: ' + data.message);
            }
        } catch (e) {
            alert('上传立绘异常');
        }
    }

    async function deleteSprite(setName, emotion, filename) {
        if (!confirm(`确定要删除 ${setName} 套装的 ${emotion} 表情吗？`)) return;
        try {
            const res = await fetch('/api/sprites/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_id: currentCharacterId.value,
                    set_name: setName,
                    emotion,
                    filename
                })
            });
            const data = await res.json();
            if (data.success) {
                await loadSpriteSets();
            } else {
                alert('删除失败: ' + data.message);
            }
        } catch (e) {
            alert('删除异常');
        }
    }

    // 3. 互动反应词库与离线语音管理
    async function loadReactions() {
        try {
            const res = await fetch('/api/pet_reactions');
            const data = await res.json();
            if (data.success) {
                if (data.reactions) {
                    Object.keys(reactions).forEach(k => {
                        reactions[k] = data.reactions[k] || [];
                    });
                }
                if (data.reactions_detail) {
                    Object.keys(reactionsDetail).forEach(k => {
                        reactionsDetail[k] = (data.reactions_detail[k] || []).map(item => ({
                            ...item,
                            isPlaying: false
                        }));
                    });
                }
            }
        } catch (e) {
            console.error('加载反应词库失败:', e);
        }
    }

    async function handleAddReaction(emotion) {
        const text = (newReactionInputs[emotion] || '').trim();
        if (!text) return;
        newReactionInputs[emotion] = '';
        await addReaction(emotion, text);
    }

    async function addReaction(emotion, text) {
        if (!text || !text.trim()) return;
        try {
            const res = await fetch('/api/pet_reactions/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion, text: text.trim() })
            });
            const data = await res.json();
            if (data.success) {
                await loadReactions();
            } else {
                alert('添加反应词失败: ' + data.error);
            }
        } catch (e) {
            alert('添加反应词异常');
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
            if (data.success) {
                await loadReactions();
            }
        } catch (e) {
            alert('删除反应词异常');
        }
    }

    async function regenerateReactions() {
        if (!confirm('确定要清空并重新生成这套角色的 5x5 应付词库吗？')) return;
        try {
            const res = await fetch('/api/pet_reactions/regenerate', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('已触发后台生成，系统正在精修生成中，请稍后刷新。');
                setTimeout(() => loadReactions(), 3000);
            }
        } catch (e) {
            alert('重新生成失败');
        }
    }

    // 单句试听与即时录制
    async function playOrRecordReaction(emotion, item) {
        if (item.isPlaying) {
            previewAudio.pause();
            item.isPlaying = false;
            return;
        }

        // 如果已有离线语音，直接播放
        if (item.has_audio && item.audio_url) {
            item.isPlaying = true;
            previewAudio.src = item.audio_url;
            previewAudio.play().catch(e => console.log(e));
            previewAudio.onended = () => { item.isPlaying = false; };
            previewAudio.onerror = () => { item.isPlaying = false; };
            return;
        }

        // 尚未录制，立即调用单句录制流水线
        item.isPlaying = true;
        try {
            const res = await fetch('/api/pet_reactions/record_single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_id: currentCharacterId.value,
                    emotion: emotion,
                    text: item.text
                })
            });
            const data = await res.json();
            if (data.success && data.audio_url) {
                item.has_audio = true;
                item.audio_url = data.audio_url;
                previewAudio.src = data.audio_url;
                previewAudio.play().catch(e => console.log(e));
                previewAudio.onended = () => { item.isPlaying = false; };
                previewAudio.onerror = () => { item.isPlaying = false; };
            } else {
                item.isPlaying = false;
                alert('语音录制失败: ' + (data.error || 'TTS 服务异常'));
            }
        } catch (e) {
            item.isPlaying = false;
            alert('录制请求异常: ' + e);
        }
    }

    // 全量批量精修与录制流水线
    async function startBatchRecording(forceOverwrite = false) {
        if (isBatchRecording.value) return;
        try {
            const res = await fetch('/api/pet_reactions/batch_generate_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_id: currentCharacterId.value,
                    force_overwrite: forceOverwrite
                })
            });
            const data = await res.json();
            if (data.success) {
                isBatchRecording.value = true;
                pollBatchProgress();
            } else {
                alert(data.message || '启动批量录制失败');
            }
        } catch (e) {
            alert('启动批量录制异常: ' + e);
        }
    }

    function pollBatchProgress() {
        if (batchPollTimer) clearInterval(batchPollTimer);
        batchPollTimer = setInterval(async () => {
            try {
                const res = await fetch('/api/pet_reactions/batch_progress');
                const data = await res.json();
                batchProgress.total = data.total || 0;
                batchProgress.completed = data.completed || 0;
                batchProgress.percent = data.percent || 0;
                batchProgress.current_emotion = data.current_emotion || '';
                batchProgress.current_text = data.current_text || '';
                batchProgress.errors = data.errors || [];
                isBatchRecording.value = !!data.is_running;

                if (!data.is_running) {
                    clearInterval(batchPollTimer);
                    batchPollTimer = null;
                    await loadReactions();
                }
            } catch (e) {
                console.error('查询批量录制进度失败:', e);
            }
        }, 1000);
    }

    async function stopBatchRecording() {
        try {
            await fetch('/api/pet_reactions/stop_batch', { method: 'POST' });
            isBatchRecording.value = false;
            if (batchPollTimer) {
                clearInterval(batchPollTimer);
                batchPollTimer = null;
            }
            await loadReactions();
        } catch (e) {
            console.error('停止批量录制失败:', e);
        }
    }

    return {
        charactersList,
        currentCharacterId,
        characterInfo,
        spriteSets,
        activeSpriteSet,
        selectedSpriteSet,
        isLive2DMode,
        reactions,
        reactionsDetail,
        newReactionInputs,
        emotionNames,
        emotionIcons,
        isGeneratingReactions,
        isBatchRecording,
        batchProgress,
        loadCharacters,
        loadCharacterInfo,
        switchCharacter,
        saveCharacterPrompt,
        loadSpriteSets,
        setActiveSpriteSet,
        uploadSprites,
        deleteSprite,
        loadReactions,
        handleAddReaction,
        addReaction,
        deleteReaction,
        regenerateReactions,
        playOrRecordReaction,
        startBatchRecording,
        stopBatchRecording
    };
};
