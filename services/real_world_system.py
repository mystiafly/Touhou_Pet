# services/real_world_system.py - 现实元环境系统
from datetime import datetime

def get_meta_context_for_chat(char_id: str = "rumia", char_name: str = "角色"):
    """
    获取日常对话的现实元环境上下文（包括当前精确时间、日期以及特殊时段的重点引导提示）。
    本文件设计为未来天气、新闻等现实世界元数据的统一编辑与获取入口。
    """
    now = datetime.now()
    time_str = now.strftime("%H:%M")
    date_str = now.strftime("%Y-%m-%d")
    weekday_map = {0: "星期一", 1: "星期二", 2: "星期三", 3: "星期四", 4: "星期五", 5: "星期六", 6: "星期日"}
    weekday_str = weekday_map.get(now.weekday(), "")
    
    hour = now.hour
    month = now.month
    
    # 基础现实世界背景信息（供大模型作为常识背景感知）
    base_info = f"【当前现实世界时间】：{date_str} {weekday_str} {time_str}。\n"
    
    if char_id == "cirno" and (month >= 11 or month <= 3):
        # 琪露诺：季节模式（冬季 11月-3月）
        winter_prompt = (
            f"{base_info}"
            "【重点任务提示 - 季节模式开启（冬季）】\n"
            f"⚠️ 当前现实世界正处于冬季（11月至3月），这是身为冰之妖精的你（{char_name}）最活跃、最喜欢的主场环境！\n"
            "- 请将“冬天/寒冷/冰雪”作为本次对话的重点背景和切入点：你可以用自豪、兴奋的语气向用户炫耀现在的天气，或者调侃用户是不是怕冷。\n"
            "- 强化你作为冰之妖精的特征，利用冬季环境营造出符合你天才（笨蛋）设定的互动氛围。"
        )
        return winter_prompt
        
    elif char_id == "rumia" and (hour >= 23 or hour < 6):
        # 深夜模式（23:00 - 06:00）
        midnight_prompt = (
            f"{base_info}"
            "【重点任务提示 - 深夜模式开启】\n"
            f"⚠️ 当前时间处于深夜至凌晨时段（23:00 - 06:00），这是身为黑夜妖怪的你（{char_name}）最活跃的主场环境！\n"
            "- 请将“深夜”作为本次对话的重点背景和切入点：你可以用更亲密、调侃、神秘或傲娇的语气，对用户这么晚还不睡觉表示好奇、责备或关心（例如催促他去睡觉，或表现出你想用黑暗陪他的意图）。\n"
            "- 强化你的妖怪设定，利用深夜环境营造出独特的互动氛围。"
        )
        return midnight_prompt

    else:
        # 普通时段/普通季节（仅作为背景知识，不强求围绕）
        normal_prompt = (
            f"{base_info}"
            "（注：上述时间仅作为你的现实世界常识背景。除非当前对话主题与时间、季节或作息显式相关，否则无需刻意围绕时间展开话题，保持正常自然的交流即可。）"
        )
        return normal_prompt
