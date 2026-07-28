import sys
import os
import json

sys.path.append(os.path.join(os.path.dirname(__file__), "services"))

from core.databank_manager import load_databank
from core.config_manager import get_file_path, get_active_character_id

def restore_daily():
    db = load_databank()
    if not db:
        print("Databank is empty!")
        return
        
    index_rows = db.get("sheet_diary_index", {}).get("content", [])
    detail_rows = db.get("sheet_diary_detail", {}).get("content", [])
    
    if len(index_rows) <= 1 or len(detail_rows) <= 1:
        print("No diaries found in databank.")
        return
        
    daily_dir = get_file_path("daily_history")
    os.makedirs(daily_dir, exist_ok=True)
    
    char_id = get_active_character_id()
    
    # map row_id to content
    detail_map = {}
    for row in detail_rows[1:]:
        if len(row) >= 3:
            diary_id = row[1]
            content = row[2]
            detail_map[diary_id] = content
            
    restored_count = 0
    for row in index_rows[1:]:
        if len(row) >= 3:
            diary_id = row[1]
            date_str = row[2]
            
            content = detail_map.get(diary_id, "")
            if not content:
                continue
                
            # Create chat_log placeholder
            chat_log_path = os.path.join(daily_dir, f"chat_log_{date_str}.txt")
            if not os.path.exists(chat_log_path):
                with open(chat_log_path, "w", encoding="utf-8") as f:
                    f.write("[系统提示：此日期的详细聊天记录气泡已在架构升级清洗时被粉碎销毁，但莉格露提炼的核心回忆已被保留在右侧日记中。]")
                    
            # Create diary file
            diary_path = os.path.join(daily_dir, f"{char_id}_diary_{date_str}.txt")
            with open(diary_path, "w", encoding="utf-8") as f:
                f.write(content)
                
            restored_count += 1
            
    print(f"Successfully restored {restored_count} diaries to dashboard!")

if __name__ == "__main__":
    restore_daily()
