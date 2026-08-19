// useCharacter.js - 角色配置、立绘与换装管理、反应词库与沉浸模式模块
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
        happy: [],
        shy: [],
        angry: [],
        crying: [],
        sleeping: []
    });
    const isGeneratingReactions = ref(false);

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
        if (!charId || charId === currentCharacterId.value) return;
        try {
            const res = await fetch('/api/characters/switch', {
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
                alert(`已成功切换当前角色为: ${data.name || charId}`);
            } else {
                alert('切换角色失败: ' + (data.error || '未知原因'));
            }
        } catch (e) {
            console.error('切换角色异常:', e);
            alert('切换角色网络异常');
        }
    }

    async function saveCharacterPrompt() {
        try {
            const res = await fetch('/api/settings/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_prompt: characterInfo.system_prompt,
                    user_prompt: characterInfo.user_prompt,
                    enable_greeting: characterInfo.enable_greeting,
                    enable_auto_speak: characterInfo.enable_auto_speak
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('角色人设配置已保存！');
            } else {
                alert('保存失败: ' + (data.error || ''));
            }
        } catch (e) {
            alert('保存异常');
        }
    }

    // 2. 立绘与换装管理
    async function loadSpriteSets() {
        try {
            const res = await fetch('/api/sprites/list');
            const data = await res.json();
            if (data.success && data.sets) {
                spriteSets.value = data.sets;
                activeSpriteSet.value = data.active_set || '';
                if (!selectedSpriteSet.value || !data.sets[selectedSpriteSet.value]) {
                    selectedSpriteSet.value = data.active_set || Object.keys(data.sets)[0] || '';
                }
            }
        } catch (e) {
            console.error('加载立绘套装列表失败:', e);
        }
    }

    async function setActiveSpriteSet(setName) {
        if (!setName) return;
        try {
            const res = await fetch('/api/sprites/set_active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ set_name: setName })
            });
            const data = await res.json();
            if (data.success) {
                activeSpriteSet.value = setName;
                alert(`已应用套装《${setName}》为当前桌宠立绘！`);
            } else {
                alert('设置活动套装失败: ' + data.message);
            }
        } catch (e) {
            alert('设置活动套装异常');
        }
    }

    async function uploadSprites(setName, emotion, files) {
        if (!files || files.length === 0) return;
        const formData = new FormData();
        formData.append('set_name', setName);
        formData.append('emotion', emotion);
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        try {
            const res = await fetch('/api/sprites/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert('立绘上传成功！');
                await loadSpriteSets();
            } else {
                alert('上传失败: ' + data.message);
            }
        } catch (e) {
            alert('上传异常');
        }
    }

    async function deleteSprite(setName, filename) {
        const confirmed = await window.asyncConfirm(`确定要删除立绘文件 ${filename} 吗？`);
        if (!confirmed) return;

        try {
            const res = await fetch('/api/sprites/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ set_name: setName, filename: filename })
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

    // 3. 互动反应词库
    async function loadReactions() {
        try {
            const res = await fetch('/api/reactions');
            const data = await res.json();
            if (data.success && data.reactions) {
                Object.keys(reactions).forEach(k => {
                    reactions[k] = data.reactions[k] || [];
                });
            }
        } catch (e) {
            console.error('加载反应词库失败:', e);
        }
    }

    async function addReaction(emotion, text) {
        if (!text || !text.trim()) return;
        try {
            const res = await fetch('/api/reactions/add', {
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
            const res = await fetch('/api/reactions/delete', {
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

    return {
        charactersList,
        currentCharacterId,
        characterInfo,
        spriteSets,
        activeSpriteSet,
        selectedSpriteSet,
        isLive2DMode,
        reactions,
        isGeneratingReactions,
        loadCharacters,
        loadCharacterInfo,
        switchCharacter,
        saveCharacterPrompt,
        loadSpriteSets,
        setActiveSpriteSet,
        uploadSprites,
        deleteSprite,
        loadReactions,
        addReaction,
        deleteReaction
    };
};
