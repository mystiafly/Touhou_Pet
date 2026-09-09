import os
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any, List

from core.config_manager import USER_DATA_DIR, SERVICES_DIR, get_active_character_id
from core.profile_manager import get_favorability, update_favorability

def get_scenario_dir(char_id: str = None) -> str:
    if not char_id:
        char_id = get_active_character_id()
    d = os.path.join(USER_DATA_DIR, "characters", char_id)
    os.makedirs(d, exist_ok=True)
    return d

def get_scenario_file_path(char_id: str = None) -> str:
    if not char_id:
        char_id = get_active_character_id()
    user_file = os.path.join(get_scenario_dir(char_id), "scenario.json")
    if not os.path.exists(user_file):
        # 尝试检查 services 目录下的角色预置剧本
        builtin_file = os.path.join(SERVICES_DIR, "characters", char_id, "scenario.json")
        if os.path.exists(builtin_file):
            return builtin_file
    return user_file

def get_scenario_state_path(char_id: str = None) -> str:
    return os.path.join(get_scenario_dir(char_id), "scenario_state.json")

def load_scenario(char_id: str = None) -> Dict[str, Any]:
    """加载角色的剧本节点列表"""
    file_path = get_scenario_file_path(char_id)
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[SCENARIO] 加载剧本配置异常 ({file_path}): {e}")
    return {"nodes": []}

def save_scenario(char_id: str, data: Dict[str, Any]) -> bool:
    """保存角色的剧本节点列表"""
    target_path = os.path.join(get_scenario_dir(char_id), "scenario.json")
    try:
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[SCENARIO] 保存剧本配置异常: {e}")
        return False

