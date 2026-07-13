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

def get_time_greeting_prompt(char_name: str = "角色"):
    """
    生成基于时间的打招呼 Prompt（系统提示词）
    """
    stage, stage_name = get_current_time_stage()
    now_str = datetime.now().strftime("%H:%M")

    # 基础信息
    base_prompt = f"（现在是现实世界的{stage_name}，具体时间是{now_str}。"

    if stage == "morning":
        return base_prompt + "太阳刚刚升起，如果是早起的性格可以元气满满地打招呼；如果是夜行性或爱赖床的性格，请表现出慵懒或没睡醒的样子。）"

    elif stage in ["forenoon", "afternoon"]:
        return base_prompt + f"现在是白天。请根据{char_name}的性格，自然地向用户打招呼，可以聊聊白天的日常。）"

    elif stage == "noon":
        return base_prompt + f"是午饭时间了。请根据{char_name}的设定，和用户聊聊午饭，或者撒娇要吃的。）"

    elif stage == "dusk":
        return base_prompt + f"太阳要下山了，逢魔之时。请根据{char_name}的设定，向用户打招呼，分享傍晚的氛围。）"

    elif stage == "night":
        return base_prompt + f"完全天黑了，是晚上。请用符合{char_name}性格的口吻向用户打招呼，可以邀请他一起放松。）"

    elif stage == "midnight":
        return base_prompt + f"这是深夜，万籁俱寂。请用符合{char_name}性格的口吻向还没睡的用户打招呼，可以关心、责备他熬夜，或者带着神秘感互动。）"

    return base_prompt + "请向用户打招呼。）"

# 预留接口：未来如果对话也要感知时间，可以调用这个
def get_time_context_for_chat(char_name: str = "角色"):
    stage, stage_name = get_current_time_stage()
    return f"（当前环境：{stage_name}）"
