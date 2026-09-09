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

def update_favorability(change, char_id=None, force=False):
    """更新好感度，严格受好感度下限保底与剧情暂停机制保护"""
    current = get_favorability()
    
    try:
        from core.scenario_manager import get_favorability_floor, load_scenario_state
        # 检查当前剧情节点是否处于好感度冻结期
        if not force:
            s_state = load_scenario_state(char_id)
            if s_state.get("is_paused", False) and s_state.get("active_node_id"):
                return current
        
        floor = get_favorability_floor(char_id)
    except Exception as se:
        floor = 0

    new_score = current + change
    new_score = max(floor, min(100, new_score))
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
