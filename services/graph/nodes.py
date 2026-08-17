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
from tools.tool_executor import parse_reply, extract_character_thought

from time_system import get_time_greeting_prompt
from real_world_system import get_meta_context_for_chat

def recall_memories_node(state: AgentState) -> Dict[str, Any]:
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    is_self = state.get("is_self_talk", False)
    recalled = []
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
                # 降低匹配门槛并允许双重模糊召回，确保中文短文本能稳定召回记忆
                results = agent.search(compiled_query, filters={"user_id": "player_01"}, limit=5, threshold=0.15)
                results_list = results.get("results", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])
                if not results_list and user_msg:
                    results = agent.search(user_msg, filters={"user_id": "player_01"}, limit=5, threshold=0.10)
                    results_list = results.get("results", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])

                if results_list:
                    for r in results_list:
                        if isinstance(r, dict) and 'memory' in r:
                            date_meta = r.get("metadata", {}).get("date", "unknown_date") if r.get("metadata") else "unknown_date"
                            recalled.append(f"[ID: {date_meta}] {r['memory']}")
            except Exception as me:
                print(f"[RECALL MEMORY WARN] {me}")
                
    active_tables = get_active_tables(user_msg, current_pool="\n".join([msg.get("content", "") for msg in history[-4:]]))
        
    return {"recalled_memories": recalled, "active_databank": active_tables if active_tables else ""}



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
        "3. 本地应用拉起: 如果用户明确要求打开电脑里的某个软件（如“网易云”、“记事本”等），请先思考这是否可能是他配置过的常用软件缩写。如果确定要打开，输出 `[LAUNCH_APP: 软件名]`。\n"
        "4. 睡眠控制：如果用户明确命令你去睡觉、休息，输出 `[SLEEP_NOW]`。\n"
        "5. 视觉识图: 如果用户要求你看看屏幕上有什么，或者让你识图，输出 `[ANALYZE_SCREEN]`。\n"
        "6. 进程探测: 如果用户问你在忙什么、玩什么游戏，或者让你看看他电脑里开着什么软件，输出 `[READ_PROCESS]`。\n"
        "7. 长期记忆检索: 如果检测到下面的【相关记忆检索结果】中的内容与当前用户的话题有实质性关联（例如提及了过去的某件事、某个约定或情感），你必须输出对应的 `[SELECT_MEMORY: ID]` 来在后续环节调取完整日记。\n\n"
        "【规则】\n"
        "1. 如果检测到工具意图，请仅输出上述的一个或多个标签，不需要任何多余解释！绝对禁止进行角色扮演！\n"
        "2. 如果未检测到任何需要工具协助的意图（且不需要调取长记忆），请仅输出 `[NO_TOOLS_NEEDED]`。\n"
    )

    recalled_memories = state.get("recalled_memories", [])
    if recalled_memories:
        mem_str = "\n\n".join(recalled_memories)
        system_prompt += f"\n\n【相关记忆检索结果】\n以下是系统检索到的可能相关的压缩记忆。请判断其中哪个记忆/ID最符合当前用户输入的情境。\n⚠️ 如果有相关项，你必须且只能输出对应的 `[SELECT_MEMORY: ID]`（不要输出 NO_TOOLS_NEEDED）。\n如果没有相关内容，请完全忽略此检索结果。\n{mem_str}\n"

    messages = [SystemMessage(content=system_prompt)]
    
    # Bundle recent history into a single string to avoid triggering roleplay mode
    recent = history_msgs[-2:] if len(history_msgs) >= 2 else history_msgs
    history_str = ""
    for msg in recent:
        role = "助理" if msg["role"] == "assistant" else "用户"
        history_str += f"{role}: {msg['content']}\n"
        
    human_content = f"【近期对话上下文】\n{history_str}\n\n【用户最新输入】\n{user_message}\n\n请输出意图标签或 [NO_TOOLS_NEEDED]，绝对禁止角色扮演或代入对话！"
    messages.append(HumanMessage(content=human_content))
    return messages

