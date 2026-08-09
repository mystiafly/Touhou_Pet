import os
import json
import re
import random
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
        state_content = state.get(key)
        template_content = sheet.get("content", [])
        
        final_content = template_content
        if state_content and len(state_content) > 0 and len(template_content) > 0:
            state_headers = state_content[0]
            template_headers = template_content[0]
            
            if state_headers != template_headers:
                # Check if there is any overlap in columns (excluding row_id)
                overlap = set(template_headers[1:]) & set(state_headers[1:])
                if not overlap and len(template_headers) > 1:
                    # Incompatible schema, drop old state
                    final_content = template_content
                else:
                    # Re-align state_content to match template_headers
                    realigned_content = [template_headers]
                    for row in state_content[1:]:
                        new_row = []
                        is_empty = True
                        for i, h in enumerate(template_headers):
                            if h in state_headers:
                                idx = state_headers.index(h)
                                val = row[idx] if idx < len(row) else ""
                                new_row.append(val)
                                if i > 0 and str(val).strip():
                                    is_empty = False
                            else:
                                new_row.append("")
                        if not is_empty:
                            realigned_content.append(new_row)
                    final_content = realigned_content
            else:
                final_content = state_content
        elif state_content:
            final_content = state_content
            
        # 如果是桌宠状态表且只有表头，自动预置初始状态行，防止 UI 空显与更新被吞
        if key == "sheet_pet_status" and len(final_content) <= 1:
            final_content.append(["1", "平静", "陪伴在用户身边", "50"])

        merged[key] = {
            "name": sheet.get("name", key),
            "exportConfig": sheet.get("exportConfig", {}),
            "sourceData": sheet.get("sourceData", {}),
            "content": final_content
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

def save_databank_state_sheet(sheet_id, content):
    """单独更新某一张表的数据行并保存"""
    merged = load_databank()
    if not merged:
        return False, "未能加载DataBank"
    if sheet_id not in merged:
        return False, f"表 {sheet_id} 不存在"
        
    merged[sheet_id]["content"] = content
    save_databank_state(merged)
    return True, "保存成功"

def save_databank_template_raw(raw_json_str):
    """全量覆盖写入模板文件"""
    try:
        # 先校验是否是合法JSON
        data = json.loads(raw_json_str)
        template_path, _ = get_databank_paths()
        if not template_path:
            return False, "当前角色无 DataBank 模板，无法保存"
            
        with open(template_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return True, "模板保存成功"
    except json.JSONDecodeError as e:
        return False, f"JSON 语法错误: {e}"
    except Exception as e:
        return False, f"保存模板失败: {e}"

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
        
        # 1. 检查 enabled 标志 (若显式声明 enabled=False 则跳过)
        if export_config.get("enabled") is False:
            continue

        entry_type = export_config.get("entryType", "constant")
        keywords_str = export_config.get("keywords", "")
        
        # 对日常摘要表 (sheet_summary) 强行常驻唤醒保活，确保聊天要点始终可被检索
        if key == "sheet_summary":
            entry_type = "constant"
        
        is_active = False
        active_rows = []
        
        if entry_type == "constant":
            is_active = True
            active_rows = sheet.get("content", [])
        elif entry_type == "keyword":
            content = sheet.get("content", [])
            if not content or len(content) <= 1:
                continue
            
            headers = content[0]
            data_rows = content[1:]
            
            kws = [k.strip() for k in keywords_str.split(',') if k.strip()] if keywords_str else []
            
            # 分解关键词：区分是“列名”（指向目标列精细搜寻）还是普通的“触发关键字”
            target_col_indices = []
            plain_kws = []
            
            for kw in kws:
                kw_lower = kw.lower()
                matched_idx = None
                for idx, h in enumerate(headers):
                    if str(h).strip().lower() == kw_lower:
                        matched_idx = idx
                        break
                if matched_idx is not None:
                    target_col_indices.append(matched_idx)
                else:
                    plain_kws.append(kw_lower)
            
            # 1. 检查普通触发词是否命中 (如 "昨天", "日常", "摘要", "记录", "以前")
            plain_kw_matched = False
            if plain_kws:
                for pkw in plain_kws:
                    if pkw in search_text:
                        plain_kw_matched = True
                        break
            
            # 2. 提取用户消息中的中文词组 n-grams (2-4字)
            stop_words = {'的时候', '和我', '跟我', '了一下', '你可以', '你知不知道', '你知道', '怎么', '什么', '可以', '一下'}
            user_ngrams = set()
            clean_search = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', search_text)
            for l in [2, 3, 4]:
                for i in range(len(clean_search) - l + 1):
                    gram = clean_search[i:i+l]
                    if gram not in stop_words:
                        user_ngrams.add(gram)
            
            matched_data_rows = []
            for row in data_rows:
                row_matched = plain_kw_matched
                
                if not row_matched:
                    # 确定要检索的列范围：指定了列名查目标列，否则查全行除row_id外
                    check_cols = target_col_indices if target_col_indices else list(range(1, len(row)))
                    
                    for col_idx in check_cols:
                        if col_idx < len(row):
                            cell_val = str(row[col_idx]).strip().lower()
                            if not cell_val:
                                continue
                            
                            # 直接包含比对
                            if cell_val in search_text or search_text in cell_val:
                                row_matched = True
                                break
                            
                            # 中文 n-gram 词组重合判定
                            if user_ngrams and any(gram in cell_val for gram in user_ngrams):
                                row_matched = True
                                break
                
                if row_matched:
                    matched_data_rows.append(row)
            
            if matched_data_rows:
                is_active = True
                active_rows = [headers] + matched_data_rows
            elif not kws or plain_kw_matched:
                # 若未配置关键词或全局命中了关键词，平滑降级展示全表/最新记录
                is_active = True
                active_rows = content
                        
        if is_active and active_rows:
            try:
                inject_limit = int(export_config.get("injectLimit", 10))
            except (ValueError, TypeError):
                inject_limit = 10
            inject_strategy = export_config.get("injectStrategy", "recent")
            
            headers = active_rows[0]
            data_rows = active_rows[1:]
            
            if len(data_rows) > inject_limit:
                if inject_strategy == "random":
                    data_rows = random.sample(data_rows, inject_limit)
                else: # "recent"
                    data_rows = data_rows[-inject_limit:]
            
            active_rows = [headers] + data_rows

            # 将二维数组转为 Markdown Table
            md_table = f"### DataBank Table: {sheet.get('name')}\n"
            md_table += "|" + "|".join([str(x).replace('|', '\\|') for x in active_rows[0]]) + "|\n"
            md_table += "|" + "|".join(["---"] * len(active_rows[0])) + "|\n"
            
            for row in active_rows[1:]:
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
        column_rules = source_data.get("columnRules", {})
        
        if not (update_node or insert_node or column_rules):
            continue
            
        rule = f"- **{sheet.get('name')} (Sheet ID: {key})**:\n"
        if note:
            rule += f"  - 说明: {note}\n"
        if insert_node:
            rule += f"  - 新增条件: {insert_node}\n"
        if update_node:
            rule += f"  - 更新规则: {update_node}\n"
            
        columns = sheet.get("content", [[]])[0] if sheet.get("content") else []
        llm_columns = columns[1:] if columns and columns[0] == "row_id" else columns
        if llm_columns:
            import json
            rule += f"  - 表头字段(严格注意！INSERT_ROW提供的数组必须与此表头顺序完全一致且长度相同，且必须是合法的JSON数组，所有字符串用双引号包裹): {json.dumps(llm_columns, ensure_ascii=False)}\n"
            
        if column_rules:
            rule += "  - 字段格式要求:\n"
            for col_name, col_rule in column_rules.items():
                if col_rule.strip():
                    rule += f"    - [{col_name}]: {col_rule}\n"
        
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
        "UPDATE_TABLE: sheet_id, 行号(如为1)或row_id, 列号(第一列为0), 新值\n"
        "INSERT_ROW: sheet_id, [\"值1\", \"值2\", ...]\n"
        "```\n"
        "例如更新全局数据表的当前时间（假设时间在第6列）: UPDATE_TABLE: sheet_global_data, 1, 6, 2024-01-01 10:00"
    )

def parse_and_execute_databank_commands(llm_output):
    """解析大模型输出中的 ```databank ... ``` 块并执行"""
    merged = load_databank()
    if not merged:
        return llm_output # 没有配置 databank，不处理
        
    commands_text = ""
    pattern = r"```databank\n(.*?)\n```"
    match = re.search(pattern, llm_output, re.DOTALL)
    if match:
        commands_text = match.group(1).strip()
    else:
        # Fallback: extract any valid commands if markdown wrapper is missing
        lines = []
        for line in llm_output.split('\n'):
            line = line.strip()
            if line.startswith("UPDATE_TABLE:") or line.startswith("INSERT_ROW:"):
                lines.append(line)
        if lines:
            commands_text = "\n".join(lines)
        else:
            return llm_output
        
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
                    sheet_id, row_idx_str, col_idx_str, new_value = parts
                    col_idx = int(col_idx_str)
                    
                    if sheet_id in merged:
                        content = merged[sheet_id]["content"]
                        
                        row_idx = -1
                        try:
                            row_idx = int(row_idx_str)
                        except ValueError:
                            for i, row in enumerate(content):
                                if row and str(row[0]).strip() == row_idx_str:
                                    row_idx = i
                                    break
                                    
                        # 自动补全/扩展缺失数据行
                        if row_idx >= len(content):
                            import uuid
                            num_cols = len(content[0]) if content else 4
                            while len(content) <= row_idx:
                                new_row = [str(len(content)) if j == 0 else "" for j in range(num_cols)]
                                content.append(new_row)

                        if 0 <= row_idx < len(content) and 0 <= col_idx < len(content[row_idx]):
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
                        import ast
                        try:
                            # Use ast.literal_eval to safely parse list string with potential single quotes
                            row_data = ast.literal_eval(row_data_str)
                            if not isinstance(row_data, list):
                                raise ValueError("Not a list")
                        except Exception:
                            # Fallback to json if ast fails
                            try:
                                row_data_str = row_data_str.replace("'", '"')
                                row_data = json.loads(row_data_str)
                            except Exception:
                                row_data = None

                        if isinstance(row_data, list):
                                actual_cols = merged[sheet_id].get("content", [[]])[0]
                                if actual_cols and actual_cols[0] == "row_id":
                                    import uuid
                                    new_id = "row_" + uuid.uuid4().hex[:8]
                                    row_data.insert(0, new_id)
                                    
                                while len(row_data) < len(actual_cols):
                                    row_data.append("")
                                    
                                merged[sheet_id]["content"].append(row_data)
                                modified = True
                                print(f"[DataBank] 新增行: {sheet_id} -> {row_data}")

        except Exception as e:
            print(f"[DataBank] 解析指令失败: {line}, 错误: {e}")
            
    if modified:
        save_databank_state(merged)
        
    return clean_output
