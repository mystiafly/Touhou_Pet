import os
import re
from typing import Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from graph.state import AgentState
from core.memory_manager import get_memory_agent, trim_history, save_history
from core.profile_manager import update_favorability, get_user_profile
from core.config_manager import get_config, get_active_character_id
from core.llm_client import get_langchain_model
from tools.presets_manager import load_and_trigger_presets
from core.databank_manager import get_active_tables, get_databank_rules_for_llm, parse_and_execute_databank_commands
from tools.tool_executor import parse_reply

from time_system import get_time_greeting_prompt
from real_world_system import get_meta_context_for_chat

def recall_memories_node(state: AgentState) -> Dict[str, Any]:
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    is_self = state.get("is_self_talk", False)
    recalled = ""
    if not is_self and user_msg:
        dialogue_msgs = [msg for msg in history if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-6:]
        
        query_parts = []
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "用户", "assistant": char_name}
        for msg in recent_msgs:
            query_parts.append(f"{role_map.get(msg['role'], msg['role'])}: {msg['content']}")
        query_parts.append(f"用户: {user_msg}")
        compiled_query = "\n".join(query_parts)
        
        agent = get_memory_agent()
        if agent:
            try:
                results = agent.search(compiled_query, filters={"user_id": "player_01"}, limit=3, threshold=0.45)
                results_list = results.get("results", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])
                if results_list:
                    recalled = "\n".join([f"- {r['memory']}" for r in results_list if isinstance(r, dict) and 'memory' in r])
            except Exception as me:
                pass
    return {"recalled_memories": recalled}

def load_presets_node(state: AgentState) -> Dict[str, Any]:
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    current_fav = state.get("favorability", 10)
    is_self = state.get("is_self_talk", False)
    
    if not is_self and user_msg:
        dialogue_msgs = [msg for msg in history if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-2:]
        
        query_parts = []
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "用户", "assistant": char_name}
        for msg in recent_msgs:
            query_parts.append(f"{role_map.get(msg['role'], msg['role'])}: {msg['content']}")
        query_parts.append(f"用户: {user_msg}")
        compiled_query = "\n".join(query_parts)
        
        presets = load_and_trigger_presets(compiled_query, current_fav, is_self_talk=is_self)
    else:
        presets = load_and_trigger_presets(user_msg, current_fav, is_self_talk=is_self)
        
    return {"custom_presets": presets}

def build_pre_messages(state: AgentState) -> list:
    config_data = get_config()
    history_msgs = state.get("history", [])
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)

    if is_self:
        return []

    app_launcher = config_data.get("app_launcher", {})
    available_apps_str = ", ".join(app_launcher.keys()) if app_launcher else "（尚未配置任何本地应用启动项）"

    system_prompt = (
        "[PRE-LLM TASK: INTENT RECOGNITION AND TOOL CALLING]\n"
        "你是系统的前置意图识别节点。你的任务是阅读用户的最新输入以及少量的历史上下文，判断用户是否需要调用任何系统工具。\n\n"
        "【可用工具与语法】\n"
        f"1. 启动应用: 当前系统支持启动的应用有: {available_apps_str}。如果用户明确要求打开这些应用，你必须输出 `[LAUNCH_APP: 应用名称]`。\n"
        "2. 网页搜索/浏览器: 如果用户有搜索网页、查资料、看新闻等意图，输出 `[BROWSER_TASK: 搜索关键词]` 或 `[SEARCH_ENGINE: 搜索词]` (不弹窗只在后台查)。\n"
        "3. 播放音乐: 如果用户想听歌、放音乐、点歌，输出 `[MUSIC_PLAY: 歌曲名称 歌手名(可选)]`。\n"
        "4. 更改称呼: 如果用户要求改变你对他的称呼，输出 `[UPDATE_USER_NAME: 新称呼]`。\n"
        "5. 更改自己的名字: 如果用户要求你改名，输出 `[UPDATE_PET_NAME: 新名字]`。\n\n"
        "【规则】\n"
        "1. 如果检测到工具意图，请仅输出上述的一个或多个标签，不需要任何多余解释！绝对禁止进行角色扮演！\n"
        "2. 如果未检测到任何需要工具协助的意图，请仅输出 `[NO_TOOLS_NEEDED]`。\n"
    )

    messages = [SystemMessage(content=system_prompt)]
    
    # Add recent history (last 2 messages)
    recent = history_msgs[-2:] if len(history_msgs) >= 2 else history_msgs
    for msg in recent:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))

    messages.append(HumanMessage(content=f"用户的最新输入: {user_message}\n请输出标签或 [NO_TOOLS_NEEDED]。"))
    return messages