def build_main_messages(state: AgentState) -> list:
    char_id = get_active_character_id()
    config_data = get_config()
    char_name = config_data.get("character_name", "桌宠")
    persona_prompt = config_data.get("persona_prompt", "你是一个桌面宠物，请根据用户的喜好与他们进行交流。")
    user_prompt = config_data.get("user_prompt", "").strip()

    history_msgs = state.get("history", [])
    current_fav = state.get("favorability", 10)
    selected_memory = state.get("selected_memory", "")
    active_databank = state.get("active_databank", "")
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)
    is_greeting = state.get("request_type") == 'greeting'

    # Load presets dynamically here, so it can scan both user message and the selected memory
    trigger_text = f"{user_message}\n{selected_memory}" if selected_memory else user_message
    if not is_self and user_message:
        dialogue_msgs = [msg for msg in history_msgs if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-2:]
        query_parts = []
        role_map = {"user": "用户", "assistant": char_name}
        for msg in recent_msgs:
            query_parts.append(f"{role_map.get(msg['role'], msg['role'])}: {msg['content']}")
        query_parts.append(f"用户: {trigger_text}")
        trigger_text = "\n".join(query_parts)
        
    custom_presets = load_and_trigger_presets(trigger_text, current_fav, is_self_talk=is_self)

    cat1_parts = []
    if user_prompt:
        cat1_parts.append(f"[USER PROMPT (用户/玩家自身设定与偏好)]\n{user_prompt}")
        
    base_rules = (
        "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\n"
        "【最高优先级提醒与行为约束（基础静态规则）】\n"
        f"1. 角色约束与动作描写：请严格扮演{char_name}（{persona_prompt}），用中文回答。在对话中建议穿插用圆括号包裹的动作/表情描述（如：‘(脸红扭过头)’）。如果下方的【触发预设】有更细致的格式与描述要求，请一并严格执行。\n"
        "2. 格式约束：你的最终回复文本必须且只能遵循 '[心情][评分]对话内容' 格式要求。\n"
        "   - 必须在格式化输出前，使用 <character_thought>...</character_thought> 标签包裹你内心的思考、情绪排查与行动计划（即思维链）。\n"
        "   - '[心情]' 必须且只能是以下英文单词之一：[normal], [angry], [shy], [crying]。\n"
        "   - '[评分]' 必须且只能是方括号内包裹一个 0 到 20 之间的纯数字评分（如 [12]），代表当前言论的好感度评分（10为基准，>10加分，<10扣分）。\n"
        "   - 示例：\n"
        "     <character_thought>\n"
        "     （思考过程...）\n"
        "     </character_thought>\n"
        "     [normal][12]哼，笨蛋！(双手叉腰)\n\n"
    )
    if is_self:
        base_rules += "3. 注意事项：目前只是你在自言自语主动搭话，绝对不要扮演用户或者假装用户对你说了什么！\n"
        
    cat1_parts.append(base_rules)
    
    dynamic_presets_list = []
    if custom_presets:
        if isinstance(custom_presets, list):
            sorted_presets = sorted(custom_presets, key=lambda x: x.get("order", 100))
            constant_content = []
            for p in sorted_presets:
                content = p.get("content", p.get("prompt", ""))
                if not content: continue
                if p.get("always_active", False) or p.get("constant", False):
                    constant_content.append(content)
                else:
                    dynamic_presets_list.append(content)
            
            if constant_content:
                cat1_parts.append("[SYSTEM INJECTION: 常驻预设]\n" + "\n\n".join(constant_content))
        else:
            dynamic_presets_list.append(str(custom_presets))
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
                from core.system_inspector import get_active_programs
                bg_programs = get_active_programs()
                if diff_minutes >= 60:
                    time_gap_str = f"\n- ⚠️ 注意：用户隔了 {diff_minutes // 60} 小时 {diff_minutes % 60} 分钟 后才再次和你说话！\n{bg_programs}"
                else:
                    time_gap_str = f"\n- ⚠️ 注意：用户隔了 {diff_minutes} 分钟 后才再次和你说话！\n{bg_programs}"

    state_str = (
        f"[SYSTEM INJECTION: 当前状态]\n"
        f"{meta_context}\n"
        f"- 当前你（{char_name}）对用户的好感度为: {current_fav}/100。\n"
        f"- 称呼设定：用户当前名字是【{user_name}】，你的名字目前是【{pet_name}】。"
        f"{time_gap_str}"
    )
    tail_parts.append(state_str)
    
    if selected_memory:
        tail_parts.append(f"[SYSTEM INJECTION: 唤醒的长期记忆]\n{selected_memory}\n（注：仅在当前对话主题与这些记忆相关时，才自然提及。）")
        
    if active_databank:
        tail_parts.append(f"[SYSTEM INJECTION: DataBank 动态数据库内容]\n{active_databank}")
        
    tool_feedback = state.get("tool_feedback_context", "")
    if tool_feedback:
        tail_parts.append(f"[SYSTEM INJECTION: 动作与工具执行反馈]\n刚才系统已经帮你执行了后台动作，反馈如下：\n{tool_feedback}\n请你结合此反馈，以角色的口吻自然地回复用户。")
        
    if dynamic_presets_list:
        tail_parts.append(f"[SYSTEM INJECTION: 触发预设]\n⚠️ 仅当以下预设内容与当前剧情/对话上下文相关时，才在你的回复中自然地结合或提及它；如果毫无关联，请直接忽略该预设，不要强行提及：\n" + "\n\n".join(dynamic_presets_list))

    tail_block = "\n\n=======================================================================\n\n".join(tail_parts)
    
    final_instruction = (
        "\n\n[SYSTEM TASK - MANDATORY OUTPUT FORMAT]\n"
        "你必须且只能按照以下完全固定的模板进行回复！严禁任何妥协！\n\n"
        "<character_thought>\n"
        "1. 情绪本能：...\n"
        "2. 规则审查（字数必须砍到15-50字以内！绝对不脑补虚构剧情！）：...\n"
        "3. 输出规划：...\n"
        "</character_thought>\n"
        "[心情][评分](极简的动作短语) 极其简短、口语化的一两句话，绝不自导自演。"
    )

    if is_self:
        content = "[SELF TALK TRIGGER: 此刻你正在自言自语，请主动寻找话题发散。]\n\n"
        if user_message:
            content += f"[闲置状态提示: {user_message}]\n\n"
        active_messages.append(HumanMessage(content=content))
    else:
        active_messages.append(HumanMessage(content=user_message))
        
    retry_count = state.get("retry_count") or 0
    if retry_count > 0:
        final_instruction += f"\n\n[SYSTEM WARNING: 你在上一轮回复中遗漏了强制格式 `<character_thought>`！本轮已是第 {retry_count} 次打回重做。请务必使用标签包裹思考，否则将被判定为严重系统错误！]"
        
    # 强制将指令追加到最后一条人类消息中，防止某些模型/API强制把SystemMessage前置导致指令被稀释
    if active_messages and isinstance(active_messages[-1], HumanMessage):
        active_messages[-1].content += f"\n\n[SYSTEM HIDDEN INSTRUCTION]\n{tail_block}\n{final_instruction}"
    else:
        active_messages.append(HumanMessage(content=f"[SYSTEM HIDDEN INSTRUCTION]\n{tail_block}\n{final_instruction}"))

    return active_messages

