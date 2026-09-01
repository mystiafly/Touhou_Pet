document.addEventListener('DOMContentLoaded', () => {
    // ========== 角色管理中心与头像管理 ==========
    let cachedCharacters = [];
    let cachedActiveCharId = 'rumia';

    function renderCharacterManagementGrid(characters, activeCharId) {
        const grid = document.getElementById('character-card-grid');
        if (!grid) return;

        if (characters) cachedCharacters = characters;
        if (activeCharId) cachedActiveCharId = activeCharId;

        if (!cachedCharacters || cachedCharacters.length === 0) {
            grid.innerHTML = '<div style="text-align: center; color: #6272a4; padding: 40px; grid-column: 1 / -1;"><i class="fas fa-ghost" style="font-size: 32px; margin-bottom: 10px;"></i><br>暂无可用角色</div>';
            return;
        }

        grid.innerHTML = cachedCharacters.map(c => {
            const isActive = c.character_id === cachedActiveCharId;
            const isProtected = c.character_id === 'rumia';
            const checkboxDisabled = isActive || isProtected;
            const disableReason = isActive ? '当前活跃角色不可删除' : (isProtected ? '基础角色受保护不可删除' : '');
            
            return `
                <div class="char-manage-card ${isActive ? 'is-active' : ''}" data-id="${c.character_id}">
                    <input type="checkbox" class="char-card-checkbox" data-id="${c.character_id}" ${checkboxDisabled ? 'disabled title="' + disableReason + '"' : ''}>
                    
                    <span class="char-card-status-badge ${isActive ? 'badge-active' : 'badge-idle'}">
                        ${isActive ? '🌟 活跃中' : '💤 待命'}
                    </span>
                    
                    <img class="char-avatar-img" src="${c.avatar_url}" alt="${c.character_name}" onerror="this.src='/static/images/default_robot_avatar.svg'">
                    
                    <h3 class="char-name-title">${c.character_name}</h3>
                    <div class="char-id-tag">ID: ${c.character_id}</div>
                    
                    <div class="char-persona-desc" title="${(c.persona_prompt || '').replace(/"/g, '&quot;')}">
                        ${c.persona_prompt || '暂未填写详细人设...'}
                    </div>
                    
                    <div class="char-card-actions">
                        ${isActive ? 
                            '<button class="action-btn outline" disabled style="opacity: 0.65; cursor: default;"><i class="fas fa-check"></i> 当前活跃</button>' : 
                            `<button class="action-btn switch-char-card-btn" data-id="${c.character_id}" data-name="${c.character_name}"><i class="fas fa-exchange-alt"></i> 切换灵魂</button>`
                        }
                        <button class="action-btn outline edit-char-card-btn" data-id="${c.character_id}"><i class="fas fa-cog"></i> 角色设置</button>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定切换按钮事件
        grid.querySelectorAll('.switch-char-card-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const charId = btn.getAttribute('data-id');
                const charName = btn.getAttribute('data-name');
                const confirmSwitch = await window.asyncConfirm(`确定要切换灵魂为【${charName} (${charId})】吗？\n为保证记忆环境纯净并加载全新人设，系统将立即重启生效！`);
                if (confirmSwitch) {
                    try {
                        await fetch('/api/switch_character', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ character_id: charId })
                        });
                        await window.triggerAppRestart(`已成功切换为【${charName}】，正在重启系统...`);
                    } catch (e) {
                        alert("切换角色请求失败: " + e);
                    }
                }
            });
        });

        // 绑定角色设置按钮事件
        grid.querySelectorAll('.edit-char-card-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const charId = btn.getAttribute('data-id');
                if (charId !== cachedActiveCharId) {
                    const wantSwitch = await window.asyncConfirm(`角色设置仅作用于当前活跃角色。\n是否切换活跃角色为【${charId}】并重启系统？`);
                    if (wantSwitch) {
                        try {
                            await fetch('/api/switch_character', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ character_id: charId })
                            });
                            await window.triggerAppRestart(`已切换活跃角色为【${charId}】，正在重启系统...`);
                        } catch(e) {
                            alert("切换失败: " + e);
                        }
                    }
                } else {
                    const navCharSettings = document.querySelector('.nav-item[data-target="character-settings-view"]');
                    if (navCharSettings) navCharSettings.click();
                }
            });
        });
    }

    // 全选 / 取消全选
    const selectAllBtn = document.getElementById('char-select-all-btn');
    if (selectAllBtn) {
        let allSelected = false;
        selectAllBtn.addEventListener('click', () => {
            allSelected = !allSelected;
            const checkboxes = document.querySelectorAll('.char-card-checkbox:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = allSelected);
            selectAllBtn.innerHTML = allSelected ? '<i class="fas fa-times-circle"></i> 取消全选' : '<i class="far fa-check-square"></i> 全选';
        });
    }

    // 批量删除 (至回收站)
    const batchDeleteBtn = document.getElementById('char-batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            const checkedBoxes = Array.from(document.querySelectorAll('.char-card-checkbox:checked'));
            const selectedIds = checkedBoxes.map(cb => cb.getAttribute('data-id')).filter(Boolean);
            
            if (selectedIds.length === 0) {
                alert("请先勾选需要删除的角色（当前活跃角色与基础角色受保护不可删除）。");
                return;
            }

            const confirmDel = await window.asyncConfirm(`⚠️ 危险操作确认：\n\n即将把以下 ${selectedIds.length} 个角色移至 Windows 回收站：\n【${selectedIds.join('、')}】\n\n您可以在 Windows 回收站中随时找回数据，确认继续吗？`);
            if (!confirmDel) return;

            batchDeleteBtn.disabled = true;
            batchDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在安全删除...';

            try {
                const res = await fetch('/api/characters/batch_delete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ character_ids: selectedIds })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    alert(`🗑️ ${data.message}`);
                    loadConfig();
                } else {
                    alert(`删除失败: ${data.message || '未知错误'}`);
                }
            } catch (e) {
                console.error(e);
                alert("批量删除请求发生异常: " + e);
            } finally {
                batchDeleteBtn.disabled = false;
                batchDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> 批量删除 (至回收站)';
            }
        });
    }

    // 角色专属头像上传与重置 (在角色设置面板)
    const avatarImg = document.getElementById('current-char-avatar-img');
    const avatarInput = document.getElementById('char-avatar-file-input');
    const uploadAvatarBtn = document.getElementById('upload-char-avatar-btn');
    const resetAvatarBtn = document.getElementById('reset-char-avatar-btn');
    const avatarUploadStatus = document.getElementById('avatar-upload-status');

    function refreshAvatarPreview(charId) {
        if (avatarImg && charId) {
            avatarImg.src = `/api/characters/${charId}/avatar?t=${Date.now()}`;
        }
    }
    window.refreshAvatarPreview = refreshAvatarPreview;

    if (uploadAvatarBtn && avatarInput) {
        uploadAvatarBtn.addEventListener('click', () => {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const charId = cachedActiveCharId;
            const formData = new FormData();
            formData.append('file', file);

            uploadAvatarBtn.disabled = true;
            uploadAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
            if (avatarUploadStatus) {
                avatarUploadStatus.style.display = 'block';
                avatarUploadStatus.className = 'help-text';
                avatarUploadStatus.innerText = '正在上传并处理头像...';
            }

            try {
                const res = await fetch(`/api/characters/${charId}/avatar`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.status === 'success') {
                    if (avatarUploadStatus) {
                        avatarUploadStatus.className = 'help-text text-success';
                        avatarUploadStatus.innerText = '✨ 头像上传成功！';
                        setTimeout(() => { avatarUploadStatus.style.display = 'none'; }, 3000);
                    }
                    if (avatarImg) {
                        avatarImg.src = data.avatar_url || `/api/characters/${charId}/avatar?t=${Date.now()}`;
                    }
                    loadConfig();
                } else {
                    if (avatarUploadStatus) {
                        avatarUploadStatus.className = 'help-text text-danger';
                        avatarUploadStatus.innerText = '上传失败: ' + (data.message || '未知错误');
                    }
                    alert('头像上传失败: ' + (data.message || '未知错误'));
                }
            } catch (err) {
                console.error(err);
                alert('上传请求异常: ' + err);
            } finally {
                uploadAvatarBtn.disabled = false;
                uploadAvatarBtn.innerHTML = '<i class="fas fa-upload"></i> 上传新头像';
                avatarInput.value = '';
            }
        });
    }

    if (resetAvatarBtn) {
        resetAvatarBtn.addEventListener('click', async () => {
            const charId = cachedActiveCharId;
            const confirmReset = await window.asyncConfirm(`确定要恢复【${charId}】为默认机器人头像吗？`);
            if (!confirmReset) return;

            resetAvatarBtn.disabled = true;
            try {
                const res = await fetch(`/api/characters/${charId}/avatar`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.status === 'success') {
                    if (avatarImg) {
                        avatarImg.src = `/api/characters/${charId}/avatar?t=${Date.now()}`;
                    }
                    if (avatarUploadStatus) {
                        avatarUploadStatus.style.display = 'block';
                        avatarUploadStatus.className = 'help-text text-success';
                        avatarUploadStatus.innerText = '已重置为默认头像';
                        setTimeout(() => { avatarUploadStatus.style.display = 'none'; }, 3000);
                    }
                    loadConfig();
                }
            } catch (err) {
                alert('重置头像失败: ' + err);
            } finally {
                resetAvatarBtn.disabled = false;
            }
        });
    }

    // 处理多模式切换
    const modeLazyBtn = document.getElementById('mode-lazy-btn');
    const modeProBtn = document.getElementById('mode-pro-btn');
    const modeImportBtn = document.getElementById('mode-import-btn');
    const modeExportBtn = document.getElementById('mode-export-btn');
    const modeDeleteBtn = document.getElementById('mode-delete-btn');
    const formLazyMode = document.getElementById('form-lazy-mode');
    const formProMode = document.getElementById('form-pro-mode');
    const formImportMode = document.getElementById('form-import-mode');
    const formExportMode = document.getElementById('form-export-mode');
    const formDeleteMode = document.getElementById('form-delete-mode');

    function switchMode(activeBtn, activeForm) {
        [modeLazyBtn, modeProBtn, modeImportBtn, modeExportBtn, modeDeleteBtn].forEach(btn => {
            if (!btn) return;
            btn.classList.add('outline');
            btn.classList.remove('active');
        });
        [formLazyMode, formProMode, formImportMode, formExportMode, formDeleteMode].forEach(form => {
            if (!form) return;
            form.style.display = 'none';
        });
        
        if (activeBtn) {
            activeBtn.classList.remove('outline');
            activeBtn.classList.add('active');
        }
        if (activeForm) {
            activeForm.style.display = 'block';
        }
    }

    if (modeLazyBtn && modeProBtn && modeImportBtn && modeExportBtn && modeDeleteBtn) {
        modeLazyBtn.addEventListener('click', () => switchMode(modeLazyBtn, formLazyMode));
        modeProBtn.addEventListener('click', () => switchMode(modeProBtn, formProMode));
        modeImportBtn.addEventListener('click', () => switchMode(modeImportBtn, formImportMode));
        modeExportBtn.addEventListener('click', () => switchMode(modeExportBtn, formExportMode));
        modeDeleteBtn.addEventListener('click', () => switchMode(modeDeleteBtn, formDeleteMode));
    }

    // 监听角色卡文件选择并预检
    const importFileInput = document.getElementById('import-char-file');
    const importCharIdInput = document.getElementById('import-char-id');
    const importPreviewBadge = document.getElementById('import-preview-badge');
    const importDetectedTitle = document.getElementById('import-detected-title');
    const importDetectedDesc = document.getElementById('import-detected-desc');

    if (importFileInput) {
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                if (importPreviewBadge) importPreviewBadge.style.display = 'none';
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/characters/inspect_zip', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    if (data.character_id && importCharIdInput) {
                        importCharIdInput.value = data.character_id;
                    }
                    if (importPreviewBadge) {
                        importPreviewBadge.style.display = 'block';
                        importDetectedTitle.textContent = `✨ 已识别角色: 【${data.character_name || data.character_id}】 (ID: ${data.character_id})`;
                        importDetectedDesc.textContent = data.persona_prompt ? `核心人设: ${data.persona_prompt}...` : '标准角色卡，准备就绪';
                    }
                }
            } catch (err) {
                console.warn('Inspect zip failed:', err);
            }
        });
    }

    // 处理导入角色卡
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const charId = document.getElementById('import-char-id').value.trim();
            const fileInput = document.getElementById('import-char-file');
            const statusText = document.getElementById('import-status');
            
            if (!charId) {
                alert("请填写底层英文 ID！");
                return;
            }
            if (!/^[a-z0-9_]+$/.test(charId)) {
                alert("英文 ID 只能包含小写字母、数字和下划线！");
                return;
            }
            if (!fileInput.files || fileInput.files.length === 0) {
                alert("请选择要导入的角色卡压缩包！");
                return;
            }

            const confirmImport = await window.asyncConfirm(`即将解压角色卡到 "${charId}"，并配置系统资产。确认继续吗？`);
            if (!confirmImport) return;

            importBtn.disabled = true;
            statusText.style.display = 'block';
            statusText.textContent = "正在上传并解析压缩包，请稍候...";
            statusText.className = "help-text";

            try {
                const formData = new FormData();
                formData.append('char_id', charId);
                formData.append('file', fileInput.files[0]);

                const res = await fetch('/api/characters/import', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    statusText.textContent = "角色导入成功！即将刷新页面...";
                    statusText.className = "help-text text-success";
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    statusText.textContent = "导入失败: " + (data.message || "未知错误");
                    statusText.className = "help-text text-danger";
                    importBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                statusText.textContent = "网络错误，请检查后端运行状态。";
                statusText.className = "help-text text-danger";
                importBtn.disabled = false;
            }
        });
    }

    // 处理删除角色
    const deleteBtn = document.getElementById('delete-char-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const charId = document.getElementById('delete-char-id').value.trim();
            const statusText = document.getElementById('delete-status');

            if (!charId) {
                alert("请选择要销毁的角色！");
                return;
            }

            const confirmDelete = await window.asyncConfirm(`【警告】即将永久销毁角色 "${charId}"，包括其所有资源文件、记忆、预设。\n此操作不可逆，请确认是否继续？`);
            if (!confirmDelete) return;

            const finalConfirm = await window.asyncConfirm(`再次确认：你真的要删除 "${charId}" 吗？`);
            if (!finalConfirm) return;

            deleteBtn.disabled = true;
            statusText.style.display = 'block';
            statusText.textContent = "正在执行销毁操作，请稍候...";
            statusText.className = "help-text";

            try {
                const res = await fetch(`/api/characters/${encodeURIComponent(charId)}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    statusText.textContent = "角色销毁成功！即将刷新页面...";
                    statusText.className = "help-text text-success";
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    statusText.textContent = "销毁失败: " + (data.message || "未知错误");
                    statusText.className = "help-text text-danger";
                    deleteBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                statusText.textContent = "网络错误，请检查后端运行状态。";
                statusText.className = "help-text text-danger";
                deleteBtn.disabled = false;
            }
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

            const confirmGen = await window.asyncConfirm("将请求大模型提炼设定并创建底层文件，该过程大概需要10-20秒，确认开始吗？");
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

    // 处理新角色构建 (构建模式)
    const generateProBtn = document.getElementById('generate-pro-btn');
    if (generateProBtn) {
        generateProBtn.addEventListener('click', async () => {
            const charId = document.getElementById('pro-char-id').value.trim().toLowerCase();
            const charName = document.getElementById('pro-char-name').value.trim();
            const personaPrompt = document.getElementById('pro-persona-prompt').value.trim();
            const themeColor = document.getElementById('pro-theme-color').value.trim();
            const statusText = document.getElementById('generate-pro-status');
            
            if (!charId || !charName) {
                alert("英文唯一 ID 和中文角色名为必填项！");
                return;
            }

            // 校验 ID 格式 (仅小写字母、数字和下划线)
            if (!/^[a-z0-9_]+$/.test(charId)) {
                alert("英文唯一 ID 只能包含小写英文字母、数字和下划线！");
                return;
            }

            const confirmGen = await window.asyncConfirm(`即将从母本样本克隆沙盒副本【${charName} (${charId})】并即刻切换，确认启动构建吗？`);
            if (!confirmGen) return;

            generateProBtn.disabled = true;
            generateProBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在克隆母本并初始化...';
            statusText.style.display = 'block';
            statusText.innerText = '正在构建沙盒副本...';

            try {
                const response = await fetch('/api/characters/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        mode: 'construct',
                        character_id: charId,
                        character_name: charName,
                        persona_prompt: personaPrompt,
                        theme_color: themeColor
                    })
                });
                
                const data = await response.json();
                if (data.status === 'success') {
                    statusText.innerText = '沙盒副本已构建完成！';
                    alert(`✨ 角色【${data.character_name}】构建成功！\n\n大贤者已为您克隆纯净母本副本（集成莉莉白 7 表动态数据库与露米娅静态/Live2D 双皮肤），并已自动将全局活跃角色切换为【${data.character_name}】！\n\n页面即将刷新，您可以立即在「专属预设」、「动态数据库」、「立绘设置」等页面随意定制！`);
                    window.location.reload();
                } else {
                    statusText.innerText = '构建失败';
                    alert("构建失败: " + (data.message || "未知错误"));
                }
            } catch (e) {
                console.error(e);
                statusText.innerText = '构建失败';
                alert("请求失败，请检查网络或控制台报错。");
            } finally {
                generateProBtn.disabled = false;
                generateProBtn.innerHTML = '<i class="fas fa-rocket"></i> 🚀 启动构建工作台 (克隆样本并即刻切换)';
                setTimeout(() => { statusText.style.display = 'none'; }, 3000);
            }
        });
    }

    async function loadCharacters() {
        try {
            const [charsRes, charInfoRes] = await Promise.all([
                fetch('/api/characters/list'),
                fetch('/api/character_info')
            ]);
            const charsData = await charsRes.json();
            const charInfo = await charInfoRes.json();
            if (charsData.status === "success" || charsData.characters) {
                renderCharacterManagementGrid(charsData.characters, charsData.active_character || charInfo.character_id);
            }
        } catch (e) {
            console.error("加载角色列表失败:", e);
        }
    }

    loadCharacters();

    window.loadCharacters = loadCharacters;
    window.renderCharacterManagementGrid = renderCharacterManagementGrid;
    window.refreshAvatarPreview = typeof refreshAvatarPreview !== 'undefined' ? refreshAvatarPreview : null;
    window.triggerAppRestart = typeof triggerAppRestart !== 'undefined' ? triggerAppRestart : null;
});
