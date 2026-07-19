import os
import json
import re
from core.config_manager import get_file_path

def get_databank_paths():
    """获取当前角色的 Databank 模板和状态存储路径"""
    template_path = get_file_path("databank_template.json")
    state_path = get_file_path("databank_state.json")
    return template_path, state_path

def load_databank():
    """加载并合并模板与当前状态，如果状态中没有某张表的数据，则使用模板里的初始数据"""
    template_path, state_path = get_databank_paths()
    
    if not os.path.exists(template_path):
        return None
        
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template = json.load(f)
    except Exception as e:
        print(f"[DataBank] 读取模板失败: {e}")
        return None
        
    state = {}
    if os.path.exists(state_path):
        try:
            with open(state_path, 'r', encoding='utf-8') as f:
                state = json.load(f)
        except Exception as e:
            print(f"[DataBank] 读取状态失败: {e}")

    # 合并
    merged = {}
    for key, sheet in template.items():
        if not key.startswith("sheet_"):
            continue
            
        merged[key] = {
            "name": sheet.get("name", key),
            "exportConfig": sheet.get("exportConfig", {}),
            "sourceData": sheet.get("sourceData", {}),
            # 如果状态文件里有保存过这个表的行数据，优先用状态里的，否则用模板默认的
            "content": state.get(key, sheet.get("content", []))
        }
        
    return merged

def save_databank_state(merged_data):
    """提取 content 并保存为状态文件"""
    if not merged_data:
        return
        
    state = {}
    for key, sheet in merged_data.items():
        state[key] = sheet["content"]
        
    _, state_path = get_databank_paths()
    try:
        with open(state_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[DataBank] 保存状态失败: {e}")

def get_active_tables(user_message, current_pool=""):
    """
    根据当前消息和上下文触发词，筛选并格式化当前应该注入的 DataBank 表格
    返回: (格式化后的Markdown文本, 注入位置偏好)
    """
    merged = load_databank()
    if not merged:
        return ""
        
    search_text = (user_message + "\n" + current_pool).lower()
    
    active_tables_md = []
    
    for key, sheet in merged.items():
        export_config = sheet.get("exportConfig", {})
        entry_type = export_config.get("entryType", "constant")
        keywords_str = export_config.get("keywords", "")
        
        is_active = False
        
        if entry_type == "constant":
            is_active = True
        elif entry_type == "keyword" and keywords_str:
            # 简单按照逗号分割关键字，如果包含就命中
            kws = [k.strip().lower() for k in keywords_str.split(',') if k.strip()]
            for kw in kws:
                if kw in search_text:
                    is_active = True
                    break
                    
        if is_active:
            content = sheet.get("content", [])
            if not content:
                continue
                
            # 将二维数组转为 Markdown Table
            md_table = f"### DataBank Table: {sheet.get('name')}\n"
            md_table += "|" + "|".join([str(x).replace('|', '\\|') for x in content[0]]) + "|\n"
            md_table += "|" + "|".join(["---"] * len(content[0])) + "|\n"
            
            for row in content[1:]:
                md_table += "|" + "|".join([str(x).replace('|', '\\|') for x in row]) + "|\n"
                
            active_tables_md.append(md_table)
            
    if not active_tables_md:
        return ""
        
    return "\n\n".join(active_tables_md)

def get_databank_rules_for_llm():
    """获取发给大模型的后台更新规则提示词"""
    merged = load_databank()
    if not merged:
        return ""
        
    rules_md = []
    for key, sheet in merged.items():
        source_data = sheet.get("sourceData", {})
        # 只要存在更新或插入规则，就告知大模型
        note = source_data.get("note", "")
        update_node = source_data.get("updateNode", "")
        insert_node = source_data.get("insertNode", "")
        
        if not (update_node or insert_node):
            continue
            
        rule = f"- **{sheet.get('name')} (Sheet ID: {key})**:\n"
        if note:
            rule += f"  - 说明: {note}\n"
        if insert_node:
            rule += f"  - 新增条件: {insert_node}\n"
        if update_node:
            rule += f"  - 更新条件: {update_node}\n"
        
        rules_md.append(rule)
        
    if not rules_md:
        return ""
        
    return (
        "【后台数据表 (DataBank) 自动更新规则】\n"
        "你可以通过特殊的输出指令修改后台的数据表。只有在极度确信情况发生改变时才使用，以符合以下规则：\n"
        + "\n".join(rules_md) + "\n"
        "如果你要更新表格，请在回复的最后面附加上格式如下的指令，不要解释指令：\n"
        "格式：\n"
        "```databank\n"
        "UPDATE_TABLE: sheet_id, 行号(第一行数据为1), 列号(第一列为0), 新值\n"
        "INSERT_ROW: sheet_id, [新值1, 新值2, ...]\n"
        "```\n"
        "例如更新全局数据表的当前时间（假设时间在第6列）: UPDATE_TABLE: sheet_global_data, 1, 6, 2024-01-01 10:00"
    )

def parse_and_execute_databank_commands(llm_output):
    """解析大模型输出中的 ```databank ... ``` 块并执行"""
    merged = load_databank()
    if not merged:
        return llm_output # 没有配置 databank，不处理
        
    pattern = r"```databank\n(.*?)\n```"
    match = re.search(pattern, llm_output, re.DOTALL)
    if not match:
        return llm_output
        
    commands_text = match.group(1).strip()
    clean_output = re.sub(pattern, "", llm_output, flags=re.DOTALL).strip()
    
    modified = False
    for line in commands_text.split('\n'):
        line = line.strip()
        if not line: continue
        
        try:
            if line.startswith("UPDATE_TABLE:"):
                # UPDATE_TABLE: sheet_id, row_idx, col_idx, new_value
                parts = [x.strip() for x in line[len("UPDATE_TABLE:"):].split(',', 3)]
                if len(parts) == 4:
                    sheet_id, row_idx, col_idx, new_value = parts
                    row_idx, col_idx = int(row_idx), int(col_idx)
                    
                    if sheet_id in merged:
                        content = merged[sheet_id]["content"]
                        # row_idx=1 代表第二行(也就是数据第一行)，因为 header=0
                        if 0 <= row_idx < len(content) and 0 <= col_idx < len(content[0]):
                            content[row_idx][col_idx] = new_value
                            modified = True
                            print(f"[DataBank] 更新: {sheet_id} 行{row_idx} 列{col_idx} -> {new_value}")
                            
            elif line.startswith("INSERT_ROW:"):
                # INSERT_ROW: sheet_id, [v1, v2]
                parts = line[len("INSERT_ROW:"):].split(',', 1)
                if len(parts) == 2:
                    sheet_id = parts[0].strip()
                    row_data_str = parts[1].strip()
                    if sheet_id in merged and row_data_str.startswith('[') and row_data_str.endswith(']'):
                        # 简单的列表解析或 json 解析，兼容单引号
                        try:
                            # 替换单引号为双引号
                            row_data_str = row_data_str.replace("'", '"')
                            row_data = json.loads(row_data_str)
                            if isinstance(row_data, list):
                                merged[sheet_id]["content"].append(row_data)
                                modified = True
                                print(f"[DataBank] 插入: {sheet_id} -> {row_data}")
                        except:
                            pass
        except Exception as e:
            print(f"[DataBank] 解析指令失败: {line}, 错误: {e}")
            
    if modified:
        save_databank_state(merged)
        
    return clean_output
