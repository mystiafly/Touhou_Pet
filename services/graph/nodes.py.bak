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
    """读取 Mem0 事实库中的长期记忆 (使用 3+1 轮对话上下文进行语义召回，3 轮代表 6 条历史消息)"""
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    is_self = state.get("is_self_talk", False)
    recalled = ""
    if not is_self and user_msg:
        # 3+1 轮模式：提取最近 3 轮历史对话（6 条消息） + 当前最新一句话，角色与对白混排
        dialogue_msgs = [msg for msg in history if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-6:]  # 提取最近 6 条历史消息 (3 轮)
        
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
                print("\n" + "-"*20 + " [MEM0 SEARCH QUERY (3+1 Rounds)] " + "-"*20)
                print(compiled_query)
                print("-"*68 + "\n")
                
                results = agent.search(compiled_query, filters={"user_id": "player_01"}, limit=3, threshold=0.45)
                results_list = results.get("results", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])
                print(f"[MEMORY RECALL] Query matches found: {len(results_list)}")
                if results_list:
                    recalled = "\n".join([f"- {r['memory']}" for r in results_list if isinstance(r, dict) and 'memory' in r])
                    print(f"[MEMORY RECALL] Successfully retrieved:\n{recalled}")
            except Exception as me:
                print(f"[MEMORY RECALL] Search failed: {me}")
    return {"recalled_memories": recalled}

def load_presets_node(state: AgentState) -> Dict[str, Any]:
    """匹配并加载当下好感度与关键词触发的系统提示词预设 (使用 1+1 轮对话上下文进行触发判定，1 轮代表 2 条历史消息)"""
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    current_fav = state.get("favorability", 10)
    is_self = state.get("is_self_talk", False)
    
    if not is_self and user_msg:
        # 1+1 轮模式：提取最近 1 轮历史对话（2 条消息：用户 + AI） + 当前最新一句话，角色与对白混排
        dialogue_msgs = [msg for msg in history if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-2:]  # 提取最近 2 条历史消息 (1 轮)
        
        query_parts = []
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "用户", "assistant": char_name}
        for msg in recent_msgs:
            query_parts.append(f"{role_map.get(msg['role'], msg['role'])}: {msg['content']}")
        query_parts.append(f"用户: {user_msg}")
        compiled_query = "\n".join(query_parts)
        
        print("\n" + "-"*20 + " [PRESETS TRIGGER QUERY (1+1 Rounds)] " + "-"*20)
        print(compiled_query)
        print("-"*72 + "\n")
        
        presets = load_and_trigger_presets(compiled_query, current_fav, is_self_talk=is_self)
    else:
        presets = load_and_trigger_presets(user_msg, current_fav, is_self_talk=is_self)
        
    return {"custom_presets": presets}

