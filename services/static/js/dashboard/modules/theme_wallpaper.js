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

document.addEventListener('DOMContentLoaded', () => {
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
});


});