def load_scenario_state(char_id: str = None) -> Dict[str, Any]:
    """加载角色的剧本运行状态"""
    state_path = get_scenario_state_path(char_id)
    default_state = {
        "active_node_id": None,
        "is_paused": False,
        "turn_count": 0,
        "dialogue_buffer": [],
        "completed_nodes": {}
    }
    if os.path.exists(state_path):
        try:
            with open(state_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
                default_state.update(saved)
        except Exception as e:
            print(f"[SCENARIO] 加载剧本状态异常 ({state_path}): {e}")
    return default_state

def save_scenario_state(char_id: str, state_data: Dict[str, Any]) -> bool:
    """保存角色的剧本运行状态"""
    state_path = get_scenario_state_path(char_id)
    try:
        with open(state_path, "w", encoding="utf-8") as f:
            json.dump(state_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[SCENARIO] 保存剧本状态异常: {e}")
        return False

def get_favorability_floor(char_id: str = None) -> int:
    """
    计算当前角色的好感度保底下限。
    严格要求：好感度绝不能降低到上一个已完成节点的触发阈值以下。
    """
    if not char_id:
        char_id = get_active_character_id()
    state = load_scenario_state(char_id)
    completed = state.get("completed_nodes", {})
    if not completed:
        return 0

    scenario = load_scenario(char_id)
    node_map = {n.get("id"): n for n in scenario.get("nodes", []) if n.get("id")}

    max_floor = 0
    for node_id in completed:
        if node_id in node_map:
            thresh = int(node_map[node_id].get("trigger_favorability", 0))
            if thresh > max_floor:
                max_floor = thresh
    return max_floor

def check_and_trigger_scenario(char_id: str = None, current_fav: int = None) -> Optional[Dict[str, Any]]:
    """
    检查并触发剧本节点：
    当好感度达到某个未完成节点的阈值时，自动激活该节点并冻结好感度。
    """
    if not char_id:
        char_id = get_active_character_id()
    if current_fav is None:
        current_fav = get_favorability()

    state = load_scenario_state(char_id)
    scenario = load_scenario(char_id)
    nodes = scenario.get("nodes", [])
    node_map = {n.get("id"): n for n in nodes if n.get("id")}

    active_id = state.get("active_node_id")
    if active_id and active_id in node_map:
        # 已有进行中的剧情节点
        return node_map[active_id]

    completed = state.get("completed_nodes", {})
    # 查找尚未完成且好感度达标的节点
    eligible = [
        n for n in nodes
        if n.get("id") and n.get("id") not in completed and current_fav >= int(n.get("trigger_favorability", 0))
    ]

    if eligible:
        # 按触发好感度升序，触发门槛最低的一个合格节点
        eligible.sort(key=lambda x: int(x.get("trigger_favorability", 0)))
        target_node = eligible[0]
        state["active_node_id"] = target_node["id"]
        state["is_paused"] = True
        state["turn_count"] = 0
        state["dialogue_buffer"] = []
        save_scenario_state(char_id, state)
        print(f"[SCENARIO] 角色 {char_id} 触发剧情节点: [{target_node.get('title')}] (阈值 {target_node.get('trigger_favorability')})，好感度已冻结！")
        return target_node

    return None

def get_scenario_prompt_injection(char_id: str = None) -> str:
    """
    获取当前正在进行的剧情节点的【告知项】提示词，注入给主模型。
    """
    if not char_id:
        char_id = get_active_character_id()
    state = load_scenario_state(char_id)
    active_id = state.get("active_node_id")
    if not active_id:
        return ""

    scenario = load_scenario(char_id)
    node_map = {n.get("id"): n for n in scenario.get("nodes", []) if n.get("id")}
    node = node_map.get(active_id)
    if not node:
        return ""

    title = node.get("title", "专属剧情节点")
    briefing = node.get("briefing", "")

    return (
        f"\n\n【当前专属剧情事件：{title}】\n"
        f"事件背景与告知项：\n{briefing}\n\n"
        "【剧本对话特别指导】\n"
        "1. 在近期的对话与内心独白中，请你找寻恰当时机，自然、生动地向用户提起这件事，探寻用户的想法或决定。\n"
        "2. 绝对不可像机器人读题一样直接念出选项或生硬告知，必须完全融入你的性格、语气与情感互动！\n"
        "3. 保持真实的交谈与倾听，根据用户的反应做出符合你性格的回应。\n"
    )

def record_scenario_turn(char_id: str, user_msg: str, assistant_msg: str) -> bool:
    """
    记录一轮对话到剧情窗口。
    返回是否已经达到需要仲裁的轮数。
    """
    if not char_id:
        char_id = get_active_character_id()
    state = load_scenario_state(char_id)
    active_id = state.get("active_node_id")
    if not active_id:
        return False

    scenario = load_scenario(char_id)
    node_map = {n.get("id"): n for n in scenario.get("nodes", []) if n.get("id")}
    node = node_map.get(active_id)
    if not node:
        return False

    check_interval = max(4, min(8, int(node.get("check_interval", 5))))

    buffer = state.get("dialogue_buffer", [])
    buffer.append({
        "user": user_msg,
        "assistant": assistant_msg
    })
    state["dialogue_buffer"] = buffer
    state["turn_count"] = state.get("turn_count", 0) + 1

    should_eval = state["turn_count"] >= check_interval
    save_scenario_state(char_id, state)
    return should_eval

def evaluate_scenario_decision(char_id: str = None) -> Dict[str, Any]:
    """
    大模型裁决器 (LLM Arbiter)：
    将 4-8 轮对话打包送往大模型，判定用户是否做出了分支选择。
    """
    if not char_id:
        char_id = get_active_character_id()
    state = load_scenario_state(char_id)
    active_id = state.get("active_node_id")
    if not active_id:
        return {"status": "no_active_node"}

    scenario = load_scenario(char_id)
    node_map = {n.get("id"): n for n in scenario.get("nodes", []) if n.get("id")}
    node = node_map.get(active_id)
    if not node:
        return {"status": "node_not_found"}

    branches = node.get("branches", [])
    if not branches:
        # 无分支配置，默认直接结束
        return _complete_scenario_node(char_id, state, node, None, "无分支直接完结")

    briefing = node.get("briefing", "")
    dialogue_buffer = state.get("dialogue_buffer", [])

    # 构建分支描述
    branch_desc_lines = []
    for b in branches:
        branch_desc_lines.append(f"- 分支ID: `{b.get('id')}` | 分支名称: 【{b.get('name')}】\n  判定标准: {b.get('criteria')}")
    branches_str = "\n".join(branch_desc_lines)

    # 构建对话历史
    conv_lines = []
    for idx, turn in enumerate(dialogue_buffer, 1):
        conv_lines.append(f"第 {idx} 轮:\n用户: {turn.get('user', '')}\n桌宠: {turn.get('assistant', '')}")
    dialogue_str = "\n\n".join(conv_lines)

    system_prompt = (
        "你是一个严谨客观的 Galgame 剧情分支仲裁器 (Scenario Arbiter)。\n"
        "你的任务是仔细阅读桌宠与用户近期 4~8 轮的剧情对话，判定用户是否针对桌宠提出的剧情事件做出了明确的决断或走向了某条分支。\n\n"
        "【剧情事件背景（告知项）】\n"
        f"{briefing}\n\n"
        "【备选分支及判定标准】\n"
        f"{branches_str}\n\n"
        "【裁决准则】\n"
        "1. 用户必须给出了具有实质性意义的态度、决定或倾向，才能判定为做出了选择 (has_chosen = true)。\n"
        "2. 如果用户态度模糊、敷衍、反问、转移话题、尚未明确做出表态，或者还在犹豫纠结中，必须判定为尚未做好选择 (has_chosen = false, chosen_branch_id = null)。\n"
        "3. 你必须以严格的 JSON 格式输出，不得输出任何其他文字，格式如下：\n"
        "{\n"
        '  "has_chosen": true 或 false,\n'
        '  "chosen_branch_id": "命中的分支ID (未做出选择时填 null)",\n'
        '  "reasoning": "简要陈述你的判定理由，指出用户在具体哪一轮做出了怎样的决定"\n'
        "}"
    )

    human_prompt = f"【近期的完整对话记录】\n{dialogue_str}\n\n请严格按照 JSON 格式输出判定结果："

    try:
        from core.llm_client import get_llm_client_and_model
        client, model_name = get_llm_client_and_model()
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": human_prompt}
            ],
            temperature=0.2
        )
        content = response.choices[0].message.content.strip()

        # 提取 JSON 块
        import re
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        json_str = json_match.group(1).strip() if json_match else content

        arbiter_res = json.loads(json_str)
        has_chosen = arbiter_res.get("has_chosen", False)
        chosen_branch_id = arbiter_res.get("chosen_branch_id")
        reasoning = arbiter_res.get("reasoning", "")

        branch_map = {b.get("id"): b for b in branches if b.get("id")}

        if has_chosen and chosen_branch_id and chosen_branch_id in branch_map:
            chosen_branch = branch_map[chosen_branch_id]
            return _complete_scenario_node(char_id, state, node, chosen_branch, reasoning)
        else:
            # 用户仍未做好选择：重置计数器，继续下个 4-8 轮循环
            print(f"[SCENARIO ARBITER] 用户尚未做好选择或仍在纠结: {reasoning}。重置轮数，进入下一轮引导。")
            state["turn_count"] = 0
            state["dialogue_buffer"] = []
            save_scenario_state(char_id, state)
            return {
                "status": "undecided",
                "has_chosen": False,
                "reasoning": reasoning
            }
    except Exception as e:
        print(f"[SCENARIO ARBITER ERROR] 裁决器调用异常: {e}")
        # 出错时不结束节点，重置计数器稍后再试
        state["turn_count"] = 0
        save_scenario_state(char_id, state)
        return {"status": "error", "error": str(e)}

