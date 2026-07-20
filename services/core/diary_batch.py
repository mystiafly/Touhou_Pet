import os
import re
import json
from datetime import datetime
import threading

from core.memory_manager import DAILY_HISTORY_DIR
from core.databank_manager import load_databank, save_databank_state
from core.llm_client import get_langchain_model
from core.config_manager import get_config
from langchain_core.messages import SystemMessage, HumanMessage

def generate_diary_for_date(date_str, chat_content):
    """调用大模型为某一天的聊天记录生成大纲和详细日记"""
    llm = get_langchain_model()
    char_name = get_config().get("character_name", "桌宠")
    
    prompt = f"""你是{char_name}，一只一直陪伴在主人桌面的电子桌宠。
请阅读你昨天（{date_str}）和主人的聊天记录，并以第一人称写下一篇真情实感的日记。

聊天记录：
{chat_content}

请必须返回纯JSON格式，包含两个字段：
1. "summary"：一句话摘要，极其简练，不超过10个字。
2. "detail"：详细日记正文，尽情发挥，记录温馨细节、羁绊以及内心的情感波折。

示例输出：
{{
  "summary": "和主人聊了未来",
  "detail": "今天虽然没有发生什么特别的大事，但仅仅是待在桌面上看着主人工作，偶尔聊上两句，这种平静的时光就让我觉得很幸福。希望能一直这样下去……"
}}
"""
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        # 尝试提取JSON
        content = response.content
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return data.get("summary", "无标题"), data.get("detail", "无内容")
        return "无法生成", "由于未知原因，日记生成失败。"
    except Exception as e:
        print(f"[DiaryBatch] 大模型生成日记失败: {e}")
        return "回想失败", f"发生了错误，无法回想当天的细节: {e}"

def _process_missing_diaries():
    """后台处理缺失日记的核心逻辑"""
    if not os.path.exists(DAILY_HISTORY_DIR):
        return
        
    databank = load_databank()
    if not databank or "sheet_diary_index" not in databank or "sheet_diary_detail" not in databank:
        print("[DiaryBatch] 未找到日记系统表，跳过补写。")
        return
        
    index_sheet = databank["sheet_diary_index"]
    detail_sheet = databank["sheet_diary_detail"]
    
    index_content = index_sheet.get("content", [])
    if len(index_content) == 0:
        index_content.append(["row_id", "日记编号", "日期", "一句话摘要"])
        
    detail_content = detail_sheet.get("content", [])
    if len(detail_content) == 0:
        detail_content.append(["row_id", "日记编号", "详细日记内容", "情感波折"])
        
    # 获取已有的所有日期集合
    existing_dates = set()
    date_col_idx = -1
    if "日期" in index_content[0]:
        date_col_idx = index_content[0].index("日期")
        for row in index_content[1:]:
            if len(row) > date_col_idx:
                existing_dates.add(row[date_col_idx])
                
    if date_col_idx == -1:
        print("[DiaryBatch] sheet_diary_index 缺少 '日期' 列，无法对账！")
        return
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    modified = False
    
    for filename in sorted(os.listdir(DAILY_HISTORY_DIR)):
        if filename.startswith("chat_log_") and filename.endswith(".txt"):
            date_str = filename.replace("chat_log_", "").replace(".txt", "")
            
            # 跳过今天
            if date_str >= today_str:
                continue
                
            # 如果这天的日记已经写过，跳过
            if date_str in existing_dates:
                continue
                
            log_path = os.path.join(DAILY_HISTORY_DIR, filename)
            with open(log_path, 'r', encoding='utf-8') as f:
                chat_content = f.read().strip()
                
            if not chat_content:
                continue
                
            print(f"[DiaryBatch] 发现缺失日记，正在补写 {date_str} ...")
            
            # 生成日记内容
            summary, detail = generate_diary_for_date(date_str, chat_content)
            
            # 计算新编号
            max_num = 0
            id_col_idx = index_content[0].index("日记编号") if "日记编号" in index_content[0] else 1
            for row in index_content[1:]:
                try:
                    if len(row) > id_col_idx:
                        num = int(str(row[id_col_idx]).replace('D', ''))
                        if num > max_num: max_num = num
                except:
                    pass
            new_id = f"D{max_num+1:03d}"
            
            # 插入新行
            # index: ["row_id", "日记编号", "日期", "一句话摘要"]
            new_row_id = str(len(index_content))
            index_content.append([new_row_id, new_id, date_str, summary])
            
            # detail: ["row_id", "日记编号", "详细日记内容", "情感波折"]
            new_detail_row_id = str(len(detail_content))
            detail_content.append([new_detail_row_id, new_id, detail, summary])
            
            existing_dates.add(date_str)
            modified = True
            print(f"[DiaryBatch] {date_str} 日记补写完成，编号 {new_id}。")
            
    if modified:
        databank["sheet_diary_index"]["content"] = index_content
        databank["sheet_diary_detail"]["content"] = detail_content
        save_databank_state(databank)
        print("[DiaryBatch] 批处理完成，DataBank已保存。")

def check_and_generate_diaries_async():
    """启动一个异步后台线程进行对账，防止阻塞主程序"""
    thread = threading.Thread(target=_process_missing_diaries)
    thread.daemon = True
    thread.start()
