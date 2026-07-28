import sys
import re

js_path = r'g:\code\rumia\services\static\js\dashboard.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

# 1. Protect rendering:
# Find: document.getElementById('tpl-fld-uid').value = key;
# We want to add:
# document.getElementById('tpl-fld-uid').readOnly = sheet.isSystem ? true : false;
# if (sheet.isSystem) {
#    document.getElementById('btn-tpl-delete-sheet').disabled = true;
#    document.getElementById('btn-tpl-delete-sheet').title = "系统默认表不可删除";
# } else {
#    document.getElementById('btn-tpl-delete-sheet').disabled = false;
#    document.getElementById('btn-tpl-delete-sheet').title = "";
# }

new_render_form = '''        // 填充基础设置
        const uidInput = document.getElementById('tpl-fld-uid');
        uidInput.value = key;
        uidInput.readOnly = sheet.isSystem ? true : false;
        if(sheet.isSystem) {
            uidInput.style.background = 'var(--bg-primary)';
            uidInput.title = "系统保留标识，不可修改";
        } else {
            uidInput.style.background = '';
            uidInput.title = "";
        }
        
        const delBtn = document.getElementById('btn-tpl-delete-sheet');
        if (delBtn) {
            if (sheet.isSystem) {
                delBtn.disabled = true;
                delBtn.style.opacity = '0.5';
                delBtn.style.cursor = 'not-allowed';
                delBtn.title = "系统默认核心表，为防止崩溃不可删除";
            } else {
                delBtn.disabled = false;
                delBtn.style.opacity = '1';
                delBtn.style.cursor = 'pointer';
                delBtn.title = "";
            }
        }
        
        document.getElementById('tpl-fld-name').value = sheet.name || '';'''

js_content = re.sub(
    r'        // 填充基础设置\s*document\.getElementById\(\'tpl-fld-uid\'\)\.value = key;\s*document\.getElementById\(\'tpl-fld-name\'\)\.value = sheet\.name \|\| \'\';',
    new_render_form,
    js_content,
    flags=re.DOTALL
)

# 2. Protect deletion logic:
# Find: delete currentTemplateRaw[tplCurrentSheetId];
new_del = '''            if(currentTemplateRaw[tplCurrentSheetId].isSystem) {
                alert("这是系统默认的核心表，不可删除！");
                return;
            }
            delete currentTemplateRaw[tplCurrentSheetId];'''
js_content = js_content.replace('            delete currentTemplateRaw[tplCurrentSheetId];', new_del)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)
print("JS protection logic replaced successfully.")
