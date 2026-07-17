import os
import json
from core.config_manager import get_file_path

def get_favorability():
    """获取好感度，默认60"""
    if os.path.exists(get_file_path("favorability.json")):
        try:
            with open(get_file_path("favorability.json"), 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('score', 60)
        except:
            pass
    return 60

def update_favorability(change):
    """更新好感度"""
    current = get_favorability()
    new_score = current + change
    new_score = max(0, min(100, new_score))
    try:
        with open(get_file_path("favorability.json"), 'w', encoding='utf-8') as f:
            json.dump({"score": new_score}, f)
    except Exception as e:
        print(f"保存好感度失败: {e}")
    return new_score

def get_user_profile():
    """获取用户与当前角色的专属称呼档案"""
    if os.path.exists(get_file_path("user_profile.json")):
        try:
            with open(get_file_path("user_profile.json"), 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"user_called_as": ""}

def update_user_profile_key(key: str, value: str):
    """更新称呼档案中的某个键值"""
    profile = get_user_profile()
    profile[key] = value
    try:
        with open(get_file_path("user_profile.json"), 'w', encoding='utf-8') as f:
            json.dump(profile, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存专属称呼档案失败: {e}")
    return profile