def build_post_messages(state: AgentState) -> list:
    databank_rules = get_databank_rules_for_llm()
    if not databank_rules:
        return []

    from datetime import datetime
    from time_system import get_current_time_stage
    now = datetime.now()
    now_date_str = now.strftime("%Y-%m-%d %H:%M")
    now_full_date = now.strftime("%Y年%m月%d日 %H:%M")
    weekday_str = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][now.weekday()]
    _, stage_name = get_current_time_stage()

    system_prompt = (
        "[POST-LLM TASK: DATABANK UPDATER]\n"
        "你负责在后台异步更新系统的 DataBank。阅读刚才发生的用户和桌宠之间的对话，判断是否有新信息需要更新到数据库表格中。\n\n"
        f"【当前现实系统精确时间】\n"
        f"- 当前精准时间点: {now_date_str} ({now_full_date} {weekday_str})\n"
        f"- 当前大致时间段: {stage_name}\n"
        "⚠️ 注意：若有表格需要填入 [时间点]、[时间段] 或 [时间]，必须严格参照上方提供的【当前现实系统精确时间】记录，绝对禁止捏造、猜测或使用过期的虚假日期！\n\n"
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
        content_preview = m.content
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
    if get_config().get("flow_mode", False):
        print("\n[PRE-LLM] 心流模式 (Flow Mode) 已开启，跳过 Pre 前置意图识别模型，直达主模型极速对话！\n")
        return {"pre_llm_reply": "[NO_TOOLS_NEEDED]"}

    active_messages = build_pre_messages(state)
    if not active_messages:
        return {"pre_llm_reply": "[NO_TOOLS_NEEDED]"}
    
    response = call_model_with_fallback(active_messages, provider_override=get_config().get("pre_api_provider", "inherit"), node_name="PRE-LLM")
    
    raw_reply = response.content
    reasoning = response.additional_kwargs.get("reasoning_content", "")
    if reasoning:
        raw_reply = f"<think>\n{reasoning}\n</think>\n\n" + raw_reply

    return {"pre_llm_reply": raw_reply}

def parse_pre_response_node(state: AgentState) -> Dict[str, Any]:
    raw_reply = state.get("pre_llm_reply", "")
    
    browser_task = None
    task_match = re.search(r'\[BROWSER_TASK:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if task_match: browser_task = task_match.group(1).strip()
        
    search_task = None
    search_match = re.search(r'\[SEARCH_ENGINE:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if search_match: search_task = search_match.group(1).strip()
        
    launcher_task = None
    launcher_match = re.search(r'\[LAUNCH_APP:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if launcher_match: launcher_task = launcher_match.group(1).strip()
        
    vision_task = None
    vision_match = re.search(r'\[ANALYZE_SCREEN\]', raw_reply, re.IGNORECASE)
    if vision_match: vision_task = "analyze_screen"

    clean_memory_task = None
    clean_memory_match = re.search(r'\[CLEAN_MEMORY\]', raw_reply, re.IGNORECASE)
    if clean_memory_match: clean_memory_task = True
        
    process_task = None
    process_match = re.search(r'\[READ_PROCESS\]', raw_reply, re.IGNORECASE)
    if process_match: process_task = True

    selected_memory = ""
    memory_match = re.search(r'\[SELECT_MEMORY:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if memory_match: 
        memory_task = memory_match.group(1).strip()
        char_id = get_active_character_id()
        diary_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "characters", char_id, "daily_history"
        )
        import glob
        pattern = os.path.join(diary_dir, f"*_diary_{memory_task}.txt")
        matching_files = glob.glob(pattern)
        
        try:
            if matching_files:
                with open(matching_files[0], "r", encoding="utf-8") as f:
                    selected_memory = f.read().strip()
                print(f"[MEMORY SELECT] Successfully read full diary: {matching_files[0]}")
            else:
                print(f"[MEMORY SELECT] full diary for {memory_task} not found in {diary_dir}")
        except Exception as e:
            print(f"[MEMORY SELECT] failed to read full diary for {memory_task}: {e}")

    return {
        "browser_task": browser_task,
        "search_task": search_task,
        "launcher_task": launcher_task,
        "vision_task": vision_task,
        "clean_memory_task": clean_memory_task,
        "process_task": process_task,
        "selected_memory": selected_memory
    }

def collect_tool_feedback_node(state: AgentState) -> Dict[str, Any]:
    tool_feedback = []
    if state.get("browser_result"):
        tool_feedback.append(f"【系统反馈-网页内容】\n{state.get('browser_result')}")
        
    if state.get("search_result"):
        tool_feedback.append(f"【系统反馈-搜索结果】\n{state.get('search_result')}")
        
    if state.get("launcher_result"):
        tool_feedback.append(f"【系统反馈-应用启动】\n{state.get('launcher_result')}")
        
    if state.get("vision_result"):
        tool_feedback.append(f"【系统反馈-屏幕画面解析】\n{state.get('vision_result')}")
        
    if state.get("process_result"):
        tool_feedback.append(f"【系统反馈-前台进程探测】\n{state.get('process_result')}")
        
    if state.get("clean_memory_result"):
        res = state.get("clean_memory_result")
        if res.get("success"):
            tool_feedback.append(f"【系统反馈】{res.get('message')}")
        else:
            tool_feedback.append(f"【系统反馈】内存清理失败: {res.get('error')}")

    feedback_str = "\n".join(tool_feedback)
    return {"tool_feedback_context": feedback_str}

def execute_process_task_node(state: AgentState) -> Dict[str, Any]:
    from core.system_inspector import get_active_programs
    result = get_active_programs()
    return {"process_result": result}

def main_llm_node(state: AgentState) -> Dict[str, Any]:
    active_messages = build_main_messages(state)
    
    response = call_model_with_fallback(active_messages, provider_override=get_config().get("api_provider", "inherit"), node_name="MAIN-LLM")
    
    raw_reply = response.content
    
    # 兼容 DeepSeek 深度思考等模型的 reasoning_content
    reasoning = response.additional_kwargs.get("reasoning_content", "")
    if reasoning:
        raw_reply = f"<think>\n{reasoning}\n</think>\n\n" + raw_reply

    retry_count = state.get("retry_count") or 0
    if not ("<think>" in raw_reply or "<character_thought>" in raw_reply):
        if retry_count >= 5:
            raw_reply = "<character_thought>\n大模型连续5次拒绝输出思维链，已被系统强制拦截。\n</character_thought>\n[crying][0](大模型连续5次格式异常，消息已被大贤者系统安全拦截。)"

    emotion, score, clean_content = parse_reply(raw_reply)
    thought = extract_character_thought(raw_reply)
    
    return {
        "main_llm_reply": raw_reply,
        "raw_reply": raw_reply, # for compatibility with old graph state outputs if needed
        "emotion": emotion,
        "score": score,
        "clean_content": clean_content,
        "thought": thought
    }

def execute_launcher_task_node(state: AgentState) -> Dict[str, Any]:
    from core.launcher_manager import launch_app
    app_name = state.get("launcher_task")
    if not app_name:
        return {"launcher_result": "Error: No app specified"}
        
    config_data = get_config()
    app_launcher = config_data.get("app_launcher", {})
    success, msg = launch_app(app_name, app_launcher)
    return {"launcher_result": msg}
    
def execute_clean_memory_task_node(state: AgentState) -> Dict[str, Any]:
    from core.optimizer_manager import clean_memory
    if not state.get("clean_memory_task"):
        return {"clean_memory_result": {"success": False, "error": "No task"}}
    
    result = clean_memory()
    return {"clean_memory_result": result}

def post_llm_node(state: AgentState) -> Dict[str, Any]:
    messages = build_post_messages(state)
    if not messages:
        return {"post_llm_reply": "[NO_UPDATE]"}
        
    active_messages = messages
    response = call_model_with_fallback(active_messages, provider_override=get_config().get("post_api_provider", "inherit"), node_name="POST-LLM")
    
    raw_reply = response.content
    reasoning = response.additional_kwargs.get("reasoning_content", "")
    if reasoning:
        raw_reply = f"<think>\n{reasoning}\n</think>\n\n" + raw_reply
        
    # Execute any DB commands
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

    # 过滤大模型崩溃的报错消息，防止其污染对话上下文
    if "大模型连续5次拒绝输出思维链，已被系统强制拦截" in raw_reply:
        # 如果大模型拦截报错了，我们将刚才追加的用户发言一并弹出（相当于本次对话在记忆里回档作废）
        if not is_self and len(new_history) > 0 and new_history[-1]["role"] == "user":
            new_history.pop()
    else:
        new_history.append({"role": "assistant", "content": raw_reply, "is_self_talk": is_self})
        
    new_history = trim_history(new_history)
    save_history(new_history)
    
    return {
        "history": new_history,
        "favorability": new_fav
    }

def should_execute_tools(state: AgentState) -> str:
    if state.get("browser_task") and state.get("browser_result") is None:
        return "execute_browser_task"
    if state.get("search_task") and state.get("search_result") is None:
        return "execute_search_task"
    if state.get("launcher_task") and state.get("launcher_result") is None:
        return "execute_launcher_task"
    if state.get("vision_task") and state.get("vision_result") is None:
        return "execute_vision_task"
    if state.get("process_task") and state.get("process_result") is None:
        return "execute_process_task"
    if state.get("clean_memory_task") and state.get("clean_memory_result") is None:
        return "execute_clean_memory_task"
    return "collect_tool_feedback"

def prepare_retry_node(state: AgentState) -> Dict[str, Any]:
    retry_count = state.get("retry_count") or 0
    return {
        "retry_count": retry_count + 1
    }
