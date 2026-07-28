import sys

js_path = r'g:\code\rumia\services\static\js\dashboard.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

# We need to replace syncTplFormToMemory, renderTplColumns, and tplAddColBtn

new_sync = '''    // 从 DOM 表单收集数据并同步回 currentTemplateRaw
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
        
        // 读取列名（表头）与 列规则
        sheet.sourceData.columnRules = {};
        const colItems = document.querySelectorAll('#tpl-columns-list li');
        const headers = [];
        
        colItems.forEach(li => {
            const nameInput = li.querySelector('.tpl-col-input');
            const ruleInput = li.querySelector('.tpl-col-rule');
            if(nameInput) {
                const cname = nameInput.value.trim();
                if(cname) {
                    headers.push(cname);
                    if(ruleInput && ruleInput.value.trim()) {
                        sheet.sourceData.columnRules[cname] = ruleInput.value.trim();
                    }
                }
            }
        });
        
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
    }'''

new_render_cols = '''    function renderTplColumns(sheet) {
        const listEl = document.getElementById('tpl-columns-list');
        listEl.innerHTML = '';
        
        let headers = [];
        if (sheet.content && sheet.content.length > 0) {
            headers = sheet.content[0];
        } else {
            headers = ['row_id']; // 默认初始列
        }
        
        const columnRules = (sheet.sourceData && sheet.sourceData.columnRules) || {};
        
        headers.forEach((colName, index) => {
            const rule = columnRules[colName] || '';
            const li = createColCard(colName, rule, index === 0 && colName === 'row_id');
            listEl.appendChild(li);
        });
    }

    function createColCard(colName = '', rule = '', isReadOnlyPK = false) {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.flexDirection = 'column';
        li.style.gap = '8px';
        li.style.background = 'var(--bg-secondary)';
        li.style.padding = '10px';
        li.style.borderRadius = 'var(--border-radius)';
        li.style.border = '1px solid var(--border-color)';
        
        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.gap = '10px';
        topRow.style.alignItems = 'center';
        
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'modern-input tpl-col-input';
        inp.style.flex = '1';
        inp.value = colName;
        inp.placeholder = "列名 (如: 当前主导情绪)";
        if(isReadOnlyPK) inp.readOnly = true; // 保护主键
        
        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn danger';
        delBtn.style.padding = '5px 10px';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.addEventListener('click', () => { li.remove(); });
        if(isReadOnlyPK) delBtn.disabled = true; // 保护主键
        
        topRow.appendChild(inp);
        topRow.appendChild(delBtn);
        
        const botRow = document.createElement('div');
        const ruleInp = document.createElement('textarea');
        ruleInp.className = 'modern-input tpl-col-rule';
        ruleInp.style.width = '100%';
        ruleInp.style.height = '40px';
        ruleInp.style.resize = 'vertical';
        ruleInp.placeholder = "列级规则约束 (选填，例如：只能使用2个汉字，或者：只读严禁修改)";
        ruleInp.value = rule;
        botRow.appendChild(ruleInp);
        
        li.appendChild(topRow);
        li.appendChild(botRow);
        return li;
    }

    const tplAddColBtn = document.getElementById('tpl-add-column-btn');
    if(tplAddColBtn) {
        tplAddColBtn.addEventListener('click', () => {
            const listEl = document.getElementById('tpl-columns-list');
            const li = createColCard('', '', false);
            listEl.appendChild(li);
        });
    }'''

import re

# replace syncTplFormToMemory
js_content = re.sub(
    r'    // 从 DOM 表单收集数据并同步回 currentTemplateRaw.*?    function renderTplEditorForm\(key\)', 
    new_sync + '\n\n    function renderTplEditorForm(key)', 
    js_content, 
    flags=re.DOTALL
)

# replace renderTplColumns and tplAddColBtn
js_content = re.sub(
    r'    function renderTplColumns\(sheet\).*?    const addTplSheetBtn = document\.getElementById\(\'add-tpl-sheet-btn\'\);',
    new_render_cols + '\n\n    const addTplSheetBtn = document.getElementById(\'add-tpl-sheet-btn\');',
    js_content,
    flags=re.DOTALL
)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)
print("JS col logic replaced successfully.")
