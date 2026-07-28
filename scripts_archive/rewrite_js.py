import sys

js_path = r'g:\code\rumia\services\static\js\dashboard.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

marker = '// ================== DataBank 渲染逻辑 =================='
idx = js_content.find(marker)
if idx == -1:
    print("JS marker not found")
    sys.exit(1)

base_js = js_content[:idx]

new_js = '''// ================== DataBank 渲染逻辑 ==================
    let currentDataBank = null;
    let currentSheetId = null;
    
    // --- 模板 GUI 状态 ---
    let currentTemplateRaw = null;
    let tplCurrentSheetId = null;
    
    // --- 模式切换逻辑 ---
    const modeDataBtn = document.getElementById('mode-data-btn');
    const modeTemplateBtn = document.getElementById('mode-template-btn');
    const dataModeContainer = document.getElementById('databank-data-mode');
    const templateModeContainer = document.getElementById('databank-template-mode');

    if(modeDataBtn && modeTemplateBtn) {
        modeDataBtn.addEventListener('click', () => {
            modeDataBtn.classList.add('active');
            modeDataBtn.classList.remove('outline');
            modeTemplateBtn.classList.remove('active');
            modeTemplateBtn.classList.add('outline');
            dataModeContainer.style.display = 'flex';
            templateModeContainer.style.display = 'none';
        });

        modeTemplateBtn.addEventListener('click', () => {
            modeTemplateBtn.classList.add('active');
            modeTemplateBtn.classList.remove('outline');
            modeDataBtn.classList.remove('active');
            modeDataBtn.classList.add('outline');
            dataModeContainer.style.display = 'none';
            templateModeContainer.style.display = 'flex';
            loadTemplateRaw();
        });
    }

    // ==========================================
    // DATA MODE (数据编辑模式)
    // ==========================================
    function loadDataBank() {
        fetch('/api/databank')
            .then(res => res.json())
            .then(res => {
                if(res.status === 'success') {
                    currentDataBank = res.data;
                    renderDataBankSidebar(currentDataBank);
                } else {
                    document.getElementById('databank-empty-state').innerHTML = `<p style="color:red"><i class="fas fa-exclamation-triangle"></i> ${res.message}</p>`;
                }
            })
            .catch(err => {
                console.error("加载DataBank失败", err);
                document.getElementById('databank-empty-state').innerHTML = `<p style="color:red"><i class="fas fa-times-circle"></i> 请求失败</p>`;
            });
    }

    const refreshBtn = document.getElementById('refresh-databank-btn');
    if(refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadDataBank();
            if (templateModeContainer && templateModeContainer.style.display !== 'none') {
                loadTemplateRaw();
            }
        });
    }

    function renderDataBankSidebar(data) {
        const listEl = document.getElementById('databank-sheet-list');
        listEl.innerHTML = '';
        const keys = Object.keys(data).filter(k => k.startsWith('sheet_'));
        
        if (keys.length === 0) {
            listEl.innerHTML = '<li style="color:var(--text-secondary); text-align:center;">暂无数据表</li>';
            document.getElementById('databank-empty-state').style.display = 'block';
            document.getElementById('databank-table-container').style.display = 'none';
            currentSheetId = null;
            return;
        }

        let firstLi = null;
        let selectedLi = null;

        keys.forEach((key, index) => {
            const sheet = data[key];
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.margin = '5px 0';
            li.style.background = 'var(--bg-primary)';
            li.style.borderRadius = 'var(--border-radius)';
            li.style.cursor = 'pointer';
            li.style.transition = 'all 0.2s';
            li.innerHTML = `<strong>${sheet.name}</strong>`;
            
            li.addEventListener('mouseenter', () => li.style.transform = 'translateX(5px)');
            li.addEventListener('mouseleave', () => li.style.transform = 'none');
            
            li.addEventListener('click', () => {
                document.querySelectorAll('#databank-sheet-list li').forEach(el => el.style.borderLeft = 'none');
                li.style.borderLeft = '3px solid var(--accent-color)';
                currentSheetId = key;
                renderDataBankTable(sheet);
            });
            listEl.appendChild(li);
            
            if (index === 0) firstLi = li;
            if (key === currentSheetId) selectedLi = li;
        });

        if (selectedLi) selectedLi.click();
        else if (firstLi) firstLi.click();
    }

    function renderDataBankTable(sheet) {
        document.getElementById('databank-empty-state').style.display = 'none';
        document.getElementById('databank-table-container').style.display = 'flex';
        document.getElementById('databank-table-title').textContent = sheet.name;
        
        const tableEl = document.getElementById('databank-table');
        tableEl.innerHTML = '';
        
        const content = sheet.content || [];
        if (content.length === 0) {
            tableEl.innerHTML = '<tr><td colspan="100%" style="text-align:center;">此表暂无数据(包含表头)</td></tr>';
            return;
        }
        
        // 渲染表头 (数据模式下不允许修改表头，锁定)
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        content[0].forEach(cellText => {
            const th = document.createElement('th');
            th.textContent = cellText;
            headerRow.appendChild(th);
        });
        const opTh = document.createElement('th');
        opTh.textContent = "操作";
        opTh.style.width = "80px";
        opTh.style.textAlign = "center";
        headerRow.appendChild(opTh);
        thead.appendChild(headerRow);
        tableEl.appendChild(thead);
        
        // 渲染数据体
        const tbody = document.createElement('tbody');
        for (let i = 1; i < content.length; i++) {
            const tr = createDataRow(content[i]);
            tbody.appendChild(tr);
        }
        tableEl.appendChild(tbody);
    }

    function createDataRow(rowData) {
        const tr = document.createElement('tr');
        rowData.forEach(cellText => {
            const td = document.createElement('td');
            td.textContent = cellText;
            td.setAttribute('contenteditable', 'true');
            td.style.cursor = 'text';
            td.style.outline = 'none';
            td.addEventListener('focus', () => td.style.background = 'var(--bg-primary)');
            td.addEventListener('blur', () => td.style.background = 'transparent');
            tr.appendChild(td);
        });
        
        const opTd = document.createElement('td');
        opTd.style.textAlign = 'center';
        opTd.innerHTML = `<button class="action-btn danger" style="padding:2px 5px; min-width:unset;"><i class="fas fa-trash"></i></button>`;
        opTd.querySelector('button').addEventListener('click', () => {
            if(confirm("确认删除此行?")) tr.remove();
        });
        tr.appendChild(opTd);
        return tr;
    }

    const addRowBtn = document.getElementById('add-databank-row-btn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            if(!currentSheetId || !currentDataBank || !currentDataBank[currentSheetId]) return;
            const content = currentDataBank[currentSheetId].content;
            if(!content || content.length === 0) return alert("该表没有表头，无法添加行");
            
            const tableEl = document.getElementById('databank-table');
            const tbody = tableEl.querySelector('tbody');
            if(!tbody) return;
            
            const colCount = content[0].length;
            const emptyRow = new Array(colCount).fill('');
            tbody.appendChild(createDataRow(emptyRow));
        });
    }

    const saveContentBtn = document.getElementById('save-databank-content-btn');
    if (saveContentBtn) {
        saveContentBtn.addEventListener('click', () => {
            if(!currentSheetId) return;
            
            const tableEl = document.getElementById('databank-table');
            const thead = tableEl.querySelector('thead');
            const tbody = tableEl.querySelector('tbody');
            if(!thead || !tbody) return;
            
            const newContent = [];
            const headers = Array.from(thead.querySelectorAll('th')).slice(0, -1).map(th => th.textContent.trim());
            newContent.push(headers);
            
            Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
                const rowData = Array.from(tr.querySelectorAll('td')).slice(0, -1).map(td => td.textContent.trim());
                newContent.push(rowData);
            });
            
            saveContentBtn.disabled = true;
            saveContentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            fetch('/api/databank/update_content', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sheet_id: currentSheetId, content: newContent })
            }).then(res => res.json()).then(data => {
                saveContentBtn.disabled = false;
                saveContentBtn.innerHTML = '<i class="fas fa-save"></i> 保存本表修改';
                if(data.status === 'success') {
                    if(currentDataBank && currentDataBank[currentSheetId]) {
                        currentDataBank[currentSheetId].content = newContent;
                    }
                    alert("数据行保存成功！");
                } else {
                    alert("保存失败: " + data.message);
                }
            }).catch(err => {
                saveContentBtn.disabled = false;
                saveContentBtn.innerHTML = '<i class="fas fa-save"></i> 保存本表修改';
                alert("请求出错: " + err);
            });
        });
    }

    // ==========================================
    // TEMPLATE GUI MODE (模板 GUI 构建器模式)
    // ==========================================
    function loadTemplateRaw() {
        fetch('/api/databank/template')
            .then(res => res.json())
            .then(res => {
                if(res.status === 'success') {
                    try {
                        currentTemplateRaw = JSON.parse(res.data);
                        renderTplSidebar();
                    } catch(e) {
                        alert("模板 JSON 格式损坏: " + e.message);
                    }
                } else {
                    alert("加载模板失败: " + res.message);
                }
            });
    }

    function renderTplSidebar() {
        const listEl = document.getElementById('databank-tpl-sheet-list');
        listEl.innerHTML = '';
        if(!currentTemplateRaw) return;
        
        const keys = Object.keys(currentTemplateRaw).filter(k => k.startsWith('sheet_'));
        let firstLi = null;
        let selectedLi = null;

        keys.forEach((key, index) => {
            const sheet = currentTemplateRaw[key];
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.margin = '5px 0';
            li.style.background = 'var(--bg-primary)';
            li.style.borderRadius = 'var(--border-radius)';
            li.style.cursor = 'pointer';
            li.innerHTML = `<strong>${sheet.name || key}</strong>`;
            
            li.addEventListener('click', () => {
                // 先同步当前正在编辑的表数据回内存 (防丢失)
                syncTplFormToMemory();
                
                document.querySelectorAll('#databank-tpl-sheet-list li').forEach(el => el.style.borderLeft = 'none');
                li.style.borderLeft = '3px solid var(--accent-color)';
                tplCurrentSheetId = key;
                renderTplEditorForm(key);
            });
            listEl.appendChild(li);
            
            if (index === 0) firstLi = li;
            if (key === tplCurrentSheetId) selectedLi = li;
        });

        if (selectedLi) selectedLi.click();
        else if (firstLi) firstLi.click();
        else {
            document.getElementById('tpl-empty-state').style.display = 'block';
            document.getElementById('tpl-editor-container').style.display = 'none';
        }
    }

    // 从 DOM 表单收集数据并同步回 currentTemplateRaw
    function syncTplFormToMemory() {
        if(!tplCurrentSheetId || !currentTemplateRaw || !currentTemplateRaw[tplCurrentSheetId]) return;
        const sheet = currentTemplateRaw[tplCurrentSheetId];
        
        const newUid = document.getElementById('tpl-fld-uid').value.trim();
        sheet.name = document.getElementById('tpl-fld-name').value.trim();
        sheet.uid = newUid;
        
        if(!sheet.exportConfig) sheet.exportConfig = {};
        sheet.exportConfig.entryType = document.getElementById('tpl-fld-entrytype').value;
        sheet.exportConfig.keywords = document.getElementById('tpl-fld-keywords').value.trim();
        
        if(!sheet.sourceData) sheet.sourceData = {};
        sheet.sourceData.note = document.getElementById('tpl-fld-note').value;
        sheet.sourceData.updateNode = document.getElementById('tpl-fld-updatenode').value;
        sheet.sourceData.insertNode = document.getElementById('tpl-fld-insertnode').value;
        sheet.sourceData.deleteNode = document.getElementById('tpl-fld-deletenode').value;
        
        // 读取列名（表头）
        const colInputs = document.querySelectorAll('.tpl-col-input');
        const headers = Array.from(colInputs).map(inp => inp.value.trim());
        if(!sheet.content) sheet.content = [];
        if(sheet.content.length === 0) sheet.content.push(headers);
        else sheet.content[0] = headers;
        
        // 如果 UID (表标识) 发生了修改，我们需要重命名外层 key
        if(newUid && newUid !== tplCurrentSheetId && newUid.startsWith('sheet_')) {
            currentTemplateRaw[newUid] = currentTemplateRaw[tplCurrentSheetId];
            delete currentTemplateRaw[tplCurrentSheetId];
            tplCurrentSheetId = newUid; // Update the reference
            renderTplSidebar(); // Re-render sidebar to reflect key change
        }
    }

    function renderTplEditorForm(key) {
        document.getElementById('tpl-empty-state').style.display = 'none';
        document.getElementById('tpl-editor-container').style.display = 'flex';
        
        const sheet = currentTemplateRaw[key];
        
        // 填充基础设置
        document.getElementById('tpl-fld-uid').value = key;
        document.getElementById('tpl-fld-name').value = sheet.name || '';
        document.getElementById('tpl-fld-entrytype').value = sheet.exportConfig?.entryType || 'constant';
        document.getElementById('tpl-fld-keywords').value = sheet.exportConfig?.keywords || '';
        
        // 填充提示词
        document.getElementById('tpl-fld-note').value = sheet.sourceData?.note || '';
        document.getElementById('tpl-fld-updatenode').value = sheet.sourceData?.updateNode || '';
        document.getElementById('tpl-fld-insertnode').value = sheet.sourceData?.insertNode || '';
        document.getElementById('tpl-fld-deletenode').value = sheet.sourceData?.deleteNode || '';
        
        // 渲染列
        renderTplColumns(sheet);
    }

    function renderTplColumns(sheet) {
        const listEl = document.getElementById('tpl-columns-list');
        listEl.innerHTML = '';
        
        let headers = [];
        if (sheet.content && sheet.content.length > 0) {
            headers = sheet.content[0];
        } else {
            headers = ['row_id']; // 默认初始列
        }
        
        headers.forEach((colName, index) => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.gap = '10px';
            li.style.alignItems = 'center';
            
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'modern-input tpl-col-input';
            inp.style.flex = '1';
            inp.value = colName;
            if(index === 0 && colName === 'row_id') inp.readOnly = true; // 保护主键
            
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn danger';
            delBtn.style.padding = '5px 10px';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.addEventListener('click', () => {
                li.remove();
            });
            if(index === 0 && colName === 'row_id') delBtn.disabled = true; // 保护主键
            
            li.appendChild(inp);
            li.appendChild(delBtn);
            listEl.appendChild(li);
        });
    }

    const tplAddColBtn = document.getElementById('tpl-add-column-btn');
    if(tplAddColBtn) {
        tplAddColBtn.addEventListener('click', () => {
            const listEl = document.getElementById('tpl-columns-list');
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.gap = '10px';
            li.style.alignItems = 'center';
            
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'modern-input tpl-col-input';
            inp.style.flex = '1';
            inp.placeholder = "新列名";
            
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn danger';
            delBtn.style.padding = '5px 10px';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.addEventListener('click', () => { li.remove(); });
            
            li.appendChild(inp);
            li.appendChild(delBtn);
            listEl.appendChild(li);
        });
    }

    const addTplSheetBtn = document.getElementById('add-tpl-sheet-btn');
    if(addTplSheetBtn) {
        addTplSheetBtn.addEventListener('click', () => {
            if(!currentTemplateRaw) return;
            const newKey = "sheet_new_" + Date.now();
            currentTemplateRaw[newKey] = {
                "uid": newKey,
                "name": "新建数据表",
                "exportConfig": { "entryType": "constant", "keywords": "" },
                "sourceData": { "note": "", "updateNode": "", "insertNode": "", "deleteNode": "" },
                "content": [ ["row_id", "新列1"] ],
                "updateConfig": { "batchSize": 4, "contextDepth": 4, "skipFloors": -1, "uiSentinel": -1, "updateFrequency": -1 },
                "orderNo": 99
            };
            renderTplSidebar();
        });
    }

    const delTplSheetBtn = document.getElementById('btn-tpl-delete-sheet');
    if(delTplSheetBtn) {
        delTplSheetBtn.addEventListener('click', () => {
            if(!tplCurrentSheetId || !currentTemplateRaw) return;
            if(!confirm(`确定要彻底删除表 ${tplCurrentSheetId} 吗？`)) return;
            delete currentTemplateRaw[tplCurrentSheetId];
            tplCurrentSheetId = null;
            renderTplSidebar();
        });
    }

    const saveTplBtn = document.getElementById('save-databank-template-btn');
    if(saveTplBtn) {
        saveTplBtn.addEventListener('click', () => {
            // 同步当前表单数据
            syncTplFormToMemory();
            
            if(!confirm("确定要将当前所有的架构和提示词保存到模板文件中吗？")) return;
            
            saveTplBtn.disabled = true;
            saveTplBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            
            fetch('/api/databank/update_template', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ raw_json: JSON.stringify(currentTemplateRaw, null, 2) })
            }).then(res => res.json()).then(data => {
                saveTplBtn.disabled = false;
                saveTplBtn.innerHTML = '<i class="fas fa-save"></i> 保存全部模板结构';
                if(data.status === 'success') {
                    alert("模板架构覆写成功！");
                } else {
                    alert("保存失败: " + data.message);
                }
            }).catch(err => {
                saveTplBtn.disabled = false;
                saveTplBtn.innerHTML = '<i class="fas fa-save"></i> 保存全部模板结构';
                alert("请求出错: " + err);
            });
        });
    }

    const exportTplBtn = document.getElementById('btn-tpl-export');
    if(exportTplBtn) {
        exportTplBtn.addEventListener('click', () => {
            syncTplFormToMemory();
            const jsonStr = JSON.stringify(currentTemplateRaw, null, 2);
            const blob = new Blob([jsonStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "TavernDB_template_export.json";
            a.click();
            URL.revokeObjectURL(url);
        });
    }

});
'''

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(base_js + new_js)
print("JS logic replaced successfully.")
