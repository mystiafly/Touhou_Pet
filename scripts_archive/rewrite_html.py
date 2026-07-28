import sys

html_path = r'g:\code\rumia\services\templates\dashboard.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace Data Mode description paragraph to hide it
old_desc = '''<p id="databank-table-desc" style="color: var(--text-secondary); font-size: 0.9em; margin-bottom: 15px; white-space: pre-wrap;">(可在模板模式中修改这里的描述和潜规则)</p>'''
new_desc = '''<p id="databank-table-desc" style="display: none;"></p>'''
html = html.replace(old_desc, new_desc)

# Replace Template Mode container entirely
import re

start_marker = '<!-- 模式2：模板架构模式 -->'
end_marker = '</section>'

start_idx = html.find(start_marker)
end_idx = html.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("HTML markers not found")
    sys.exit(1)

new_template_mode = '''<!-- 模式2：模板架构模式 GUI -->
            <div id="databank-template-mode" class="databank-container" style="display: none; gap: 20px; height: calc(100vh - 220px);">
                <!-- 左侧：表名列表 -->
                <div class="databank-sidebar" style="flex: 0 0 250px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: 15px; overflow-y: auto; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                        <h3 style="margin: 0;"><i class="fas fa-sitemap"></i> 模板架构</h3>
                    </div>
                    <ul id="databank-tpl-sheet-list" style="list-style: none; padding: 0; margin-top: 10px; flex: 1;">
                        <!-- JS动态填充 -->
                    </ul>
                    <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
                        <button id="add-tpl-sheet-btn" class="action-btn outline"><i class="fas fa-plus"></i> 新建一张空表</button>
                    </div>
                </div>

                <!-- 右侧：属性配置器 -->
                <div class="databank-main" style="flex: 1; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: 15px; display: flex; flex-direction: column; overflow-y: auto;">
                    <div id="tpl-empty-state" style="text-align: center; color: var(--text-secondary); margin-top: 50px;">
                        <i class="fas fa-hammer" style="font-size: 2em; margin-bottom: 10px;"></i>
                        <p>请在左侧选择一张表进行架构配置</p>
                    </div>
                    
                    <div id="tpl-editor-container" style="display: none; flex-direction: column; gap: 20px;">
                        <!-- 顶栏操作 -->
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                            <h2 style="margin: 0; color: var(--accent-color);">表级属性配置</h2>
                            <div style="display: flex; gap: 10px;">
                                <button id="btn-tpl-export" class="action-btn outline" style="font-size: 0.85em;"><i class="fas fa-download"></i> 导出模板</button>
                                <button id="btn-tpl-delete-sheet" class="action-btn danger" style="font-size: 0.85em;"><i class="fas fa-trash"></i> 删除此表</button>
                                <button id="save-databank-template-btn" class="action-btn" style="font-size: 0.85em;"><i class="fas fa-save"></i> 保存全部模板结构</button>
                            </div>
                        </div>
                        
                        <!-- 基础设置 -->
                        <div style="background: var(--bg-primary); padding: 15px; border-radius: var(--border-radius);">
                            <h3 style="margin-top: 0;"><i class="fas fa-info-circle"></i> 基础设置</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <label class="form-label">表名 (Name)</label>
                                    <input type="text" id="tpl-fld-name" class="modern-input" placeholder="例如: 全局数据表">
                                </div>
                                <div>
                                    <label class="form-label">表标识 (Key/UID)</label>
                                    <input type="text" id="tpl-fld-uid" class="modern-input" placeholder="例如: sheet_global_data">
                                </div>
                                <div>
                                    <label class="form-label">触发类型</label>
                                    <select id="tpl-fld-entrytype" class="modern-input">
                                        <option value="constant">常驻 (始终注入)</option>
                                        <option value="keyword">关键字触发</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">触发词 (多词逗号分隔)</label>
                                    <input type="text" id="tpl-fld-keywords" class="modern-input" placeholder="例如: 灵梦,神社">
                                </div>
                            </div>
                        </div>
                        
                        <!-- 规则提示词 -->
                        <div style="background: var(--bg-primary); padding: 15px; border-radius: var(--border-radius);">
                            <h3 style="margin-top: 0;"><i class="fas fa-book"></i> 潜规则与提示词 (Prompts)</h3>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <div>
                                    <label class="form-label">表说明 (note)</label>
                                    <textarea id="tpl-fld-note" class="modern-input" style="height: 60px; resize: vertical;" placeholder="告诉大模型这张表是干什么的..."></textarea>
                                </div>
                                <div>
                                    <label class="form-label">更新条件 (updateNode)</label>
                                    <textarea id="tpl-fld-updatenode" class="modern-input" style="height: 40px; resize: vertical;" placeholder="告诉大模型什么时候该去修改数据..."></textarea>
                                </div>
                                <div>
                                    <label class="form-label">插入条件 (insertNode)</label>
                                    <textarea id="tpl-fld-insertnode" class="modern-input" style="height: 40px; resize: vertical;" placeholder="告诉大模型什么时候该去增加新行..."></textarea>
                                </div>
                                <div>
                                    <label class="form-label">删除条件 (deleteNode)</label>
                                    <textarea id="tpl-fld-deletenode" class="modern-input" style="height: 40px; resize: vertical;" placeholder="告诉大模型什么时候该删行..."></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- 列管理器 -->
                        <div style="background: var(--bg-primary); padding: 15px; border-radius: var(--border-radius);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h3 style="margin: 0;"><i class="fas fa-columns"></i> 列(字段)管理器</h3>
                                <button id="tpl-add-column-btn" class="action-btn outline" style="padding: 2px 8px;"><i class="fas fa-plus"></i> 新增一列</button>
                            </div>
                            <p style="font-size: 0.85em; color: var(--text-secondary); margin-top: 0;">在这里定义表的结构。此处定义的列名即为数据表中的表头(第一行)。</p>
                            
                            <ul id="tpl-columns-list" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px;">
                                <!-- JS动态渲染列 -->
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        '''

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html[:start_idx] + new_template_mode + "\n        " + html[end_idx:])
print("HTML modified successfully.")
