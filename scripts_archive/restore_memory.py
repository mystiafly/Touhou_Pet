import sys
import os
import json
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), "services"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from core.memory_manager import get_memory_agent
from core.databank_manager import load_databank

def restore_memory():
    db = load_databank()
    if not db:
        print("Databank is empty!")
        return
        
    diaries = db.get("sheet_diary_detail", {}).get("content", [])
    if len(diaries) > 1:
        diaries = diaries[1:] # skip header
    else:
        diaries = []
    
    mem_agent = get_memory_agent()
    
    restored_count = 0
    for row in diaries:
        if len(row) >= 4:
            content = row[2]
            title = row[3]
            print(f"Restoring memory: {title}")
            text_to_add = f"这是过去的日记记忆，请牢记：\n标题：{title}\n内容：{content}"
            mem_agent.add(text_to_add, user_id="user")
            restored_count += 1
            
    print(f"Successfully restored {restored_count} memories to Qdrant vector DB!")

if __name__ == "__main__":
    restore_memory()
