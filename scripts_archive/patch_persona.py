import re
import os

SERVICES_DIR = r"g:\code\rumia\services"
WEB_INTERFACE_PATH = os.path.join(SERVICES_DIR, "web_interface.py")

with open(WEB_INTERFACE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update load_history
pattern1 = r'system_prompt = \(\s*f"你是东方Project中的露米娅，一个喜欢在黑暗中恶作剧的食人妖怪。你目前对用户的好感度是 \{current_fav\}/100。\\n"'
replacement1 = """config_data = get_config()
    char_name = config_data.get("character_name", "露米娅")
    persona_prompt = config_data.get("persona_prompt", "你是东方Project中的露米娅，一个喜欢在黑暗中恶作剧的食人妖怪。性格傲娇。")
    system_prompt = (
        f"{persona_prompt} 你目前对用户的好感度是 {current_fav}/100。\\n" """
content = re.sub(pattern1, replacement1, content)

# 2. Update generate_response_node (Self talk)
pattern2 = r'"1\. 角色约束与动作描写：请严格扮演露米娅（性格傲娇的食人妖怪），用中文回答。'
replacement2 = f'f"1. 角色约束与动作描写：请严格扮演{{config_data.get(\'character_name\', \'露米娅\')}}（{{config_data.get(\'persona_prompt\', \'性格傲娇\')}}），用中文回答。'
content = content.replace('"1. 角色约束与动作描写：请严格扮演露米娅（性格傲娇的食人妖怪），用中文回答。', 'f"1. 角色约束与动作描写：请严格扮演{config_data.get(\'character_name\', \'露米娅\')}，用中文回答。')

# We need to make sure config_data is available in self-talk branch
# Currently it's loaded in the normal branch, let's load it at the top of generate_response_node
pattern3 = r'def generate_response_node\(state: AgentState\) -> Dict\[str, Any\]:\n    """装配前置静态与后置动态 Prompt，调用大模型生成回复"""'
replacement3 = """def generate_response_node(state: AgentState) -> Dict[str, Any]:
    \"\"\"装配前置静态与后置动态 Prompt，调用大模型生成回复\"\"\"
    config_data = get_config()"""
content = content.replace(
    'def generate_response_node(state: AgentState) -> Dict[str, Any]:\n    """装配前置静态与后置动态 Prompt，调用大模型生成回复"""',
    'def generate_response_node(state: AgentState) -> Dict[str, Any]:\n    """装配前置静态与后置动态 Prompt，调用大模型生成回复"""\n    config_data = get_config()'
)

# Also remove config_data = get_config() from the normal branch to avoid re-assignment
content = content.replace('        config_data = get_config()\n        app_launcher = config_data.get("app_launcher", {})', '        app_launcher = config_data.get("app_launcher", {})')

# Update priority_reminder format strings
# Since they use f-strings now for line 1, we must replace the whole assignment
# In self-talk:
content = content.replace(
    '        priority_reminder = (\n            "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\\n"\n            "【最高优先级提醒与行为约束（基础静态规则）】\\n"\n            f"1. 角色约束与动作描写：请严格扮演{config_data.get(\'character_name\', \'露米娅\')}，用中文回答',
    '        priority_reminder = (\n            "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\\n"\n            "【最高优先级提醒与行为约束（基础静态规则）】\\n"\n            f"1. 角色约束与动作描写：请严格扮演{config_data.get(\'character_name\', \'露米娅\')}（{config_data.get(\'persona_prompt\', \'性格傲娇\')}），用中文回答'
)

# Fix variables
content = content.replace('你的名字目前是【{rumia_name}】（空代表露米娅）', '你的名字目前是【{rumia_name}】（空代表{config_data.get("character_name", "露米娅")}）')

with open(WEB_INTERFACE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Persona patching complete.")