def build_active_messages(state: AgentState) -> list:
    """根据 AgentState 组装完整的 LangChain Prompt 消息列表 (15234架构)"""
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
    
    # ---------------------------------------------------------
    # 1. 静态常驻规则 (Category 1)
    # ---------------------------------------------------------
    cat1_parts = []
    if user_prompt:
        cat1_parts.append(f"[USER PROMPT (用户/玩家自身设定与偏好)]\n{user_prompt}")
        
    base_rules = (
        "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\n"
        "【最高优先级提醒与行为约束（基础静态规则）】\n"
        f"1. 角色约束与动作描写：请严格扮演{char_name}（{persona_prompt}），用中文回答。在对话中建议穿插用圆括号包裹的动作/表情描述（如：‘(脸红扭过头)’）。在适合的情况下（如进行两性/NSFW/深层亲密交互时），强烈建议你特地独立写出几段【无情绪与评分前缀】的纯圆括号段落描述神态与客观场景，但特别注意：此类纯圆括号描述【绝对不能作为你回复的最后一段】（最后一段必须是带标签的正常台词，以防止表情显示发生解析冲突）。如果下方的【最高优先级触发预设】有更细致的格式与描述要求，请一并严格执行。\n"
        "2. 格式约束：你的回复必须且只能遵循 '[心情][评分]对话内容' 格式要求。\n"
        "   - 如有浏览器自动化搜索意图，请在最末尾附加 `[BROWSER_TASK: 搜索任务文本]`。\n"
        "   - 如有搜索引擎检索意图（只在后台查资料背景搜索，不在屏幕上打开浏览器），请在最末尾附加 `[SEARCH_ENGINE: 搜索词]`。\n"
        "   - 【重要应用启动指令】如果用户让你打开、拉起或启动已配置的本地应用，你【必须】在回复的最末尾附加 `[LAUNCH_APP: 精确匹配的应用名称]`。这是物理启动应用的唯一硬件信号，如果你口头上说打开了但没有输出该标签，那就是在欺骗用户，请绝对避免假装打开而不输出标签！\n"
        "   - '[心情]' 必须且只能是以下英文单词之一：[normal] (常态/微笑/平静), [angry] (生气/愤怒/傲娇抱怨), [shy] (害羞/脸红/扭捏), [crying] (委屈/难过/大哭)。绝对禁止使用任何中文心情标签（如 [开心] ❌，[慵懒] ❌）。\n"
        "   - '[评分]' 必须且只能是方括号内包裹一个 0 到 20 之间的纯数字评分（如 [12]），代表当前言论的好感度评分（10为基准，>10加分，<10扣分）。绝对禁止写成类似 [评分: 92] ❌ 这样的非法格式。\n"
        "   - 示例：'[normal][12]哼，笨蛋！(双手叉腰)' 或 '[shy][18]才、才没有想你呢！(脸红别过头)'。\n\n"
        "   【绝对强制改名指令】如果你想修改或追加对用户的称呼，你【必须且只能】在回复的最末尾附带 [UPDATE_USER_NAME: 新称呼]。想修改自己的名字，必须附带 [UPDATE_PET_NAME: 新名字]。\n"
        "   【严重警告】如果你决定使用改名工具，请在本次回复中【仅输出】这行带有方括号的标签！绝对禁止输出任何废话或角色扮演台词！系统在后台修改完成后，会在第二回合把结果告诉你，那时你再正式进行对话！\n"
        "   [修改宽容度] 如果当前称呼为空，你可以很宽松地填入。如果已有内容想完全替换，必须用户强烈要求才行。如果是追加（如变成“妈妈/老婆”），可以适当宽松同意。\n"
    )
    if is_self:
        base_rules += "3. 注意事项：目前只是你在自言自语主动搭话，绝对不要扮演用户或者假装用户对你说了什么！绝对禁止在此模式包含浏览器标签。\n"
        
    cat1_parts.append(base_rules)
    
    # 强制工具规则
    forced_rules = (
        "[SYSTEM REMINDER - FORCED LAUNCH/SEARCH/MUSIC RULE]\n"
        "1. 如果用户要求你打开、拉起或启动本地应用（如果上述状态里写了未配置任何应用，请直接告诉用户尚未配置），你【必须】且只能在回复内容的最末尾加上相应的 `[LAUNCH_APP: 应用名称]` 标签（例如：`[LAUNCH_APP: 网易云音乐]`）。\n"
        "2. 如果用户有网页搜索意图，需要拉起浏览器，必须在最末尾加上 `[BROWSER_TASK: 搜索词]` 标签。\n"
        "3. 如果你需要查询实时信息、知识科普或你不确定的内容（仅背景查资料，不拉起浏览器），你【必须】在回复的最末尾加上 `[SEARCH_ENGINE: 搜索词]` 标签。\n"
        "4. 如果用户提出想听歌、放音乐、点歌、或者切歌的要求时，你在保持性格回复的同时，你【必须】在最末尾加上 `[MUSIC_PLAY: 歌曲名称 歌手名(可选)]` 标签传递给播放器。\n"
        "5. 绝对禁止口头上说打开了/查到了/播放了但不在最末尾写标签！必须输出方括号标签。"
    )
    cat1_parts.append(forced_rules)
    
    # Databank 规则
    databank_rules = get_databank_rules_for_llm()
    if databank_rules:
        cat1_parts.append(databank_rules)
        
    system_prompt_top = "\n\n=======================================================================\n\n".join(cat1_parts)

    # ---------------------------------------------------------
    # 2. 转换历史记录 (Category 5)
    # ---------------------------------------------------------
    lc_history = []
    for msg in history_msgs:
        if msg["role"] == "system":
            lc_history.append(SystemMessage(content=msg["content"]))
        elif msg["role"] == "user":
            lc_history.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_history.append(AIMessage(content=msg["content"]))
            
    # 组合最初始的消息列表
    active_messages = []
    if lc_history and isinstance(lc_history[0], SystemMessage):
        active_messages = [SystemMessage(content=system_prompt_top)] + (lc_history[1:] if not is_greeting else [])
    else:
        active_messages = [SystemMessage(content=system_prompt_top)] + (lc_history if not is_greeting else [])

    # ---------------------------------------------------------
    # 3. 构建尾部动态区块 (Category 3, 4, 2)
    # ---------------------------------------------------------
    tail_parts = []
    
    # Cat 3: 常驻变动 (状态与数据表)
    profile = get_user_profile()
    user_name = profile.get("user_called_as", "")
    pet_name = profile.get(f"{char_id}_called_as", "")
    meta_context = get_meta_context_for_chat(char_id, char_name)
    app_launcher = config_data.get("app_launcher", {})
    available_apps_str = ", ".join(app_launcher.keys()) if app_launcher else "（尚未配置任何本地应用启动项）"
    
    state_str = (
        f"[SYSTEM INJECTION: 当前状态]\n"
        f"{meta_context}\n"
        f"- 当前你（{char_name}）对用户的好感度为: {current_fav}/100。\n"
        f"- 当前系统支持你拉起启动的本地应用列表如下：【 {available_apps_str} 】。如果用户要求打开这些应用中的任何一个，你必须在回复文本的最末尾输出 `[LAUNCH_APP: 对应名称]`。\n"
        f"- 称呼设定：用户当前名字是【{user_name}】（空代表未设定），你的名字目前是【{pet_name}】（空代表{char_name}）。"
    )
    tail_parts.append(state_str)
    
    active_tables = get_active_tables(user_message, current_pool="\n".join([msg.get("content", "") for msg in history_msgs[-4:]]))
    if active_tables:
        tail_parts.append(f"[SYSTEM INJECTION: DataBank 全局状态表]\n{active_tables}")
        
    # Cat 4: 触发变动 (记忆与反馈)
    if recalled_memories:
        tail_parts.append(f"[SYSTEM INJECTION: 唤醒的长期记忆]\n{recalled_memories}\n（注：这些是关于用户的长期记忆。请仅在当前对话主题与这些记忆相关时，才自然、适度地提及。如果完全无关，绝对不要强行提及。）")
        
    tool_feedback = []
    if state.get("music_result"):
        music_result = state.get("music_result")
        if "error" in music_result:
            tool_feedback.append(f"点歌检索失败：{music_result['error']}。请以傲娇抱怨语气明确告诉用户没搜到，并绝对禁止再次输出 `[MUSIC_PLAY]` 标签。")
        else:
            tool_feedback.append(f"点歌检索成功：已播放歌曲：《{music_result['name']}》（歌手: {music_result['artists']}）。请以傲娇开心口吻告诉用户正在播放，绝对禁止再次输出 `[MUSIC_PLAY]` 标签。")
    if state.get("browser_result"): tool_feedback.append(f"网页反馈：\n{state['browser_result']}\n请仔细提炼上述信息傲娇地回答用户，绝对禁止再次输出 `[BROWSER_TASK]` 标签。")
    if state.get("search_result"): tool_feedback.append(f"搜索反馈：\n{state['search_result']}\n请结合上述搜索数据傲娇地回答用户，绝对禁止再次输出 `[SEARCH_ENGINE]` 标签。")
    if state.get("launcher_result"): tool_feedback.append(f"应用启动反馈：\n{state['launcher_result']}\n请说明启动情况，绝对禁止再次输出 `[LAUNCH_APP]` 标签。")
    if state.get("rename_result"): tool_feedback.append(f"改名反馈：\n{state['rename_result']}\n你现在已经知道了新设定，请立刻对用户之前的改名要求进行回应，禁止再次输出改名标签。")
    
    if tool_feedback:
        tail_parts.append(f"[SYSTEM INJECTION: 工具反馈]\n" + "\n\n".join(tool_feedback))
        
    # Cat 2: 触发不变动 (世界书预设)
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

    # 合并尾部并注入
    tail_block = "\n\n=======================================================================\n\n".join(tail_parts)
    
    # 组合最新消息
    if is_self:
        content = "[SELF TALK TRIGGER: 此刻你正在自言自语，请主动寻找话题发散。]\n\n" + tail_block
        content += "\n\n(请严格遵守 '[心情][评分]对白内容' 的回复格式！如果需要更新DataBank，请将 ```databank 块附加在回复最末尾，除此之外不要输出多余解释)"
        active_messages.append(HumanMessage(content=content))
    else:
        content = user_message + "\n\n" + tail_block
        content += "\n\n(请严格遵守 '[心情][评分]对白内容' 的回复格式！如果需要更新DataBank，请将 ```databank 块附加在回复最末尾，除此之外不要输出多余解释)"
        active_messages.append(HumanMessage(content=content))

    return active_messages

