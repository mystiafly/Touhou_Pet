// ==========================================
// 预设准备 (Presets Manager) 逻辑
// ==========================================

let globalPresetsData = [];
let customPresetsData = [];

function loadPresets() {
    fetch('/api/presets/list')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                globalPresetsData = data.global || [];
                customPresetsData = data.custom || [];
                renderPresetsList('global', globalPresetsData, 'global-presets-list');
                renderPresetsList('custom', customPresetsData, 'custom-presets-list');
            }
        })
        .catch(err => console.error("Load presets failed:", err));
}

function renderPresetsList(type, data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); padding: 10px;">暂无预设</div>';
        return;
    }
    
    container.innerHTML = '';
    data.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        
        // Badges
        let badgesHtml = '';
        if (preset.always_active) badgesHtml += '<span class="preset-badge active">Always Active</span>';
        if (preset.min_favorability !== undefined && preset.min_favorability !== null) badgesHtml += `<span class="preset-badge">Fav ≥ ${preset.min_favorability}</span>`;
        if (preset.max_favorability !== undefined && preset.max_favorability !== null) badgesHtml += `<span class="preset-badge">Fav ≤ ${preset.max_favorability}</span>`;
        if (preset.disable) badgesHtml += '<span class="preset-badge disabled">Disabled</span>';
        
        let kwStr = (preset.trigger_keywords && preset.trigger_keywords.length) ? preset.trigger_keywords.join(', ') : '';
        
        item.innerHTML = `
            <div class="preset-header">
                <div>
                    <div class="preset-title">
                        ${preset.name}
                    </div>
                    <div class="preset-badges" style="margin-top: 5px;">${badgesHtml}</div>
                </div>
                <div class="preset-actions">
                    <button class="preset-btn edit" onclick="editPreset('${type}', '${preset.name}')" title="编辑"><i class="fas fa-pen"></i></button>
                    <button class="preset-btn delete" onclick="deletePreset('${type}', '${preset.name}')" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function showPresetModal(type, preset = null) {
    document.getElementById('preset-modal').classList.remove('hidden');
    document.getElementById('preset-type').value = type;
    
    if (preset) {
        document.getElementById('preset-modal-title').innerHTML = '<i class="fas fa-edit"></i> 编辑预设';
        document.getElementById('preset-original-name').value = preset.name;
        document.getElementById('preset-name').value = preset.name;
        document.getElementById('preset-keywords').value = (preset.trigger_keywords || preset.key || []).join(', ');
        document.getElementById('preset-secondary-keywords').value = (preset.secondary_keywords || preset.keysecondary || []).join(', ');
        document.getElementById('preset-min-fav').value = preset.min_favorability !== undefined ? preset.min_favorability : '';
        document.getElementById('preset-max-fav').value = preset.max_favorability !== undefined ? preset.max_favorability : '';
        document.getElementById('preset-position').value = preset.position !== undefined ? preset.position : '1';
        document.getElementById('preset-order').value = preset.order !== undefined ? preset.order : '100';
        document.getElementById('preset-always-active').checked = !!(preset.always_active || preset.constant);
        document.getElementById('preset-disable').checked = !!preset.disable;
        document.getElementById('preset-prevent-recursion').checked = !!preset.prevent_recursion;
        document.getElementById('preset-prompt').value = preset.prompt || preset.content || '';
        document.getElementById('preset-source').value = preset.worldbook_source || '原生';
    } else {
        document.getElementById('preset-modal-title').innerHTML = '<i class="fas fa-plus"></i> 新增预设';
        document.getElementById('preset-original-name').value = '';
        document.getElementById('preset-name').value = '';
        document.getElementById('preset-keywords').value = '';
        document.getElementById('preset-secondary-keywords').value = '';
        document.getElementById('preset-min-fav').value = '';
        document.getElementById('preset-max-fav').value = '';
        document.getElementById('preset-position').value = '1';
        document.getElementById('preset-order').value = '100';
        document.getElementById('preset-always-active').checked = false;
        document.getElementById('preset-disable').checked = false;
        document.getElementById('preset-prevent-recursion').checked = false;
        document.getElementById('preset-prompt').value = '';
        document.getElementById('preset-source').value = '原生';
    }
}

function hidePresetModal() {
    document.getElementById('preset-modal').classList.add('hidden');
}

function editPreset(type, name) {
    const list = type === 'global' ? globalPresetsData : customPresetsData;
    const preset = list.find(p => p.name === name);
    if (preset) showPresetModal(type, preset);
}

async function deletePreset(type, name) {
    if (await window.asyncConfirm(`确定要删除预设 "${name}" 吗？此操作不可恢复。`)) {
        fetch('/api/presets/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ type, name })
        }).then(res => res.json()).then(data => {
            if (data.success) loadPresets();
            else alert("删除失败：" + data.error);
        });
    }
}

// Bind Events
document.addEventListener('DOMContentLoaded', () => {
    // Hooks for Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'global-presets-view' || target === 'custom-presets-view') {
                loadPresets();
            }
        });
    });

    const btnAddGlobal = document.getElementById('btn-add-global-preset');
    if (btnAddGlobal) btnAddGlobal.addEventListener('click', () => showPresetModal('global'));
    
    const btnAddCustom = document.getElementById('btn-add-custom-preset');
    if (btnAddCustom) btnAddCustom.addEventListener('click', () => showPresetModal('custom'));
    
    const btnClosePresetModal = document.getElementById('close-preset-modal-btn');
    if (btnClosePresetModal) btnClosePresetModal.addEventListener('click', hidePresetModal);
    
    const btnCancelPreset = document.getElementById('btn-cancel-preset');
    if (btnCancelPreset) btnCancelPreset.addEventListener('click', hidePresetModal);
    
    const alwaysActiveCheckbox = document.getElementById('preset-always-active');
    const disableCheckbox = document.getElementById('preset-disable');
    
    if (alwaysActiveCheckbox && disableCheckbox) {
        alwaysActiveCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) disableCheckbox.checked = false;
        });
        disableCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) alwaysActiveCheckbox.checked = false;
        });
    }
    
    const btnSavePreset = document.getElementById('btn-save-preset');
    if (btnSavePreset) {
        btnSavePreset.addEventListener('click', () => {
            const type = document.getElementById('preset-type').value;
            const originalName = document.getElementById('preset-original-name').value;
            const name = document.getElementById('preset-name').value.trim();
            const keywordsStr = document.getElementById('preset-keywords').value.trim();
            const secKeywordsStr = document.getElementById('preset-secondary-keywords').value.trim();
            const minFav = document.getElementById('preset-min-fav').value;
            const maxFav = document.getElementById('preset-max-fav').value;
            const position = document.getElementById('preset-position').value;
            const order = document.getElementById('preset-order').value;
            const alwaysActive = document.getElementById('preset-always-active').checked;
            const disablePreset = document.getElementById('preset-disable').checked;
            const preventRecursion = document.getElementById('preset-prevent-recursion').checked;
            const source = document.getElementById('preset-source').value;
            const prompt = document.getElementById('preset-prompt').value.trim();
            
            if (!name || !prompt) {
                alert("预设名称和提示词为必填项！");
                return;
            }
            
            // Delete original first if name changed
            if (originalName && originalName !== name) {
                // To safely rename, we should ideally do it in one atomic transaction, 
                // but since it's local, we can just delete and then save.
                fetch('/api/presets/delete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ type, name: originalName })
                });
            }
            
            const presetObj = {
                name: name,
                prompt: prompt,
                always_active: alwaysActive,
                disable: disablePreset,
                prevent_recursion: preventRecursion,
                worldbook_source: source,
                position: parseInt(position, 10) || 1,
                order: parseInt(order, 10) || 100
            };
            
            if (keywordsStr) presetObj.trigger_keywords = keywordsStr.split(',').map(s => s.trim()).filter(s => s);
            if (secKeywordsStr) presetObj.secondary_keywords = secKeywordsStr.split(',').map(s => s.trim()).filter(s => s);
            if (minFav !== '') presetObj.min_favorability = parseInt(minFav, 10);
            if (maxFav !== '') presetObj.max_favorability = parseInt(maxFav, 10);
            
            btnSavePreset.disabled = true;
            btnSavePreset.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            fetch('/api/presets/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ type, preset: presetObj })
            }).then(res => res.json()).then(data => {
                btnSavePreset.disabled = false;
                btnSavePreset.innerHTML = '<i class="fas fa-save"></i> 保存';
                
                if (data.success) {
                    hidePresetModal();
                    loadPresets();
                } else {
                    alert("保存失败：" + data.error);
                }
            });
        });
    }

    // Worldbook Import Logic
    const btnImportWorldbookCustom = document.getElementById('btn-import-worldbook');
    const btnImportWorldbookGlobal = document.getElementById('btn-import-worldbook-global');
    const uploadInput = document.getElementById('worldbook-upload-input');
    
    let importTargetType = 'custom';
    let currentImportBtn = null;
    let currentImportBtnOldHtml = '';
    
    if (uploadInput) {
        if (btnImportWorldbookCustom) {
            btnImportWorldbookCustom.addEventListener('click', () => {
                importTargetType = 'custom';
                currentImportBtn = btnImportWorldbookCustom;
                uploadInput.click();
            });
        }
        
        if (btnImportWorldbookGlobal) {
            btnImportWorldbookGlobal.addEventListener('click', () => {
                importTargetType = 'global';
                currentImportBtn = btnImportWorldbookGlobal;
                uploadInput.click();
            });
        }
        
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (currentImportBtn) {
                currentImportBtnOldHtml = currentImportBtn.innerHTML;
                currentImportBtn.disabled = true;
                currentImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', importTargetType);
            
            fetch('/api/worldbook/import', {
                method: 'POST',
                body: formData
            }).then(res => res.json()).then(data => {
                if (currentImportBtn) {
                    currentImportBtn.disabled = false;
                    currentImportBtn.innerHTML = currentImportBtnOldHtml;
                }
                uploadInput.value = ''; // clear
                
                if (data.success) {
                    alert(`成功导入 ${data.count} 条世界书设定到 ${importTargetType === 'global' ? '公用预设' : '专属预设'}！`);
                    loadPresets();
                } else {
                    alert("导入失败：" + data.error);
                }
            }).catch(err => {
                if (currentImportBtn) {
                    currentImportBtn.disabled = false;
                    currentImportBtn.innerHTML = currentImportBtnOldHtml;
                }
                uploadInput.value = '';
                alert("上传发生错误：" + err);
            });
        });
    }
});
