# services/real_world_system.py - 现实元环境系统
from datetime import datetime

def get_meta_context_for_chat():
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
    
    # 基础现实世界背景信息（供大模型作为常识背景感知）
    base_info = f"【当前现实世界时间】：{date_str} {weekday_str} {time_str}。\n"
    
    # 23:00 至 次日 06:00 期间：深夜模式（抬升为重点对话内容）
    if hour >= 23 or hour < 6:
        midnight_prompt = (
            f"{base_info}"
            "【重点任务提示 - 深夜模式开启】\n"
            "⚠️ 当前时间处于深夜至凌晨时段（23:00 - 06:00），这是身为黑夜妖怪的你（露米娅）最活跃、魔力最强的主场环境！\n"
            "- 请将“深夜”作为本次对话的重点背景和切入点：你可以用更亲密、调侃、神秘或傲娇的语气，对用户这么晚还不睡觉表示好奇、责备或关心（例如催促他去睡觉，或傲娇地表示‘既然你还不睡，那就用黑暗陪你到天亮吧’）。\n"
            "- 强化你作为黑夜主宰的傲娇特征，利用黑夜和温暖黑暗的设定来营造神秘、温馨而又带有一点点恶作剧的深夜氛围。"
        )
        return midnight_prompt
    else:
        # 06:00 至 23:00 期间：普通时段（仅作为背景知识，不强求围绕）
        normal_prompt = (
            f"{base_info}"
            "（注：上述时间仅作为你的现实世界常识背景。除非当前对话主题与时间、熬夜或作息显式相关，否则无需刻意围绕时间展开话题，保持正常自然的交流即可。）"
        )
        return normal_prompt
