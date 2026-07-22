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

# Import the updated generate_pet_diary that handles reaction appending
from workers.distillation import generate_pet_diary

def _process_missing_diaries():
    """后台处理缺失日记的核心逻辑，改为纯文本对账"""
    if not os.path.exists(DAILY_HISTORY_DIR):
        return
        
    config = get_config()
    char_id = config.get("character_id", "rumia")
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    for filename in sorted(os.listdir(DAILY_HISTORY_DIR)):
        if filename.startswith("chat_log_") and filename.endswith(".txt"):
            date_str = filename.replace("chat_log_", "").replace(".txt", "")
            
            # 跳过今天
            if date_str >= today_str:
                continue
                
            # 检查对应的日记文本是否存在
            diary_filename = f"{char_id}_diary_{date_str}.txt"
            diary_path = os.path.join(DAILY_HISTORY_DIR, diary_filename)
            
            if os.path.exists(diary_path):
                continue
                
            log_path = os.path.join(DAILY_HISTORY_DIR, filename)
            with open(log_path, 'r', encoding='utf-8') as f:
                chat_content = f.read().strip()
                
            if not chat_content:
                continue
                
            print(f"[DiaryBatch] 发现缺失日记，正在补写 {date_str} 并顺带进化词库...")
            
            # 使用带反应词生成的新版日记函数
            new_diary_content = generate_pet_diary(date_str, chat_content)
            
            try:
                with open(diary_path, 'w', encoding='utf-8') as df:
                    df.write(new_diary_content)
                print(f"[DiaryBatch] {date_str} 日记补写完成。")
            except Exception as e:
                print(f"[DiaryBatch] 保存日记失败: {e}")

def check_and_generate_diaries_async():
    """启动一个异步后台线程进行对账，防止阻塞主程序"""
    thread = threading.Thread(target=_process_missing_diaries)
    thread.daemon = True
    thread.start()
