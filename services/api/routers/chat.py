import os
import json
import time
import threading
import re
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Request, Body, HTTPException, UploadFile, File, Form, BackgroundTasks, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from core.config_manager import get_config, save_config, get_active_character_id
from core.memory_manager import load_history, save_history, DAILY_HISTORY_DIR, get_memory_agent
from core.profile_manager import get_favorability
from graph.workflow import chat_workflow
from graph.nodes import post_llm_node, update_history_node
from workers.distillation import generate_pet_diary
from time_system import get_time_greeting_prompt
from core.stats_manager import stats_manager
from tools.presets_manager import get_self_talk_presets_file
from api.routers.common import clean_history_text, run_post_and_history, format_tool_prefix, safe_recycle_delete

router = APIRouter()
SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 1. 页面渲染接口 (基于绝对路径直接读取 HTML 返回，防路径寻址 500 错误)
@router.get("/pet", response_class=HTMLResponse)
def pet_mode():
    """渲染桌宠专用主界面"""
    path = os.path.join(SERVICES_DIR, "templates", "pet.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

@router.get("/langgraph_tutorial", response_class=HTMLResponse)
def langgraph_tutorial():
    """渲染 LangGraph 互动网页教学页面"""
    path = os.path.join(SERVICES_DIR, "templates", "langgraph_tutorial.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html)

@router.get("/", response_class=HTMLResponse)
def index():
    """渲染主页"""
    path = os.path.join(SERVICES_DIR, "templates", "index.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

def render_dashboard_html() -> str:
    tpl_dir = os.path.join(SERVICES_DIR, "templates")
    host_path = os.path.join(tpl_dir, "dashboard.html")
    with open(host_path, "r", encoding="utf-8") as f:
        host_html = f.read()

    def replacer(match):
        rel_path = match.group(1).strip()
        frag_path = os.path.join(tpl_dir, "dashboard", rel_path)
        if os.path.exists(frag_path):
            with open(frag_path, "r", encoding="utf-8") as pf:
                return pf.read()
        return f"<!-- Missing partial: {rel_path} -->"

    return re.sub(r'<!--\s*INCLUDE:\s*(.*?)\s*-->', replacer, host_html)

@router.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    """渲染独立大窗体设置面板 (Dashboard - 支持 Tab 片段即时热加载)"""
    html = render_dashboard_html()
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

# 2. 对话历史与好感度接口
def clean_history_text(text: str) -> str:
    if not text:
        return ""
    import re
    # 过滤 <think>, <character_thought>, <thought> 各种思考链
    cleaned = re.sub(r'<(?:think|character_thought|thought)>.*?</(?:think|character_thought|thought)>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # 过滤所有 [TAG:...] 或 [TAG] 系统指令标记
    cleaned = re.sub(r'\[[A-Z0-9_]+(?::.*?)?\]', '', cleaned)
    # 精简物理动作系统提示句，转为精炼的动作说明
    cleaned = re.sub(r'\(用户刚刚触碰了物理动作[，,]?\s*你的下意识反应是[：:]?\s*(.*?)\)', r'(\1)', cleaned)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    return '\n'.join(lines)

@router.get("/api/history")
def get_history():
    """获取对话历史及当前好感度 (全自动线程隔离运行)"""
    messages = load_history()
    dialogue = []
    char_name = get_config().get("character_name", "桌宠")
    role_map = {"user": "你", "human": "你", "assistant": char_name, "ai": char_name}

    for i, msg in enumerate(messages[1:], 1):
        role = msg.get("role", "")
        if role == "system":
            continue
        
        content = msg.get("content", "")
        cleaned_content = clean_history_text(content)
        if not cleaned_content:
            continue
        
        is_action = "用户刚刚触碰了物理动作" in content or (cleaned_content.startswith("(") and cleaned_content.endswith(")") and len(cleaned_content) < 30 and any(k in cleaned_content for k in ["敲", "摸", "捏", "碰", "打", "拉", "抱"]))
            
        dialogue.append({
            "id": i,
            "role": "你 (动作)" if is_action else role_map.get(role, role),
            "content": cleaned_content,
            "is_action": is_action,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
    return {
        "history": dialogue,
        "favorability": get_favorability()
    }

# 2.5 动态数据库接口

@router.post("/api/chat")
def chat(payload: dict = Body(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    """发送聊天请求核心业务逻辑 (使用 LangGraph 引擎驱动)"""
    from core.diary_batch import check_and_generate_diaries_async
    # 异步对账：检查前天或更早之前是否有没写完的日记
    check_and_generate_diaries_async()
    
    char_name = get_config().get("character_name", "桌宠")
    user_message = payload.get('message', '').strip()
    if not user_message:
        return JSONResponse({"error": "消息不能为空"}, status_code=400)

    messages = load_history()
    
    # 记录对话热度
    stats_manager.log_dialog(get_active_character_id())

    try:
        # 组装初始状态
        initial_state = {
            "user_message": user_message,
            "is_self_talk": False,
            "history": messages,
            "favorability": get_favorability(),
            "recalled_memories": "",
            "custom_presets": "",
            "raw_reply": "",
            "emotion": "normal",
            "score": 10,
            "clean_content": "",
            "tool_feedback_context": "",
            "browser_task": None,
            "browser_result": None,
            "launcher_task": None,
            "launcher_result": None,
            "search_task": None,
            "search_result": None,
            "vision_task": None,
            "vision_result": None,
            "clean_memory_task": None,
            "clean_memory_result": None,
            "process_task": None,
            "process_result": None,
            "weather_task": None,
            "weather_result": None,
            "selected_memory": "",
            "request_type": "chat",
            "retry_count": 0
        }

        # 调用 LangGraph 对话工作流 (ReAct 闭环)，附带持久化 thread_id
        char_id = get_active_character_id()
        config = {"configurable": {"thread_id": f"{char_id}_chat_thread"}}
        final_state = chat_workflow.invoke(initial_state, config)

        raw_reply = final_state.get("raw_reply", "")
        pre_llm_reply = final_state.get("pre_llm_reply", "")
        emotion = final_state.get("emotion", "normal")
        force_sleep = "[SLEEP_NOW]" in raw_reply or "[SLEEP_NOW]" in pre_llm_reply or emotion == "sleeping"
        score = final_state.get("score", 10)
        clean_content = final_state.get("clean_content", "")

        browser_task = final_state.get("browser_task", None)
        current_fav = final_state.get("favorability", 10)
        updated_history = final_state.get("history", [])

        # 将费时的副模型节点和数据库写入放入后台执行，立刻向前端返回 JSON 响应
        background_tasks.add_task(run_post_and_history, final_state)

        # 好感度增减评定
        change = 0
        if score > 15:
            change = 1
        elif score < 5:
            change = -1

        # 打印原始大模型输出用于调试
        print("\n\n======== RAW REPLY FROM CHAT API ========\n")
        print(raw_reply)
        print("\n===========================================\n\n")

        # 写入每日归档日志 (.txt)
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
            
            with open(log_file, 'a', encoding='utf-8') as lf:
                lf.write(f"[{time_str}] 你: {user_message}\n")
                lf.write(f"[{time_str}] {char_name}({emotion}): {clean_content}\n")
                if browser_task:
                    lf.write(f"           [触发网页操作: {browser_task}]\n")
                lf.write("\n")
        except Exception as log_ex:
            print(f"写入每日聊天日志失败: {log_ex}")

        thought = final_state.get("thought", "")

        # 检查是否开启“主动说话”模式，若是则自动生成语音
        audio_url = None
        cfg = get_config()
        is_auto_speak = cfg.get("enable_tts_auto") or cfg.get("tts_speak_mode") == "auto"
        if cfg.get("enable_tts", True) and is_auto_speak:
            try:
                from core.tts_client import synthesize_and_cache_audio
                tts_ok, url, err = synthesize_and_cache_audio(
                    clean_content,
                    char_id=char_id,
                    emotion=emotion
                )
                if tts_ok:
                    audio_url = url
            except Exception as tts_ex:
                print(f"[AUTO-TTS ERROR] {tts_ex}")

        # 若开启了显式工具调用显示，在对话正文前合成前缀
        display_content = clean_content
        if cfg.get("show_tool_calls", True):
            tool_prefix = format_tool_prefix(final_state)
            if tool_prefix:
                display_content = tool_prefix + clean_content

        return {
            "success": True,
            "reply": display_content,
            "thought": thought,
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(updated_history) - 1,
            "force_sleep": force_sleep,
            "audio_url": audio_url,
            "launcher_task": final_state.get("launcher_task"),
            "launcher_result": final_state.get("launcher_result"),
            "browser_task": final_state.get("browser_task"),
            "browser_result": final_state.get("browser_result")
        }

    except Exception as e:
        import traceback
        from core.llm_client import format_llm_error
        print("\n" + "="*20 + " [API CHAT ERROR BACKTRACE] " + "="*20)
        traceback.print_exc()
        print("="*68 + "\n")
        char_name = get_config().get("character_name", "桌宠")
        err_payload = format_llm_error(e, char_name=char_name)
        return JSONResponse(err_payload, status_code=200)

# 4. 清理对话历史接口
@router.post("/api/clear")
def clear_history_api():
    """清空对话历史"""
    try:
        messages = load_history()[:1]  # 仅保留首句 system 约束消息
        save_history(messages)
        
        # 尝试清理长期记忆 (Mem0 向量库)
        agent = get_memory_agent()
        if agent:
            try:
                agent.reset()
                print("[MEMORY] 长期记忆已彻底重置")
            except Exception as reset_e:
                print(f"[MEMORY ERROR] 重置长期记忆失败: {reset_e}")
                
        return {"success": True, "message": "已彻底清空对话历史与长期记忆。"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

def safe_recycle_delete(path: str) -> bool:
    """严格遵循回收站安全删除策略：将文件/目录送至 Windows 回收站"""
    if not os.path.exists(path):
        return True
    abs_path = os.path.abspath(path)
    # 优先使用 .NET FileSystem.DeleteDirectory / DeleteFile
    try:
        import subprocess
        if os.path.isdir(abs_path):
            ps_script = f"Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('{abs_path}', 'OnlyErrorDialogs', 'SendToRecycleBin')"
        else:
            ps_script = f"Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{abs_path}', 'OnlyErrorDialogs', 'SendToRecycleBin')"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True, timeout=10)
        if not os.path.exists(abs_path):
            return True
    except Exception:
        pass
    
    # 备选 send2trash
    try:
        from send2trash import send2trash
        send2trash(abs_path)
        if not os.path.exists(abs_path):
            return True
    except Exception:
        pass

    return not os.path.exists(abs_path)

# 5. 配置中心获取与角色管理接口

@router.post("/api/pet_speak")
def pet_speak(payload: dict = Body(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    """控制台或系统事件触发的自言自语/打招呼逻辑 (使用 LangGraph 对话)"""
    char_id = get_active_character_id()
    request_type = payload.get('type', 'idle').strip()
    count_raw = payload.get('count')
    
    if count_raw is None:
        count = 1
    else:
        try:
            count = int(count_raw)
        except (TypeError, ValueError):
            count = 1

    print(f"---------> 收到主动说话请求: 类型={request_type}, 次数={count} <---------")

    messages = load_history()
    self_talk_presets = {}
    self_talk_presets_file = get_self_talk_presets_file()
    if os.path.exists(self_talk_presets_file):
        try:
            with open(self_talk_presets_file, 'r', encoding='utf-8') as f:
                self_talk_presets = json.load(f)
        except Exception as e:
            print(f"[PRESETS ERROR] 读取自言自语预设文件失败: {e}")

    config_data = get_config()
    char_name = config_data.get("character_name", "桌宠")

    greeting_suffix = self_talk_presets.get("greeting_suffix", f" 要求：话语简短（15字以内），体现{char_name}的性格，不要和历史记录重复。")
    short_idle = self_talk_presets.get("short_idle", "（现在是一段沉默的时间。请主动向我搭话。注意不要和之前说过的话重复。）")
    medium_idle = self_talk_presets.get("medium_idle", "（我已经很久没有理你了。请用害羞或生气的傲娇口吻主动向我搭话，抱怨我冷落你，或者引起我的注意。话语要带有强烈情绪。）")
    long_idle = self_talk_presets.get("long_idle", "（我已经很久没有理你了。请用非常委屈或嚎啕大哭的口吻主动向我搭话，表现出极度的孤独和难过。）")

    prompt_content = ""
    if request_type == 'greeting':
        prompt_content = get_time_greeting_prompt(char_name)
        prompt_content += greeting_suffix
    elif request_type == 'clean_memory':
        clean_msg = payload.get('message', '已执行内存清理并释放了系统缓存。')
        prompt_content = f"[SELF TALK TRIGGER: 此刻你正在自言自语...]\n（你刚刚施展魔法帮助用户清理了电脑内存并加速了系统。以下是具体清理成果：\n{clean_msg}\n请你向用户汇报这个好消息，把具体数值带上，并邀功求夸奖。）"
    elif request_type == 'read_process':
        from core.system_inspector import get_active_programs
        bg_programs = get_active_programs()
        prompt_content = f"[SELF TALK TRIGGER: 此刻你正在自言自语...]\n（你突然想看看用户在忙什么，经过后台探查，{bg_programs}\n请你结合这些信息主动向用户搭话，关心一下用户的进度，或者傲娇地吐槽一下他一直盯着这些东西看都不理你。）"
    else:
        if count < 3:
            prompt_content = short_idle
        elif count == 3:
            prompt_content = medium_idle
        else:
            prompt_content = long_idle

    try:
        # 组装初始状态
        initial_state = {
            "user_message": prompt_content,
            "is_self_talk": True,
            "history": messages,
            "favorability": get_favorability(),
            "recalled_memories": "",
            "custom_presets": "",
            "raw_reply": "",
            "emotion": "normal",
            "score": 10,
            "clean_content": "",
            "tool_feedback_context": "",
            "browser_task": None,
            "browser_result": None,
            "launcher_task": None,
            "launcher_result": None,
            "search_task": None,
            "search_result": None,
            "vision_task": None,
            "vision_result": None,
            "clean_memory_task": None,
            "clean_memory_result": None,
            "process_task": None,
            "process_result": None,
            "weather_task": None,
            "weather_result": None,
            "selected_memory": "",
            "request_type": request_type,
            "retry_count": 0
        }

        config = {"configurable": {"thread_id": f"{char_id}_self_talk_thread"}}
        final_state = chat_workflow.invoke(initial_state, config)

        emotion = final_state.get("emotion", "normal")
        score = final_state.get("score", 10)
        clean_content = final_state.get("clean_content", "")
        current_fav = final_state.get("favorability", 10)
        updated_history = final_state.get("history", [])

        background_tasks.add_task(run_post_and_history, final_state)

        change = 0
        if score > 15:
            change = 1
        elif score < 5:
            change = -1

        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
            
            with open(log_file, 'a', encoding='utf-8') as lf:
                lf.write(f"[{time_str}] {char_name}({emotion}) (主动): {clean_content}\n\n")
        except Exception as log_ex:
            print(f"写入每日自言自语日志失败: {log_ex}")

        # 检查是否开启“主动说话”模式，若是则自动生成语音
        audio_url = None
        cfg = get_config()
        is_auto_speak = cfg.get("enable_tts_auto") or cfg.get("tts_speak_mode") == "auto"
        if cfg.get("enable_tts", True) and is_auto_speak:
            try:
                from core.tts_client import synthesize_and_cache_audio
                tts_ok, url, err = synthesize_and_cache_audio(
                    clean_content,
                    char_id=char_id,
                    emotion=emotion
                )
                if tts_ok:
                    audio_url = url
            except Exception as tts_ex:
                print(f"[AUTO-TTS ERROR] {tts_ex}")

        # 若开启了显式工具调用显示，在对话正文前合成前缀
        display_content = clean_content
        if cfg.get("show_tool_calls", True):
            tool_prefix = format_tool_prefix(final_state)
            if tool_prefix:
                display_content = tool_prefix + clean_content

        return {
            "success": True,
            "reply": display_content,
            "thought": final_state.get("thought", ""),
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(updated_history) - 1,
            "audio_url": audio_url,
            "launcher_task": final_state.get("launcher_task"),
            "launcher_result": final_state.get("launcher_result"),
            "browser_task": final_state.get("browser_task"),
            "browser_result": final_state.get("browser_result")
        }

    except Exception as e:
        import traceback
        from core.llm_client import format_llm_error
        print("\n" + "="*20 + " [PET SPEAK ERROR BACKTRACE] " + "="*20)
        traceback.print_exc()
        print("="*70 + "\n")
        char_name = get_config().get("character_name", "桌宠")
        err_payload = format_llm_error(e, char_name=char_name)
        return JSONResponse(err_payload, status_code=200)

# 7. 秘密日记日期列表接口

@router.post("/api/action_sync")
def api_action_sync(payload: dict = Body(...)):
    """将桌宠物理动作注入对话历史（不唤醒大模型）"""
    try:
        action_text = payload.get("action")
        if not action_text:
            return JSONResponse({"success": False, "error": "No action provided"}, status_code=400)
            
        messages = load_history()
        char_name = get_config().get("character_name", "桌宠")
        
        # 将用户动作以特殊的人类日志形式注入，避免被视作真正的聊天意图
        sync_msg = f"（用户刚刚做了物理动作，你的下意识反应是：{action_text}）"
        messages.append({"role": "human", "content": sync_msg})
        save_history(messages)
        
        # 同步记录到当天的日志文本中，供日记使用
        today_str = datetime.now().strftime("%Y-%m-%d")
        time_str = datetime.now().strftime("%H:%M:%S")
        log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
        with open(log_file, 'a', encoding='utf-8') as lf:
            lf.write(f"[{time_str}] [物理互动] {sync_msg}\n\n")
            
        return {"success": True}
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@router.get("/api/poll_events")
def poll_events():
    from core.event_manager import pop_event, _event_queue
    event = pop_event()
    if event:
        return {"success": True, "has_event": True, "event": event}
    return {"success": True, "has_event": False, "queue_len": len(_event_queue)}

@router.get("/api/test_timer")
def test_timer():
    from core.event_manager import add_event
    add_event("timer_alert", {"memo": "测试测试"})
    return {"success": True}

@router.get("/api/test_timer_1min")
def test_timer_1min():
    from core.event_manager import schedule_timer
    schedule_timer(1, "1分钟延时测试")
    return {"success": True}
import shutil






@router.post("/api/clean_memory")
def api_clean_memory():
    """纯粹的内存清理接口，由前端快捷工具直接调用并返回清理统计"""
    from core.optimizer_manager import clean_memory
    result = clean_memory()
    return JSONResponse(result)



