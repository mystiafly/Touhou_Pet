# services/real_world_system.py - 现实元环境系统
import os
import json
from datetime import datetime
from core.config_manager import get_file_path

def evaluate_env_condition(condition: dict, now: datetime) -> bool:
    cond_type = condition.get("type")
    if cond_type == "time":
        start_h = condition.get("start_hour", 0)
        end_h = condition.get("end_hour", 24)
        hour = now.hour
        # Handle overnight ranges like 23 to 6
        if start_h > end_h:
            return hour >= start_h or hour < end_h
        else:
            return start_h <= hour < end_h
            
    elif cond_type == "season":
        start_m = condition.get("start_month", 1)
        end_m = condition.get("end_month", 12)
        month = now.month
        # Handle wrap-around ranges like Nov to Mar
        if start_m > end_m:
            return month >= start_m or month <= end_m
        else:
            return start_m <= month <= end_m
            
    return False

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
    
    # 基础现实世界背景信息（供大模型作为常识背景感知）
    base_info = f"【当前现实世界时间】：{date_str} {weekday_str} {time_str}。\n"
    
    # 尝试加载当前角色的专属环境触发词
    env_presets_file = get_file_path("presets/env_presets.json")
    triggered_prompts = []
    
    if os.path.exists(env_presets_file):
        try:
            with open(env_presets_file, 'r', encoding='utf-8') as f:
                presets = json.load(f)
                
            if isinstance(presets, list):
                for preset in presets:
                    condition = preset.get("condition", {})
                    if evaluate_env_condition(condition, now):
                        triggered_prompts.append(preset.get("prompt", ""))
        except Exception as e:
            print(f"[ENV_PRESETS ERROR] Failed to load {env_presets_file}: {e}")

    if triggered_prompts:
        return base_info + "\n".join(triggered_prompts)
    else:
        # 普通时段/普通季节（仅作为背景知识，不强求围绕）
        return (
            base_info +
            "（注：上述时间仅作为你的现实世界常识背景。除非当前对话主题与时间、季节或作息显式相关，否则无需刻意围绕时间展开话题，保持正常自然的交流即可。）"
        )
