# services/time_system.py
from datetime import datetime

def get_current_time_stage():
    """
    根据当前小时返回时间段代码和中文名称
    """
    hour = datetime.now().hour

    if 5 <= hour < 9:
        return "morning", "清晨"
    elif 9 <= hour < 12:
        return "forenoon", "上午"
    elif 12 <= hour < 14:
        return "noon", "中午"
    elif 14 <= hour < 17:
        return "afternoon", "下午"
    elif 17 <= hour < 19:
        return "dusk", "黄昏"
    elif 19 <= hour < 23:
        return "night", "晚上"
    else: # 23点到5点
        return "midnight", "深夜"

def get_time_greeting_prompt():
    """
    生成基于时间的打招呼 Prompt（系统提示词）
    """
    stage, stage_name = get_current_time_stage()
    now_str = datetime.now().strftime("%H:%M")

    # 基础信息
    base_prompt = f"（现在是现实世界的{stage_name}，具体时间是{now_str}。"

    # === 露米娅的时间观 ===
    # 她是黑暗妖怪，白天困/讨厌阳光，晚上兴奋/活跃，中午/傍晚饿

    if stage == "morning":
        return base_prompt + "太阳刚刚升起，光线很刺眼。你刚睡醒，或者准备去睡觉（因为你是夜行性妖怪）。请用[shy]或[normal]的心情，表现出慵懒、怕光或者没睡醒的样子向用户打招呼。）"

    elif stage in ["forenoon", "afternoon"]:
        return base_prompt + "现在是大白天，到处都是讨厌的阳光。你只能躲在阴影里。请用[normal]或[angry]的心情，抱怨阳光太强，或者撒娇让用户帮你挡光。）"

    elif stage == "noon":
        return base_prompt + "是午饭时间了。你的肚子饿得咕咕叫。请用[angry]或[normal]的心情，强烈要求用户提供人类作为午餐，或者撒娇要吃的。）"

    elif stage == "dusk":
        return base_prompt + "太阳终于要下山了，逢魔之时。你开始变得精神起来了。请用[normal]的心情，表现出对即将到来的夜晚的期待。）"

    elif stage == "night":
        return base_prompt + "完全天黑了，这是你的主场！你感觉浑身充满了力量。请用[normal]或[angry]（恶作剧）的心情，兴奋地向用户打招呼，邀请他一起去夜游。）"

    elif stage == "midnight":
        return base_prompt + "这是深夜，万籁俱寂。你正潜伏在黑暗中。请用[normal]或[shy]的心情，用略带吓人或神秘的口吻向还没睡的用户打招呼。）"

    return base_prompt + "请向用户打招呼。）"

# 预留接口：未来如果对话也要感知时间，可以调用这个
def get_time_context_for_chat():
    stage, stage_name = get_current_time_stage()
    return f"（当前环境：{stage_name}）"