def build_main_messages(state: AgentState) -> list:
    char_id = get_active_character_id()
    config_data = get_config()
    char_name = config_data.get("character_name", "桌宠")
    persona_prompt = config_data.get("persona_prompt", "你是一个桌面宠物，请根据用户的喜好与他们进行交流。")
    user_prompt = config_data.get("user_prompt", "").strip()

    history_msgs = state.get("history", [])
    current_fav = state.get("favorability", 10)
    recalled_memories = state.get("recalled_memories", "")
    custom_presets = state.get("custom_presets", "")
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)
    is_greeting = state.get("request_type") == 'greeting'

    cat1_parts = []
    if user_prompt:
        cat1_parts.append(f"[USER PROMPT (用户/玩家自身设定与偏好)]\n{user_prompt}")
        
    base_rules = (
        "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\n"
        "【最高优先级提醒与行为约束（基础静态规则）】\n"
        f"1. 角色约束与动作描写：请严格扮演{char_name}（{persona_prompt}），用中文回答。在对话中建议穿插用圆括号包裹的动作/表情描述（如：‘(脸红扭过头)’）。如果下方的【触发预设】有更细致的格式与描述要求，请一并严格执行。\n"
        "2. 格式约束：你的回复必须且只能遵循 '[心情][评分]对话内容' 格式要求。\n"
        "   - '[心情]' 必须且只能是以下英文单词之一：[normal], [angry], [shy], [crying]。\n"
        "   - '[评分]' 必须且只能是方括号内包裹一个 0 到 20 之间的纯数字评分（如 [12]），代表当前言论的好感度评分（10为基准，>10加分，<10扣分）。\n"
        "   - 示例：'[normal][12]哼，笨蛋！(双手叉腰)'\n\n"
    )
    if is_self:
        base_rules += "3. 注意事项：目前只是你在自言自语主动搭话，绝对不要扮演用户或者假装用户对你说了什么！\n"
        
    cat1_parts.append(base_rules)
    system_prompt_top = "\n\n=======================================================================\n\n".join(cat1_parts)

    lc_history = []
    for msg in history_msgs:
        if msg["role"] == "system":
            lc_history.append(SystemMessage(content=msg["content"]))
        elif msg["role"] == "user":
            lc_history.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_history.append(AIMessage(content=msg["content"]))
            
    active_messages = []
    if lc_history and isinstance(lc_history[0], SystemMessage):
        active_messages = [SystemMessage(content=system_prompt_top)] + (lc_history[1:] if not is_greeting else [])
    else:
        active_messages = [SystemMessage(content=system_prompt_top)] + (lc_history if not is_greeting else [])

    tail_parts = []
    profile = get_user_profile()
    user_name = profile.get("user_called_as", "")
    pet_name = profile.get(f"{char_id}_called_as", "")
    meta_context = get_meta_context_for_chat(char_id, char_name)
    
    time_gap_str = ""
    if not is_self:
        import time
        last_user_time = None
        for msg in reversed(history_msgs):
            if msg.get("role") == "user" and "timestamp" in msg:
                last_user_time = msg.get("timestamp")
                break
        
        if last_user_time:
            diff_seconds = time.time() - float(last_user_time)
            if diff_seconds > 30 * 60:
                diff_minutes = int(diff_seconds // 60)
                if diff_minutes >= 60:
                    time_gap_str = f"\n- ⚠️ 注意：用户隔了 {diff_minutes // 60} 小时 {diff_minutes % 60} 分钟 后才再次和你说话！"
                else:
                    time_gap_str = f"\n- ⚠️ 注意：用户隔了 {diff_minutes} 分钟 后才再次和你说话！"

    state_str = (
        f"[SYSTEM INJECTION: 当前状态]\n"
        f"{meta_context}\n"
        f"- 当前你（{char_name}）对用户的好感度为: {current_fav}/100。\n"
        f"- 称呼设定：用户当前名字是【{user_name}】，你的名字目前是【{pet_name}】。"
        f"{time_gap_str}"
    )
    tail_parts.append(state_str)
    
    if recalled_memories:
        tail_parts.append(f"[SYSTEM INJECTION: 唤醒的长期记忆]\n{recalled_memories}\n（注：仅在当前对话主题与这些记忆相关时，才自然提及。）")
        
    tool_feedback = state.get("tool_feedback_context", "")
    if tool_feedback:
        tail_parts.append(f"[SYSTEM INJECTION: 动作与工具执行反馈]\n刚才系统已经帮你执行了后台动作，反馈如下：\n{tool_feedback}\n请你结合此反馈，以角色的口吻自然地回复用户。")
        
    if custom_presets:
        preset_content = []
        if isinstance(custom_presets, list):
            sorted_presets = sorted(custom_presets, key=lambda x: x.get("order", 100))
            for p in sorted_presets:
                if p.get("content", p.get("prompt", "")):
                    preset_content.append(p.get("content", p.get("prompt", "")))
        else:
            preset_content.append(str(custom_presets))
            
        if preset_content:
            tail_parts.append(f"[SYSTEM INJECTION: 触发预设]\n⚠️ 请在你的本次回复中，结合以下设定：\n" + "\n\n".join(preset_content))

    tail_block = "\n\n=======================================================================\n\n".join(tail_parts)
    
    if is_self:
        content = "[SELF TALK TRIGGER: 此刻你正在自言自语，请主动寻找话题发散。]\n\n"
        if user_message:
            content += f"[闲置状态提示: {user_message}]\n\n"
        content += tail_block
        content += "\n\n(请严格遵守 '[心情][评分]对白内容' 的回复格式！)"
        active_messages.append(HumanMessage(content=content))
    else:
        content = user_message + "\n\n" + tail_block
        content += "\n\n(请严格遵守 '[心情][评分]对白内容' 的回复格式！)"
        active_messages.append(HumanMessage(content=content))

    return active_messages

def build_post_messages(state: AgentState) -> list:
    databank_rules = get_databank_rules_for_llm()
    if not databank_rules:
        return []

    system_prompt = (
        "[POST-LLM TASK: DATABANK UPDATER]\n"
        "你负责在后台异步更新系统的 DataBank。阅读刚才发生的用户和桌宠之间的对话，判断是否有新信息需要更新到数据库表格中。\n\n"
        f"{databank_rules}\n\n"
        "【规则】\n"
        "1. 如果需要更新，请输出包含 ```databank 的代码块，按照规则指定的格式进行更新。\n"
        "2. 如果不需要更新任何表格，请仅输出 `[NO_UPDATE]`。不需要任何多余解释！绝对禁止扮演！\n"
    )

    history_msgs = state.get("history", [])
    active_tables = get_active_tables(state.get("user_message", ""), current_pool="\n".join([msg.get("content", "") for msg in history_msgs[-4:]]))
    if active_tables:
        system_prompt += f"\n[当前数据库中部分表格的内容状态参考]\n{active_tables}"

    messages = [SystemMessage(content=system_prompt)]
    
    user_msg = state.get("user_message", "")
    ai_reply = state.get("main_llm_reply", "")
    
    chat_context = f"刚才的对话记录：\n用户: {user_msg}\n桌宠回复: {ai_reply}"
    messages.append(HumanMessage(content=chat_context))

    return messages

def call_model_with_fallback(active_messages, provider_override, node_name="LLM"):
    print(f"\n{'='*20} [{node_name}] 发送给大模型的上下文 {'='*20}")
    for m in active_messages:
        content_preview = m.content[:1000] + "..." if len(m.content) > 1000 else m.content
        print(f"[{m.type.upper()}]:\n{content_preview}\n")
    print("="*60 + "\n")

    model = get_langchain_model(provider_override=provider_override)
    try:
        response = model.invoke(active_messages)
        print(f"\n[{node_name}] 大模型返回结果:\n{response.content}\n" + "="*60)
        return response
    except Exception as primary_ex:
        print(f"[BACKEND WARNING] 模型调用异常: {primary_ex}")
        from langchain_openai import ChatOpenAI
        config_data = get_config()
        current_provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
        fallback_provider = "gemini" if "deepseek" in current_provider else "deepseek-v4-pro"
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        fallback_model = None
        if fallback_provider == "gemini" and gemini_key:
            fallback_model = ChatOpenAI(api_key=gemini_key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/", model="gemini-2.5-flash", temperature=0.7)
        elif "deepseek" in fallback_provider and deepseek_key:
            fallback_model = ChatOpenAI(api_key=deepseek_key, base_url="https://api.deepseek.com", model="deepseek-v4-pro", temperature=0.7)
        if fallback_model:
            response = fallback_model.invoke(active_messages)
            print(f"\n[{node_name}] (Fallback) 大模型返回结果:\n{response.content}\n" + "="*60)
            return response
        else:
            raise primary_ex

def pre_llm_node(state: AgentState) -> Dict[str, Any]:
    active_messages = build_pre_messages(state)
    if not active_messages:
        return {"pre_llm_reply": "[NO_TOOLS_NEEDED]"}
    
    response = call_model_with_fallback(active_messages, provider_override=get_config().get("pre_api_provider", "inherit"), node_name="PRE-LLM")
    return {"pre_llm_reply": response.content}

def parse_pre_response_node(state: AgentState) -> Dict[str, Any]:
    raw_reply = state.get("pre_llm_reply", "")
    
    browser_task = None
    task_match = re.search(r'\[BROWSER_TASK:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if task_match: browser_task = task_match.group(1).strip()
        
    search_task = None
    search_match = re.search(r'\[SEARCH_ENGINE:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if search_match: search_task = search_match.group(1).strip()
        
    music_task = None
    music_match = re.search(r'\[MUSIC_PLAY:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if music_match: music_task = music_match.group(1).strip()
        
    launcher_task = None
    launcher_match = re.search(r'\[LAUNCH_APP:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if launcher_match: launcher_task = launcher_match.group(1).strip()
        
    rename_task_user = None
    user_name_match = re.search(r'\[UPDATE_USER_NAME:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if user_name_match: rename_task_user = user_name_match.group(1).strip()
        
    rename_task_pet = None
    pet_name_match = re.search(r'\[UPDATE_PET_NAME:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if pet_name_match: rename_task_pet = pet_name_match.group(1).strip()
        
    return {
        "browser_task": browser_task,
        "search_task": search_task,
        "music_task": music_task,
        "launcher_task": launcher_task,
        "rename_task_user": rename_task_user,
        "rename_task_pet": rename_task_pet
    }

def collect_tool_feedback_node(state: AgentState) -> Dict[str, Any]:
    tool_feedback = []
    if state.get("music_result"):
        res = state.get("music_result")
        if "error" in res: tool_feedback.append(f"点歌检索失败：{res['error']}。")
        else: tool_feedback.append(f"点歌检索成功：已播放歌曲：《{res['name']}》（歌手: {res['artists']}）。")
    if state.get("browser_result"): tool_feedback.append(f"网页反馈：\n{state['browser_result']}")
    if state.get("search_result"): tool_feedback.append(f"搜索反馈：\n{state['search_result']}")
    if state.get("launcher_result"): tool_feedback.append(f"应用启动反馈：\n{state['launcher_result']}")
    if state.get("rename_result"): tool_feedback.append(f"改名反馈：\n{state['rename_result']}")
    
    return {"tool_feedback_context": "\n".join(tool_feedback) if tool_feedback else ""}

def main_llm_node(state: AgentState) -> Dict[str, Any]:
    active_messages = build_main_messages(state)
    
    response = call_model_with_fallback(active_messages, provider_override=get_config().get("api_provider", "inherit"), node_name="MAIN-LLM")
    
    raw_reply = response.content
    emotion, score, clean_content = parse_reply(raw_reply)
    
    return {
        "main_llm_reply": raw_reply,
        "raw_reply": raw_reply, # for compatibility with old graph state outputs if needed
        "emotion": emotion,
        "score": score,
        "clean_content": clean_content
    }

def post_llm_node(state: AgentState) -> Dict[str, Any]:
    messages = build_post_messages(state)
    if not messages:
        return {"post_llm_reply": "[NO_UPDATE]"}
        
    active_messages = messages
    response = call_model_with_fallback(active_messages, provider_override=get_config().get("post_api_provider", "inherit"), node_name="POST-LLM")
    raw_reply = response.content
    
    # 解析并执行 DataBank 修改指令
    parse_and_execute_databank_commands(raw_reply)
    
    return {"post_llm_reply": raw_reply}

def update_history_node(state: AgentState) -> Dict[str, Any]:
    history_msgs = state.get("history", [])
    raw_reply = state.get("main_llm_reply", "")
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)
    score = state.get("score", 10)
    
    change = 0
    if score > 15: change = 1
    elif score < 5: change = -1
        
    new_fav = update_favorability(change)
    new_history = [msg.copy() for msg in history_msgs]
    
    if not is_self and user_message:
        import time
        new_history.append({"role": "user", "content": user_message, "timestamp": time.time()})
        
    if is_self and len(new_history) > 0:
        last_msg = new_history[-1]
        if last_msg.get("role") == "assistant" and last_msg.get("is_self_talk") is True:
            new_history.pop()

    new_history.append({"role": "assistant", "content": raw_reply, "is_self_talk": is_self})
    new_history = trim_history(new_history)
    save_history(new_history)
    
    return {
        "history": new_history,
        "favorability": new_fav
    }

def should_execute_tools(state: AgentState) -> str:
    if (state.get("rename_task_user") is not None or state.get("rename_task_pet") is not None) and state.get("rename_result") is None:
        return "execute_rename_task"
    if state.get("music_task") and state.get("music_result") is None:
        return "execute_music_task"
    if state.get("browser_task") and state.get("browser_result") is None:
        return "execute_browser_task"
    if state.get("search_task") and state.get("search_result") is None:
        return "execute_search_task"
    if state.get("launcher_task") and state.get("launcher_result") is None:
        return "execute_launcher_task"
    return "collect_tool_feedback"