def generate_response_node(state: AgentState) -> Dict[str, Any]:
    """装配前置静态与后置动态 Prompt，调用大模型生成回复"""
    active_messages = build_active_messages(state)

    model = get_langchain_model()
    
    print("\n" + "="*40 + " [AI REQUEST (LANGCHAIN)] " + "="*40)
    print(f"Model: {model.model_name}")
    for idx, msg in enumerate(active_messages, 1):
        print(f"--- Message #{idx} ({msg.type.upper()}) ---")
        print(msg.content)
    print("="*94 + "\n")
    
    try:
        # Compatibility fallback handler
        response = model.invoke(active_messages)
    except Exception as primary_ex:
        print(f"[BACKEND WARNING] 默认大模型 ({model.model_name}) 调用异常: {primary_ex}")
        
        # 自动切换到另一个引擎进行兜底
        from langchain_openai import ChatOpenAI
        config_data = get_config()
        current_provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
        
        fallback_provider = "gemini" if "deepseek" in current_provider else "deepseek-v4-pro"
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        
        has_fallback = False
        fallback_model = None
        
        if fallback_provider == "gemini" and gemini_key:
            has_fallback = True
            fallback_model = ChatOpenAI(
                api_key=gemini_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                model="gemini-2.5-flash",
                temperature=0.7
            )
        elif "deepseek" in fallback_provider and deepseek_key:
            has_fallback = True
            fallback_model = ChatOpenAI(
                api_key=deepseek_key,
                base_url="https://api.deepseek.com",
                model="deepseek-v4-pro",
                temperature=0.7
            )
            
        if has_fallback and fallback_model:
            print(f"[BACKEND INFO] 正在尝试自动降级到备用大模型 ({fallback_model.model_name}) 进行兜底...")
            try:
                response = fallback_model.invoke(active_messages)
                print("[BACKEND SUCCESS] 备用模型兜底成功！")
            except Exception as fallback_ex:
                print(f"[BACKEND ERROR] 备用大模型调用同样失败: {fallback_ex}")
                raise primary_ex
        else:
            raise primary_ex
            
    raw_reply = response.content
    
    # 解析并执行 DataBank 修改指令
    raw_reply = parse_and_execute_databank_commands(raw_reply)
    print("\n" + "="*40 + " [AI RESPONSE (LANGCHAIN)] " + "="*40)
    print(raw_reply)
    print("="*95 + "\n")
    
    return {"raw_reply": raw_reply}