def _complete_scenario_node(char_id: str, state: Dict[str, Any], node: Dict[str, Any], branch: Optional[Dict[str, Any]], reasoning: str) -> Dict[str, Any]:
    """
    当剧情节点完成时结算：
    1. 解除好感度冻结；
    2. 好感度自动 +1，代表节点圆满结束并跨过里程碑；
    3. 叠加分支自身的好感度增减；
    4. 记录决策到 DataBank；
    5. 标记节点为已完成。
    """
    node_id = node.get("id")
    branch_id = branch.get("id") if branch else "default"
    branch_name = branch.get("name") if branch else "默认结束"
    branch_fav_change = int(branch.get("fav_change", 0)) if branch else 0

    # 1. 解除冻结
    state["is_paused"] = False
    state["active_node_id"] = None
    state["turn_count"] = 0
    state["dialogue_buffer"] = []

    # 记录到 completed_nodes
    if "completed_nodes" not in state:
        state["completed_nodes"] = {}

    state["completed_nodes"][node_id] = {
        "node_title": node.get("title", ""),
        "chosen_branch_id": branch_id,
        "chosen_branch_name": branch_name,
        "reasoning": reasoning,
        "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    save_scenario_state(char_id, state)

    # 2. 节点完成固定好感度 +1，再加上分支的增减变化
    total_change = 1 + branch_fav_change
    new_fav = update_favorability(total_change)

    # 3. 记录到 DataBank (若有配置)
    db_record = branch.get("databank_record") if branch else None
    if db_record:
        _record_scenario_to_databank(char_id, node.get("title", ""), branch_name, db_record)

    print(f"[SCENARIO COMPLETE] 节点 [{node.get('title')}] 圆满结束！达成分支: 【{branch_name}】。好感度变更: {total_change:+d} -> {new_fav}")

    return {
        "status": "completed",
        "has_chosen": True,
        "node_id": node_id,
        "node_title": node.get("title", ""),
        "chosen_branch_id": branch_id,
        "chosen_branch_name": branch_name,
        "total_fav_change": total_change,
        "new_favorability": new_fav,
        "reasoning": reasoning
    }

def _record_scenario_to_databank(char_id: str, node_title: str, branch_name: str, record_info: Any):
    """持久化记录关键剧情到 DataBank 动态数据库"""
    try:
        from core.databank_manager import load_databank, save_databank_state, get_databank_paths
        template_path, state_path = get_databank_paths()
        db = load_databank()
        if not db:
            return

        # 查找或选择合适的剧情表格（如 sheet_story, sheet_memories, 或首张表格）
        target_sheet_key = None
        for k in db.keys():
            if "story" in k.lower() or "剧情" in k or "记忆" in k or "回忆" in k or "event" in k.lower():
                target_sheet_key = k
                break
        if not target_sheet_key:
            target_sheet_key = list(db.keys())[0] if db else None

        if target_sheet_key and target_sheet_key in db:
            sheet_data = db[target_sheet_key]
            content = sheet_data.get("content", [])
            date_str = datetime.now().strftime("%Y-%m-%d")
            entry_text = str(record_info) if isinstance(record_info, str) else f"{node_title}: {branch_name}"
            
            # 追加新行
            new_row = [str(len(content)), date_str, node_title, branch_name, entry_text]
            # 补齐或裁剪列数
            if content and len(content) > 0:
                header_len = len(content[0])
                if len(new_row) < header_len:
                    new_row.extend([""] * (header_len - len(new_row)))
                elif len(new_row) > header_len:
                    new_row = new_row[:header_len]
            content.append(new_row)
            sheet_data["content"] = content
            save_databank_state(db)
            print(f"[SCENARIO DATABANK] 已将剧情抉择记录至 DataBank [{target_sheet_key}]: {entry_text}")
    except Exception as e:
        print(f"[SCENARIO DATABANK WARN] 记录到 DataBank 异常: {e}")

def reset_scenario_node(char_id: str, node_id: str) -> bool:
    """重置特定节点，允许重新体验"""
    state = load_scenario_state(char_id)
    if "completed_nodes" in state and node_id in state["completed_nodes"]:
        del state["completed_nodes"][node_id]
    if state.get("active_node_id") == node_id:
        state["active_node_id"] = None
        state["is_paused"] = False
        state["turn_count"] = 0
        state["dialogue_buffer"] = []
    save_scenario_state(char_id, state)
    return True

def reset_all_scenarios(char_id: str) -> bool:
    """重置当前角色的全部剧本进度"""
    state = {
        "active_node_id": None,
        "is_paused": False,
        "turn_count": 0,
        "dialogue_buffer": [],
        "completed_nodes": {}
    }
    return save_scenario_state(char_id, state)
