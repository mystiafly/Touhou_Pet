// engine_settings.js - 大脑引擎配置、多模型分工、自定义API与模型管理
document.addEventListener('DOMContentLoaded', () => {
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
        
        const tempText = engine.temperature !== undefined ? `${parseFloat(engine.temperature).toFixed(2)}` : '0.70 (默认)';
        item.innerHTML = `
            <div>
                <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                    ${engine.name}
                    <span style="font-size: 11px; background: rgba(189, 147, 249, 0.2); color: #bd93f9; padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(189, 147, 249, 0.3);">Temp: ${tempText}</span>
                </div>
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

    const engTemp = engine.temperature !== undefined ? parseFloat(engine.temperature) : 0.7;
    const tempSlider = document.getElementById('engine-temperature-slider');
    const tempInput = document.getElementById('engine-temperature');
    const tempVal = document.getElementById('engine-temperature-val');
    if (tempSlider) tempSlider.value = engTemp;
    if (tempInput) tempInput.value = engTemp;
    if (tempVal) tempVal.textContent = engTemp.toFixed(2);

    document.getElementById('btn-save-engine').disabled = true; // 需重新测试才能保存
    
    document.getElementById('engine-model-select').style.display = 'none';
    document.getElementById('engine-model-name').style.display = 'block';
};

window.deleteCustomEngine = async function(id) {
    if(!await window.asyncConfirm("确定要删除此引擎配置吗？")) return;
    try {
        const res = await fetch(`/api/engines/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) {
            await loadCustomEngines();
            // 重新设置 select value 避免空状态
            const apiSelect = document.getElementById('api-provider-select');
            if(apiSelect.value === id) {
                if (apiSelect.options.length > 0) {
                    apiSelect.selectedIndex = 0;
                } else {
                    apiSelect.value = '';
                }
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

            const tempSlider = document.getElementById('engine-temperature-slider');
            const tempInput = document.getElementById('engine-temperature');
            const tempVal = document.getElementById('engine-temperature-val');
            if (tempSlider) tempSlider.value = 0.7;
            if (tempInput) tempInput.value = 0.7;
            if (tempVal) tempVal.textContent = '0.70';

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

    // 引擎弹窗内温度滑块与数值输入联动
    const engineTempSlider = document.getElementById('engine-temperature-slider');
    const engineTempInput = document.getElementById('engine-temperature');
    const engineTempVal = document.getElementById('engine-temperature-val');
    if (engineTempSlider && engineTempInput) {
        engineTempSlider.addEventListener('input', (e) => {
            const num = parseFloat(e.target.value) || 0.7;
            engineTempInput.value = num;
            if (engineTempVal) engineTempVal.textContent = num.toFixed(2);
        });
        engineTempInput.addEventListener('input', (e) => {
            const num = Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.7));
            engineTempSlider.value = num;
            if (engineTempVal) engineTempVal.textContent = num.toFixed(2);
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
            const temperature = engineTempInput ? (parseFloat(engineTempInput.value) || 0.7) : 0.7;
            
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
                    body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, model_name: modelName, temperature: temperature })
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
            const temperature = engineTempInput ? (parseFloat(engineTempInput.value) || 0.7) : 0.7;
            
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
                        id, name, base_url: baseUrl, api_key: apiKey, model_name: modelName, temperature: temperature
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
    }

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
                
                const preApiSelect = document.getElementById('pre-api-provider-select');
                if (preApiSelect && configData.pre_api_provider) {
                    preApiSelect.value = configData.pre_api_provider;
                }
                
                const postApiSelect = document.getElementById('post-api-provider-select');
                if (postApiSelect && configData.post_api_provider) {
                    postApiSelect.value = configData.post_api_provider;
                }
                
                const flowModeToggle = document.getElementById('flow-mode-toggle');
                if (flowModeToggle) {
                    flowModeToggle.checked = !!configData.flow_mode;
                }
                
                const historyStepSelect = document.getElementById('history-step-multiplier-select');
                if (historyStepSelect && configData.history_step_multiplier !== undefined) {
                    historyStepSelect.value = configData.history_step_multiplier.toString();
                }

                const globalTempSlider = document.getElementById('global-temperature-slider');
                const globalTempInput = document.getElementById('global-temperature-input');
                const globalTempVal = document.getElementById('global-temperature-val');
                const globalTemp = configData.temperature !== undefined ? parseFloat(configData.temperature) : 0.7;
                if (globalTempSlider) globalTempSlider.value = globalTemp;
                if (globalTempInput) globalTempInput.value = globalTemp;
                if (globalTempVal) globalTempVal.textContent = globalTemp.toFixed(2);
                
                const mainDisplay = document.getElementById('main-api-provider-display');
                if (mainDisplay) {
                    const selectedOpt = apiSelect.options[apiSelect.selectedIndex];
                    mainDisplay.value = selectedOpt ? selectedOpt.text : apiSelect.value;
                }
                
                const personaPromptArea = document.getElementById('persona-prompt');
                if (personaPromptArea && configData.persona_prompt !== undefined) {
                    personaPromptArea.value = configData.persona_prompt;
                }
                
                const userPromptArea = document.getElementById('user-prompt');
                if (userPromptArea && configData.user_prompt !== undefined) {
                    userPromptArea.value = configData.user_prompt;
                }

                const immersiveWallpaperInput = document.getElementById('immersive-wallpaper-input');
                const wallpaperFitSelect = document.getElementById('wallpaper-fit-select');
                if (wallpaperFitSelect && configData.wallpaper_fit !== undefined) {
                    wallpaperFitSelect.value = configData.wallpaper_fit;
                }
                if (immersiveWallpaperInput) {
                    const url = configData.immersive_wallpaper || configData.wallpaper_url || "";
                    immersiveWallpaperInput.value = url;
                    updateWallpaperPreview(url, configData.wallpaper_fit || 'cover');
                }

                const bgmInput = document.getElementById('immersive-bgm-input');
                if (bgmInput && configData.immersive_bgm_url !== undefined) {
                    bgmInput.value = configData.immersive_bgm_url;
                }
                const bgmToggle = document.getElementById('immersive-bgm-toggle');
                if (bgmToggle) {
                    bgmToggle.checked = configData.enable_immersive_bgm !== false;
                }

                const starlightToggle = document.getElementById('immersive-effect-starlight');
                if (starlightToggle) {
                    starlightToggle.checked = !!configData.enable_immersive_starlight;
                }

                const meteorsToggle = document.getElementById('immersive-effect-meteors');
                if (meteorsToggle) {
                    meteorsToggle.checked = !!configData.enable_immersive_meteors;
                }

                const parallaxToggle = document.getElementById('immersive-effect-parallax');
                if (parallaxToggle) {
                    parallaxToggle.checked = !!configData.enable_immersive_parallax;
                }

                const screenshotBtnToggle = document.getElementById('immersive-effect-screenshot-btn');
                if (screenshotBtnToggle) {
                    screenshotBtnToggle.checked = !!configData.enable_immersive_screenshot_btn;
                }
                
                const greetingToggle = document.getElementById('greeting-toggle');
                if (greetingToggle) {
                    greetingToggle.checked = configData.enable_greeting !== false;
                }
                
                const autoSpeakToggle = document.getElementById('auto-speak-toggle');
                if (autoSpeakToggle) {
                    autoSpeakToggle.checked = configData.enable_auto_speak !== false;
                }

                const autoMinimizeGameToggle = document.getElementById('auto-minimize-fullscreen-game-toggle');
                if (autoMinimizeGameToggle) {
                    autoMinimizeGameToggle.checked = configData.auto_minimize_on_fullscreen_game !== false;
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

                const showThoughtBtnToggle = document.getElementById('show-thought-button-toggle');
                if (showThoughtBtnToggle) {
                    showThoughtBtnToggle.checked = configData.show_thought_button !== false;
                }

                const showToolCallsToggle = document.getElementById('show-tool-calls-toggle');
                if (showToolCallsToggle) {
                    showToolCallsToggle.checked = configData.show_tool_calls !== false;
                }

                const autoStartToggle = document.getElementById('auto-start-toggle');
                if (autoStartToggle) {
                    autoStartToggle.checked = configData.auto_start_on_boot === true;
                }

                const ttsClickToggle = document.getElementById('tts-mode-click-toggle');
                const ttsAutoToggle = document.getElementById('tts-mode-auto-toggle');
                if (ttsClickToggle) {
                    ttsClickToggle.checked = configData.enable_tts_click !== false;
                }
                if (ttsAutoToggle) {
                    ttsAutoToggle.checked = configData.enable_tts_auto === true || configData.tts_speak_mode === 'auto';
                }

                const ttsProviderSelect = document.getElementById('tts-provider-select');
                if (ttsProviderSelect && configData.tts_provider) {
                    ttsProviderSelect.value = configData.tts_provider;
                }

                const fishAudioKeyInput = document.getElementById('fish-audio-key-input');
                if (fishAudioKeyInput) {
                    fishAudioKeyInput.value = configData.tts_api_key || configData.fish_audio_api_key || "";
                }

                const fishAudioUrlInput = document.getElementById('fish-audio-url-input');
                if (fishAudioUrlInput) {
                    fishAudioUrlInput.value = configData.tts_base_url || configData.fish_audio_base_url || "https://api.fish.audio/v1/tts";
                }

                const gptsovitsUrlInput = document.getElementById('gptsovits-url-input');
                if (gptsovitsUrlInput && configData.tts_base_url && configData.tts_base_url.includes('9880')) {
                    gptsovitsUrlInput.value = configData.tts_base_url;
                }

                // 初始化选中当前 TTS 引擎卡片与面板
                const currentTtsProvider = configData.tts_provider || "fish_audio";
                if (window.selectTtsEngine) {
                    window.selectTtsEngine(currentTtsProvider, true);
                }

                const ttsLangSelect = document.getElementById('character-tts-language-select');
                if (ttsLangSelect && configData.tts_language) {
                    ttsLangSelect.value = configData.tts_language;
                }

                const charTtsZhInput = document.getElementById('character-tts-voice-zh');
                if (charTtsZhInput && (configData.tts_voice_zh !== undefined || configData.tts_voice_id !== undefined)) {
                    charTtsZhInput.value = configData.tts_voice_zh || configData.tts_voice_id || "";
                }
                const charTtsJaInput = document.getElementById('character-tts-voice-ja');
                if (charTtsJaInput && configData.tts_voice_ja !== undefined) {
                    charTtsJaInput.value = configData.tts_voice_ja;
                }
                const charTtsEnInput = document.getElementById('character-tts-voice-en');
                if (charTtsEnInput && configData.tts_voice_en !== undefined) {
                    charTtsEnInput.value = configData.tts_voice_en;
                }

                // 同步初始化 Edge-TTS 音色下拉选择
                const edgeZhSelect = document.getElementById('edge-voice-zh-select');
                if (edgeZhSelect && configData.tts_voice_zh) {
                    edgeZhSelect.value = configData.tts_voice_zh;
                }
                const edgeJaSelect = document.getElementById('edge-voice-ja-select');
                if (edgeJaSelect && configData.tts_voice_ja) {
                    edgeJaSelect.value = configData.tts_voice_ja;
                }
                const edgeEnSelect = document.getElementById('edge-voice-en-select');
                if (edgeEnSelect && configData.tts_voice_en) {
                    edgeEnSelect.value = configData.tts_voice_en;
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

                const charNameInput = document.getElementById('character-name-input');
                if (charNameInput && configData.character_name !== undefined) {
                    charNameInput.value = configData.character_name;
                }

                const charIdInput = document.getElementById('character-id-input');
                if (charIdInput && configData.character_id !== undefined) {
                    charIdInput.value = configData.character_id;
                }

                if (configData.theme_color) {
                    if (window.applyDashboardThemeColor) {
                        window.applyDashboardThemeColor(configData.theme_color);
                    }
                    document.querySelectorAll('.theme-color-swatch').forEach(s => {
                        s.classList.toggle('selected', s.dataset.color === configData.theme_color);
                    });
                }
            }



            // 加载动态角色列表
            // 加载动态角色列表与角色管理中心网格
            try {
                const charsResponse = await fetch('/api/characters/list');
                const charsData = await charsResponse.json();
                if (charsData.status === "success" || charsData.characters) {
                    if (charSelect) {
                        charSelect.innerHTML = "";
                        charsData.characters.forEach(c => {
                            const option = document.createElement("option");
                            option.value = c.character_id;
                            option.innerText = `${c.character_name} (${c.character_id})`;
                            charSelect.appendChild(option);
                        });
                    }
                    if (window.renderCharacterManagementGrid) {
                        window.renderCharacterManagementGrid(charsData.characters, charsData.active_character || charData.character_id);
                    }
                }
            } catch (e) {
                console.error("加载角色列表失败:", e);
            }

            if (charSelect && charData.character_id) {
                charSelect.value = charData.character_id;
            }
            if (charData.character_id) {
                const avatarImg = document.getElementById('current-char-avatar-img');
                if (avatarImg) {
                    avatarImg.src = `/api/characters/${charData.character_id}/avatar?t=${Date.now()}`;
                }
                if (window.refreshAvatarPreview) {
                    window.refreshAvatarPreview(charData.character_id);
                }
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

    const flowModeToggle = document.getElementById('flow-mode-toggle');
    if (flowModeToggle) {
        flowModeToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ flow_mode: flowModeToggle.checked })
                });
            } catch (e) {
                console.error("保存心流模式失败:", e);
            }
        });
    }

    const historyStepSelect = document.getElementById('history-step-multiplier-select');
    if (historyStepSelect) {
        historyStepSelect.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ history_step_multiplier: parseInt(historyStepSelect.value) })
                });
            } catch (e) {
                console.error("保存阶梯倍率失败:", e);
            }
        });
    }

    const globalTempSlider = document.getElementById('global-temperature-slider');
    const globalTempInput = document.getElementById('global-temperature-input');
    const globalTempVal = document.getElementById('global-temperature-val');
    if (globalTempSlider && globalTempInput) {
        const syncGlobalTemp = async (val, save = false) => {
            const num = Math.max(0, Math.min(2, parseFloat(val) || 0.7));
            globalTempSlider.value = num;
            globalTempInput.value = num;
            if (globalTempVal) globalTempVal.textContent = num.toFixed(2);
            if (save) {
                try {
                    await fetch('/api/settings/config', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ temperature: num })
                    });
                } catch (e) {
                    console.error("保存全局温度失败:", e);
                }
            }
        };
        globalTempSlider.addEventListener('input', (e) => syncGlobalTemp(e.target.value, false));
        globalTempSlider.addEventListener('change', (e) => syncGlobalTemp(e.target.value, true));
        globalTempInput.addEventListener('input', (e) => syncGlobalTemp(e.target.value, false));
        globalTempInput.addEventListener('change', (e) => syncGlobalTemp(e.target.value, true));
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

    const personaPromptArea = document.getElementById('persona-prompt');
    if (personaPromptArea) {
        personaPromptArea.addEventListener('change', async () => {
            try {
                const response = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ persona_prompt: personaPromptArea.value })
                });
                const data = await response.json();
                if (!data.success) {
                    alert("保存 角色核心词 失败: " + data.error);
                }
            } catch (e) {
                alert("保存失败！");
            }
        });
    }

    function updateWallpaperPreview(url, fitMode) {
        const previewImg = document.getElementById('wallpaper-preview-img');
        const previewPlaceholder = document.getElementById('wallpaper-preview-placeholder');
        const wallpaperFitSelect = document.getElementById('wallpaper-fit-select');
        const mode = fitMode || (wallpaperFitSelect ? wallpaperFitSelect.value : 'cover');

        if (previewImg && previewPlaceholder) {
            if (url && url.trim()) {
                previewImg.src = url.trim();
                if (mode === 'auto') {
                    previewImg.style.objectFit = 'none';
                } else if (mode === '100% 100%') {
                    previewImg.style.objectFit = 'fill';
                } else {
                    previewImg.style.objectFit = mode;
                }
                previewImg.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                previewPlaceholder.style.display = 'block';
            }
        }
    }

    const immersiveWallpaperInput = document.getElementById('immersive-wallpaper-input');
    const wallpaperFitSelect = document.getElementById('wallpaper-fit-select');
    const previewWallpaperBtn = document.getElementById('preview-wallpaper-btn');
    const uploadWallpaperBtn = document.getElementById('upload-wallpaper-btn');
    const wallpaperFileInput = document.getElementById('wallpaper-file-input');

    if (uploadWallpaperBtn && wallpaperFileInput) {
        uploadWallpaperBtn.addEventListener('click', () => {
            wallpaperFileInput.click();
        });

        wallpaperFileInput.addEventListener('change', async () => {
            if (!wallpaperFileInput.files || wallpaperFileInput.files.length === 0) return;
            const file = wallpaperFileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            const origHtml = uploadWallpaperBtn.innerHTML;
            uploadWallpaperBtn.disabled = true;
            uploadWallpaperBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';

            try {
                const response = await fetch('/api/character/upload_wallpaper', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success && data.wallpaper_url) {
                    if (immersiveWallpaperInput) {
                        immersiveWallpaperInput.value = data.wallpaper_url;
                    }
                    updateWallpaperPreview(data.wallpaper_url);
                } else {
                    alert("壁纸上传失败: " + (data.message || "未知错误"));
                }
            } catch (e) {
                console.error("壁纸上传出错:", e);
                alert("壁纸上传出错，请重试！");
            } finally {
                uploadWallpaperBtn.disabled = false;
                uploadWallpaperBtn.innerHTML = origHtml;
                wallpaperFileInput.value = '';
            }
        });
    }

    if (immersiveWallpaperInput) {
        immersiveWallpaperInput.addEventListener('change', async () => {
            const val = immersiveWallpaperInput.value.trim();
            updateWallpaperPreview(val);
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ immersive_wallpaper: val })
                });
            } catch (e) {
                console.error("保存沉浸壁纸失败:", e);
            }
        });
    }

    const uploadBgmBtn = document.getElementById('upload-bgm-btn');
    const bgmFileInput = document.getElementById('bgm-file-input');
    const immersiveBgmInput = document.getElementById('immersive-bgm-input');
    const immersiveBgmToggle = document.getElementById('immersive-bgm-toggle');
    const testBgmBtn = document.getElementById('test-bgm-btn');
    const dashboardBgmPreview = document.getElementById('dashboard-bgm-preview');

    if (uploadBgmBtn && bgmFileInput) {
        uploadBgmBtn.addEventListener('click', () => {
            bgmFileInput.click();
        });

        bgmFileInput.addEventListener('change', async () => {
            if (!bgmFileInput.files || bgmFileInput.files.length === 0) return;
            const file = bgmFileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            const origHtml = uploadBgmBtn.innerHTML;
            uploadBgmBtn.disabled = true;
            uploadBgmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';

            try {
                const response = await fetch('/api/character/upload_bgm', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success && data.bgm_url) {
                    if (immersiveBgmInput) {
                        immersiveBgmInput.value = data.bgm_url;
                    }
                    if (immersiveBgmToggle) {
                        immersiveBgmToggle.checked = true;
                    }
                    alert("背景音乐上传并自动应用成功！");
                } else {
                    alert("音乐上传失败: " + (data.message || "未知错误"));
                }
            } catch (e) {
                console.error("音乐上传出错:", e);
                alert("音乐上传出错，请重试！");
            } finally {
                uploadBgmBtn.disabled = false;
                uploadBgmBtn.innerHTML = origHtml;
                bgmFileInput.value = '';
            }
        });
    }

    if (immersiveBgmInput) {
        immersiveBgmInput.addEventListener('change', async () => {
            const val = immersiveBgmInput.value.trim();
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ immersive_bgm_url: val })
                });
            } catch (e) {
                console.error("保存 BGM 失败:", e);
            }
        });
    }

    if (immersiveBgmToggle) {
        immersiveBgmToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_bgm: immersiveBgmToggle.checked })
                });
            } catch (e) {
                console.error("保存 BGM 开关失败:", e);
            }
        });
    }

    const starlightToggle = document.getElementById('immersive-effect-starlight');
    if (starlightToggle) {
        starlightToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_starlight: starlightToggle.checked })
                });
            } catch (e) {
                console.error("保存星光特效开关失败:", e);
            }
        });
    }

    const meteorsToggle = document.getElementById('immersive-effect-meteors');
    if (meteorsToggle) {
        meteorsToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_meteors: meteorsToggle.checked })
                });
            } catch (e) {
                console.error("保存流星特效开关失败:", e);
            }
        });
    }

    const parallaxToggle = document.getElementById('immersive-effect-parallax');
    if (parallaxToggle) {
        parallaxToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_parallax: parallaxToggle.checked })
                });
            } catch (e) {
                console.error("保存视差移动开关失败:", e);
            }
        });
    }

    const screenshotBtnToggle = document.getElementById('immersive-effect-screenshot-btn');
    if (screenshotBtnToggle) {
        screenshotBtnToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enable_immersive_screenshot_btn: screenshotBtnToggle.checked })
                });
            } catch (e) {
                console.error("保存截图按钮显示开关失败:", e);
            }
        });
    }

    if (testBgmBtn && dashboardBgmPreview) {
        testBgmBtn.addEventListener('click', () => {
            const url = immersiveBgmInput ? immersiveBgmInput.value.trim() : "";
            if (!url) {
                alert("请先选择或输入音乐 URL / 路径！");
                return;
            }
            if (!dashboardBgmPreview.paused && dashboardBgmPreview.src.includes(url)) {
                dashboardBgmPreview.pause();
                testBgmBtn.innerHTML = '<i class="fas fa-play"></i> 试听';
            } else {
                dashboardBgmPreview.src = url;
                dashboardBgmPreview.play().then(() => {
                    testBgmBtn.innerHTML = '<i class="fas fa-pause"></i> 停止';
                }).catch(e => {
                    alert("播放试听音频失败: " + e.toString());
                });
            }
        });
        dashboardBgmPreview.addEventListener('ended', () => {
            testBgmBtn.innerHTML = '<i class="fas fa-play"></i> 试听';
        });
    }

    if (wallpaperFitSelect) {
        wallpaperFitSelect.addEventListener('change', async () => {
            const fitVal = wallpaperFitSelect.value;
            const urlVal = immersiveWallpaperInput ? immersiveWallpaperInput.value.trim() : "";
            updateWallpaperPreview(urlVal, fitVal);
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ wallpaper_fit: fitVal })
                });
            } catch (e) {
                console.error("保存壁纸适应模式失败:", e);
            }
        });
    }

    if (previewWallpaperBtn && immersiveWallpaperInput) {
        previewWallpaperBtn.addEventListener('click', () => {
            updateWallpaperPreview(immersiveWallpaperInput.value.trim());
        });
    }

    // --------------------------------------------------------------------------
    // Steam Wallpaper Engine 联动壁纸管理
    // --------------------------------------------------------------------------
    function initWallpaperEngineManager() {
        const scanBtn = document.getElementById('scan-we-btn');
        const customPathInput = document.getElementById('we-custom-path-input');
        const statusDiv = document.getElementById('we-scan-status');
        const gridDiv = document.getElementById('we-wallpaper-grid');
        const transparentBtn = document.getElementById('use-transparent-mode-btn');

        if (!gridDiv) return;

        async function fetchAndRenderWEWallpapers(customPath = "") {
            statusDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>正在扫描 Steam 创意工坊壁纸中...</span>`;
            gridDiv.innerHTML = '';

            try {
                const url = customPath ? `/api/wallpaper_engine/scan?custom_path=${encodeURIComponent(customPath)}` : '/api/wallpaper_engine/scan';
                const res = await fetch(url);
                const data = await res.json();

                if (data.success && data.items && data.items.length > 0) {
                    if (data.scanned_path && customPathInput && !customPathInput.value) {
                        customPathInput.value = data.scanned_path;
                    }
                    statusDiv.innerHTML = `<i class="fas fa-check-circle" style="color: #50fa7b;"></i> <span>已找到 ${data.items.length} 个创意工坊壁纸 (检索路径: ${data.scanned_path})</span>`;
                    
                    data.items.forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'we-wallpaper-card';
                        card.style.cssText = `
                            background: rgba(30, 31, 41, 0.7);
                            border: 1px solid rgba(255, 255, 255, 0.12);
                            border-radius: 12px;
                            overflow: hidden;
                            display: flex;
                            flex-direction: column;
                            transition: all 0.3s ease;
                            cursor: pointer;
                            position: relative;
                        `;

                        let badgeColor = '#bd93f9';
                        let typeText = item.type;
                        if (item.type === 'video') { badgeColor = '#ff79c6'; typeText = '视频 (MP4)'; }
                        else if (item.type === 'scene') { badgeColor = '#8be9fd'; typeText = '3D/场景'; }
                        else if (item.type === 'web') { badgeColor = '#50fa7b'; typeText = '网页 (HTML5)'; }

                        card.innerHTML = `
                            <div style="width: 100%; height: 130px; background: #181926; position: relative; overflow: hidden;">
                                <img src="${item.preview_url || ''}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">
                                <span style="position: absolute; top: 8px; right: 8px; background: ${badgeColor}; color: #181926; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${typeText}</span>
                            </div>
                            <div style="padding: 10px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div style="font-weight: 600; font-size: 13px; color: #f8f8f2; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.title}">${item.title}</div>
                                <button class="apply-we-btn action-btn outline" style="width: 100%; font-size: 12px; padding: 6px; border-color: rgba(255,255,255,0.2);">
                                    <i class="fas fa-check"></i> 应用此壁纸
                                </button>
                            </div>
                        `;

                        const applyBtn = card.querySelector('.apply-we-btn');
                        applyBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await selectWEWallpaper(item);
                        });
                        card.addEventListener('click', async () => {
                            await selectWEWallpaper(item);
                        });

                        gridDiv.appendChild(card);
                    });
                } else {
                    statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #ffb86c;"></i> <span>未在该路径找到 Steam 壁纸文件，请尝试在上方输入自定义 Workshop 路径</span>`;
                }
            } catch (err) {
                console.error("扫描 WE 壁纸库失败:", err);
                statusDiv.innerHTML = `<i class="fas fa-times-circle" style="color: #ff5555;"></i> <span>扫描失败，请检查网络或路径</span>`;
            }
        }

        async function selectWEWallpaper(item) {
            let mode = 'image';
            let mediaUrl = item.media_url || item.preview_url;
            let wallpaperUrl = item.preview_url;
            let bgmUrl = item.extracted_bgm_url || "";
            let noteText = "";

            if (item.type === 'video') {
                mode = 'video';
                noteText = "已成功设置为【沙盒视频壁纸】！在桌宠沉浸模式内独立全屏播放 60 帧视频，绝不影响或修改你系统原本的桌面壁纸！";
            } else if (item.type === 'web') {
                mode = 'web';
                noteText = "已成功设置为【沙盒网页壁纸】！在桌宠沉浸模式内独立全屏渲染 WebGL 特效，绝不修改你系统原本的桌面壁纸！";
            } else if (item.type === 'scene') {
                if (!item.extracted_bg_url) {
                    try {
                        const unpackRes = await fetch('/api/wallpaper_engine/unpack', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folder_path: item.folder_path })
                        });
                        const unpackData = await unpackRes.json();
                        if (unpackData.success) {
                            item.extracted_bg_url = unpackData.extracted_bg_url;
                            item.extracted_bgm_url = unpackData.extracted_bgm_url;
                        }
                    } catch (e) {
                        console.error("按需解包失败:", e);
                    }
                }

                mode = 'scene_extracted';
                wallpaperUrl = item.extracted_bg_url || item.preview_url;
                mediaUrl = wallpaperUrl;
                bgmUrl = item.extracted_bgm_url || "";
                noteText = "已成功设置为【沙盒 4K 极清动态场景壁纸】！\n\n自动在桌宠全屏舞台中呈现 4K 无损底图 + 流星与群星特效 + 原版 BGM 音频！遮挡一切桌面应用与任务栏，且 100% 沙盒隔离，完全不触动或修改你电脑原有的壁纸！";
            } else {
                mode = 'image';
                mediaUrl = item.preview_url;
                noteText = "已成功设置为【沙盒图片壁纸】。";
            }

            try {
                const res = await fetch('/api/character/save_immersive_config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        immersive_bg_mode: mode,
                        immersive_media_url: mediaUrl,
                        immersive_wallpaper: wallpaperUrl,
                        immersive_bgm_url: bgmUrl
                    })
                });
                const data = await res.json();
                if (data.success) {
                    updateWallpaperPreview(wallpaperUrl);
                    alert(`已成功选择壁纸《${item.title}》！\n\n${noteText}`);
                }
            } catch (err) {
                console.error("保存 WE 壁纸配置失败:", err);
            }
        }

        if (transparentBtn) {
            transparentBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch('/api/character/save_immersive_config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            immersive_bg_mode: 'transparent'
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("已成功切换为“桌面透明透传模式”！在沉浸模式下背景将保持透明，透传桌面正在运行的 Wallpaper Engine 动态动画。");
                    }
                } catch (err) {
                    console.error("保存透明模式失败:", err);
                }
            });
        }

        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                const customPath = customPathInput ? customPathInput.value.trim() : "";
                fetchAndRenderWEWallpapers(customPath);
            });
        }

        // 默认自动扫描一次
        fetchAndRenderWEWallpapers();
    }

    initWallpaperEngineManager();

    const themeSwatches = document.querySelectorAll('.theme-color-swatch:not([data-color="custom"])');
    const customThemePicker = document.getElementById('custom-theme-color-picker');
    
    function saveThemeColor(color) {
        if (window.applyDashboardThemeColor) window.applyDashboardThemeColor(color);
        document.querySelectorAll('.theme-color-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.color === color);
        });
        fetch('/api/settings/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ theme_color: color })
        }).catch(e => console.error(e));
    }
    
    themeSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            saveThemeColor(swatch.dataset.color);
        });
    });
    
    if (customThemePicker) {
        customThemePicker.addEventListener('input', (e) => {
            if (window.applyDashboardThemeColor) window.applyDashboardThemeColor(e.target.value);
            document.querySelectorAll('.theme-color-swatch').forEach(s => s.classList.remove('selected'));
            customThemePicker.closest('.theme-color-swatch').classList.add('selected');
        });
        customThemePicker.addEventListener('change', (e) => {
            saveThemeColor(e.target.value);
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

    const autoMinimizeGameToggle = document.getElementById('auto-minimize-fullscreen-game-toggle');
    if (autoMinimizeGameToggle) {
        autoMinimizeGameToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ auto_minimize_on_fullscreen_game: autoMinimizeGameToggle.checked })
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

    const showThoughtBtnToggle = document.getElementById('show-thought-button-toggle');
    if (showThoughtBtnToggle) {
        showThoughtBtnToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ show_thought_button: showThoughtBtnToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const showToolCallsToggle = document.getElementById('show-tool-calls-toggle');
    if (showToolCallsToggle) {
        showToolCallsToggle.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ show_tool_calls: showToolCallsToggle.checked })
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    const autoStartToggle = document.getElementById('auto-start-toggle');
    if (autoStartToggle) {
        autoStartToggle.addEventListener('change', async () => {
            try {
                const enable = autoStartToggle.checked;
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ auto_start_on_boot: enable })
                });
                if (window.__petIPC && typeof window.__petIPC.setAutostart === 'function') {
                    await window.__petIPC.setAutostart(enable);
                }
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

    // Fish Audio API Key / URL 变更自动保存
    const fishAudioKeyInput = document.getElementById('fish-audio-key-input');
    const fishAudioUrlInput = document.getElementById('fish-audio-url-input');
    const gptsovitsUrlInput = document.getElementById('gptsovits-url-input');

    if (fishAudioKeyInput) {
        fishAudioKeyInput.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_api_key: fishAudioKeyInput.value.trim(),
                        fish_audio_api_key: fishAudioKeyInput.value.trim()
                    })
                });
            } catch (e) { console.error(e); }
        });
    }

    if (fishAudioUrlInput) {
        fishAudioUrlInput.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_base_url: fishAudioUrlInput.value.trim(),
                        fish_audio_base_url: fishAudioUrlInput.value.trim()
                    })
                });
            } catch (e) { console.error(e); }
        });
    }

    if (gptsovitsUrlInput) {
        gptsovitsUrlInput.addEventListener('change', async () => {
            try {
                await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_base_url: gptsovitsUrlInput.value.trim()
                    })
                });
            } catch (e) { console.error(e); }
        });
    }

    // 密码框明暗显示切换
    const toggleFishKeyBtn = document.getElementById('toggle-fish-key-vis-btn');
    if (toggleFishKeyBtn && fishAudioKeyInput) {
        toggleFishKeyBtn.addEventListener('click', () => {
            if (fishAudioKeyInput.type === 'password') {
                fishAudioKeyInput.type = 'text';
                toggleFishKeyBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                fishAudioKeyInput.type = 'password';
                toggleFishKeyBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    }

    // 测试发音
    const testTtsBtn = document.getElementById('test-tts-btn');
    const ttsTestInput = document.getElementById('tts-test-input');
    let testAudio = new Audio();
    if (testTtsBtn) {
        testTtsBtn.addEventListener('click', async () => {
            const text = ttsTestInput ? ttsTestInput.value.trim() : '你好呀！我是你的桌面伴侣。';
            if (!text) return;

            const charTtsLangSelect = document.getElementById('character-tts-language-select');
            const lang = charTtsLangSelect ? charTtsLangSelect.value : 'zh';

            testTtsBtn.disabled = true;
            testTtsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 合成中...';

            try {
                const resp = await fetch('/api/tts/speak', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        text: text,
                        language: lang
                    })
                });
                const data = await resp.json();
                if (data.success && data.audio_url) {
                    testAudio.src = data.audio_url;
                    await testAudio.play();
                    testTtsBtn.innerHTML = '<i class="fas fa-volume-high"></i> 播放中...';
                    testAudio.onended = () => {
                        testTtsBtn.disabled = false;
                        testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
                    };
                    testAudio.onerror = () => {
                        testTtsBtn.disabled = false;
                        testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
                    };
                } else {
                    alert("语音合成失败: " + (data.error || "未知错误"));
                    testTtsBtn.disabled = false;
                    testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
                }
            } catch (e) {
                alert("请求异常: " + e.message);
                testTtsBtn.disabled = false;
                testTtsBtn.innerHTML = '<i class="fas fa-play"></i> 测试发音';
            }
        });
    }

    // 保存当前角色多语种专属音色
    const saveCharVoiceBtn = document.getElementById('save-char-voice-btn');
    const charTtsLangSelect = document.getElementById('character-tts-language-select');
    const charTtsZhInput = document.getElementById('character-tts-voice-zh');
    const charTtsJaInput = document.getElementById('character-tts-voice-ja');
    const charTtsEnInput = document.getElementById('character-tts-voice-en');

    if (saveCharVoiceBtn) {
        saveCharVoiceBtn.addEventListener('click', async () => {
            const lang = charTtsLangSelect ? charTtsLangSelect.value : 'zh';
            const voiceZh = charTtsZhInput ? charTtsZhInput.value.trim() : '';
            const voiceJa = charTtsJaInput ? charTtsJaInput.value.trim() : '';
            const voiceEn = charTtsEnInput ? charTtsEnInput.value.trim() : '';
            
            let activeVoiceId = voiceZh;
            if (lang === 'ja') activeVoiceId = voiceJa || voiceZh;
            else if (lang === 'en') activeVoiceId = voiceEn || voiceZh;

            saveCharVoiceBtn.disabled = true;
            saveCharVoiceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            try {
                const resp = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tts_language: lang,
                        tts_voice_zh: voiceZh,
                        tts_voice_ja: voiceJa,
                        tts_voice_en: voiceEn,
                        tts_voice_id: activeVoiceId
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    saveCharVoiceBtn.innerHTML = '<i class="fas fa-check"></i> 保存成功！';
                    setTimeout(() => {
                        saveCharVoiceBtn.disabled = false;
                        saveCharVoiceBtn.innerHTML = '<i class="fas fa-save"></i> 保存当前角色音色';
                    }, 2000);
                } else {
                    alert("保存失败: " + (data.error || "未知错误"));
                    saveCharVoiceBtn.disabled = false;
                    saveCharVoiceBtn.innerHTML = '<i class="fas fa-save"></i> 保存当前角色音色';
                }
            } catch (e) {
                alert("网络异常: " + e.message);
                saveCharVoiceBtn.disabled = false;
                saveCharVoiceBtn.innerHTML = '<i class="fas fa-save"></i> 保存当前角色音色';
            }
        });
    }

    const saveCharIdentityBtn = document.getElementById('save-character-identity-btn');
    if (saveCharIdentityBtn) {
        saveCharIdentityBtn.addEventListener('click', async () => {
            const charNameInput = document.getElementById('character-name-input');
            const charIdInput = document.getElementById('character-id-input');
            const newName = charNameInput ? charNameInput.value.trim() : "";
            const newId = charIdInput ? charIdInput.value.trim().toLowerCase() : "";

            if (!newName) {
                alert("角色中文名称不能为空！");
                return;
            }
            if (!newId) {
                alert("角色英文标识不能为空！");
                return;
            }
            if (!/^[a-z0-9_]+$/.test(newId)) {
                alert("角色英文标识仅允许小写英文字母、数字和下划线！");
                return;
            }

            try {
                saveCharIdentityBtn.disabled = true;
                saveCharIdentityBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

                const response = await fetch('/api/settings/config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        character_name: newName,
                        character_id: newId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    if (data.require_restart) {
                        alert("角色英文标识 (ID) 已修改，相关配置文件与素材目录已自动同步重命名！程序将自动重启装载新目录。");
                        if (window.electronAPI) {
                            window.electronAPI.restartApp();
                        } else {
                            location.reload();
                        }
                    } else {
                        alert("角色名称与标识设置保存成功！");
                        loadConfig();
                    }
                } else {
                    alert("保存失败: " + (data.message || data.error));
                }
            } catch (e) {
                alert("保存发生异常: " + e.toString());
            } finally {
                saveCharIdentityBtn.disabled = false;
                saveCharIdentityBtn.innerHTML = '<i class="fas fa-save"></i> 保存角色名称与英文标识';
            }
        });
    }

    if (charSelect) {
        charSelect.addEventListener('change', async (e) => {
            const targetCharId = e.target.value;
            const targetCharName = e.target.options[e.target.selectedIndex].text;
            const confirmSwitch = await window.asyncConfirm(`确定要切换灵魂为【${targetCharName}】吗？\n为保证大模型记忆、性格设定与立绘环境绝对纯净，将立即自动重启桌宠系统！`);
            if (confirmSwitch) {
                try {
                    await fetch('/api/switch_character', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ character_id: targetCharId })
                    });
                    await window.triggerAppRestart(`已成功切换为【${targetCharName}】，正在重启系统...`);
                } catch (e) {
                    alert("切换请求失败: " + e);
                }
            } else {
                // 恢复原值
                loadConfig();
            }
        });
    }


    window.loadCustomEngines = typeof loadCustomEngines !== 'undefined' ? loadCustomEngines : null;
    window.loadConfig = typeof loadConfig !== 'undefined' ? loadConfig : null;
});