def parse_response_node(state: AgentState) -> Dict[str, Any]:
    """解析大模型返回的心情表情、好感评分、文本内容和点歌/浏览器操作指令"""
    raw_reply = state.get("raw_reply", "")
    emotion, score, clean_content = parse_reply(raw_reply)
    
    # 提取并清理浏览器操作指令
    browser_task = None
    task_match = re.search(r'\[BROWSER_TASK:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if task_match:
        browser_task = task_match.group(1).strip()
        clean_content = re.sub(r'\[BROWSER_TASK:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 提取搜索引擎指令
    search_task = None
    search_match = re.search(r'\[SEARCH_ENGINE:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if search_match:
        search_task = search_match.group(1).strip()
        clean_content = re.sub(r'\[SEARCH_ENGINE:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 提取并清理隐藏点歌指令 (ReAct)
    music_task = None
    music_match = re.search(r'\[MUSIC_PLAY:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if music_match:
        music_task = music_match.group(1).strip()
        clean_content = re.sub(r'\[MUSIC_PLAY:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 提取并清理隐藏启动本地应用指令 (ReAct)
    launcher_task = None
    launcher_match = re.search(r'\[LAUNCH_APP:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if launcher_match:
        launcher_task = launcher_match.group(1).strip()
        clean_content = re.sub(r'\[LAUNCH_APP:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 处理动态称呼更新指令
    rename_task_user = None
    user_name_match = re.search(r'\[UPDATE_USER_NAME:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if user_name_match:
        rename_task_user = user_name_match.group(1).strip()
        clean_content = re.sub(r'\[UPDATE_USER_NAME:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    rename_task_pet = None
    pet_name_match = re.search(r'\[UPDATE_PET_NAME:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if pet_name_match:
        rename_task_pet = pet_name_match.group(1).strip()
        clean_content = re.sub(r'\[UPDATE_PET_NAME:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    return {
        "emotion": emotion,
        "score": score,
        "clean_content": clean_content,
        "browser_task": browser_task,
        "search_task": search_task,
        "music_task": music_task,
        "launcher_task": launcher_task,
        "rename_task_user": rename_task_user,
        "rename_task_pet": rename_task_pet
    }

def update_history_node(state: AgentState) -> Dict[str, Any]:
    """计算好感度增减、保存对话历史到本地，并触发阶梯式上下文裁剪"""
    history_msgs = state.get("history", [])
    raw_reply = state.get("raw_reply", "")
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)
    score = state.get("score", 10)
    
    change = 0
    if score > 15:
        change = 1
    elif score < 5:
        change = -1
        
    new_fav = update_favorability(change)
    
    new_history = [msg.copy() for msg in history_msgs]
    
    if not is_self and user_message:
        new_history.append({"role": "user", "content": user_message})
        
    # 如果当前是自言自语，检查倒数第一条是否也是自言自语（连续自言自语）
    # 如果是，则弹出上一条，只保留最后一次自言自语在上下文里
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

def should_continue(state: AgentState) -> str:
    """💡 ReAct 路由逻辑：判断是否需要跳转到工具节点"""
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
    return "update_history"
