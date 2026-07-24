import os
import json
import time
import threading
import re
from datetime import datetime
from fastapi import APIRouter, Request, Body, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from core.config_manager import get_config, save_config, get_active_character_id, GLOBAL_CONFIG_FILE
from core.memory_manager import load_history, save_history, DAILY_HISTORY_DIR, get_memory_agent
from core.profile_manager import get_favorability
from graph.workflow import chat_workflow
from graph.nodes import post_llm_node, update_history_node
from workers.distillation import generate_pet_diary
from tools.presets_manager import get_self_talk_presets_file
from external_api import netease_music
from time_system import get_time_greeting_prompt
from core.databank_manager import load_databank, save_databank_state_sheet, save_databank_template_raw, get_databank_paths

router = APIRouter()
SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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

@router.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    """渲染独立大窗体设置面板 (Dashboard)"""
    path = os.path.join(SERVICES_DIR, "templates", "dashboard.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

# 2. 对话历史与好感度接口
@router.get("/api/history")
def get_history():
    """获取对话历史及当前好感度 (全自动线程隔离运行)"""
    messages = load_history()
    dialogue = []
    for i, msg in enumerate(messages[1:], 1):
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "你", "assistant": char_name}
        dialogue.append({
            "id": i,
            "role": role_map.get(msg["role"], msg["role"]),
            "content": msg["content"],
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
    return {
        "history": dialogue,
        "favorability": get_favorability()
    }

# 2.5 动态数据库接口
@router.get("/api/databank")
def get_databank():
    """获取当前角色的动态数据库(DataBank)状态"""
    databank = load_databank()
    if databank is None:
        return {"status": "error", "message": "当前角色未配置 DataBank 模板"}
    return {"status": "success", "data": databank}

@router.get("/api/databank/template")
def get_databank_template():
    """获取当前角色的原始 DataBank 模板 JSON"""
    template_path, _ = get_databank_paths()
    if not template_path or not os.path.exists(template_path):
        return {"status": "error", "message": "当前角色无 DataBank 模板"}
    with open(template_path, 'r', encoding='utf-8') as f:
        return {"status": "success", "data": f.read()}

@router.post("/api/databank/update_content")
def update_databank_content(payload: dict = Body(...)):
    sheet_id = payload.get("sheet_id")
    content = payload.get("content")
    if not sheet_id or content is None:
        return {"status": "error", "message": "参数错误"}
    success, msg = save_databank_state_sheet(sheet_id, content)
    return {"status": "success" if success else "error", "message": msg}

@router.post("/api/databank/update_template")
def update_databank_template(payload: dict = Body(...)):
    raw_json = payload.get("raw_json")
    if not raw_json:
        return {"status": "error", "message": "JSON内容为空"}
    success, msg = save_databank_template_raw(raw_json)
    return {"status": "success" if success else "error", "message": msg}

# --- 后台任务包装器 ---
def run_post_and_history(state: dict):
    with open("g:/code/rumia/data/bg_task_log.txt", "a", encoding="utf-8") as f:
        f.write(f"\\n--- BG Task Started ---\\n")
        f.write(f"User Message: {state.get('user_message')}\\n")
        f.write(f"Main LLM Reply: {state.get('main_llm_reply')}\\n")
    try:
        post_delta = post_llm_node(state)
        state.update(post_delta)
        update_history_node(state)
        with open("g:/code/rumia/data/bg_task_log.txt", "a", encoding="utf-8") as f:
            f.write(f"BG Task Success. Post Delta: {post_delta}\\n")
    except Exception as e:
        import traceback
        err_str = traceback.format_exc()
        with open("g:/code/rumia/data/bg_task_log.txt", "a", encoding="utf-8") as f:
            f.write(f"BG Task Error: {e}\\n{err_str}\\n")
        print(f"后台任务 (post_llm & update_history) 执行异常: {e}")

# 3. 核心聊天对话接口
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
            "browser_task": None,
            "browser_result": None,
            "music_task": None,
            "music_result": None,
            "launcher_task": None,
            "launcher_result": None,
            "search_task": None,
            "search_result": None,
            "rename_task_user": None,
            "rename_task_pet": None,
            "rename_result": None,
            "vision_task": None,
            "vision_result": None,
            "request_type": "chat"
        }

        # 调用 LangGraph 对话工作流 (ReAct 闭环)，附带持久化 thread_id
        char_id = get_active_character_id()
        config = {"configurable": {"thread_id": f"{char_id}_chat_thread"}}
        final_state = chat_workflow.invoke(initial_state, config)

        raw_reply = final_state.get("raw_reply", "")
        emotion = final_state.get("emotion", "normal")
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
                music_res = final_state.get("music_result")
                if music_res and "error" not in music_res:
                    lf.write(f"           [触发点歌: {music_res['name']} - {music_res['artists']}]\n")
                lf.write("\n")
        except Exception as log_ex:
            print(f"写入每日聊天日志失败: {log_ex}")

        # 如果点歌成功，提取音乐载荷返回给前端播放器
        music_play = None
        music_res = final_state.get("music_result")
        if music_res and "error" not in music_res:
            music_play = {
                "name": music_res["name"],
                "artists": music_res["artists"],
                "url": music_res["url"],
                "lyric": music_res["lyric"]
            }

        return {
            "success": True,
            "reply": clean_content,
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(updated_history) - 1,
            "music_play": music_play
        }

    except Exception as e:
        import traceback
        print("\n" + "="*20 + " [API CHAT ERROR BACKTRACE] " + "="*20)
        traceback.print_exc()
        print("="*68 + "\n")
        return JSONResponse({"error": str(e)}, status_code=500)

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

# 5. 配置中心获取与保存接口
@router.get("/api/characters/list")
async def api_characters_list():
    import os, json
    from core.config_manager import SERVICES_DIR
    chars_dir = os.path.join(SERVICES_DIR, "characters")
    result = []
    if os.path.exists(chars_dir):
        for item in os.listdir(chars_dir):
            char_path = os.path.join(chars_dir, item)
            config_path = os.path.join(char_path, "config.json")
            if os.path.isdir(char_path) and os.path.exists(config_path):
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        conf = json.load(f)
                        result.append({
                            "character_id": conf.get("character_id", item),
                            "character_name": conf.get("character_name", item)
                        })
                except Exception:
                    pass
    return JSONResponse({"status": "success", "characters": result})

class CharacterGenRequest(BaseModel):
    mode: str = "lazy"
    name: str = ""
    description: str = ""
    character_id: str = ""
    character_name: str = ""
    persona_prompt: str = ""
    theme_color: str = ""
    app_launcher: str = ""
    env_presets: str = ""

@router.post("/api/characters/generate")
async def api_characters_generate(req: CharacterGenRequest):
    import os, json
    from core.config_manager import SERVICES_DIR

    try:
        if req.mode == "pro":
            # 高手模式：直接取用用户输入的数据
            char_id = req.character_id
            char_name = req.character_name
            persona_prompt = req.persona_prompt
            theme_color = req.theme_color
            
            if not char_id or not char_name or not persona_prompt:
                return JSONResponse({"status": "error", "message": "英文 ID、中文名和核心提示词不能为空。"}, status_code=400)
                
            # 解析应用白名单 JSON
            app_launcher_data = {}
            if req.app_launcher:
                try:
                    app_launcher_data = json.loads(req.app_launcher)
                except Exception as e:
                    return JSONResponse({"status": "error", "message": f"应用白名单 JSON 格式错误: {e}"}, status_code=400)
            
            # 解析环境触发词 JSON
            env_presets_data = []
            if req.env_presets:
                try:
                    env_presets_data = json.loads(req.env_presets)
                except Exception as e:
                    return JSONResponse({"status": "error", "message": f"环境触发词 JSON 格式错误: {e}"}, status_code=400)
                    
        else:
            # 懒人模式：调用大模型
            from core.llm_client import get_langchain_model
            from langchain_core.messages import SystemMessage, HumanMessage
            system_prompt = """
你是一个高级桌面宠物角色配置生成器。
用户的输入将包括角色名字和一段特质描述。
请将这些零散的设定提炼成严格的 JSON 格式。
输出 JSON 必须只包含以下三个字段，不要输出任何额外的代码块标记或说明文字：
1. "character_id": 英文短小标识符（仅小写字母和下划线，如 "neko"、"alice"）
2. "character_name": 角色的中文名
3. "persona_prompt": 浓缩的系统核心人设（2-3句话，第一人称或客观陈述均可，如"你是东方Project中的xxx，一个喜欢...的妖怪..."）
"""
            llm = get_langchain_model()
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"名字: {req.name}\n特质描述: {req.description}")
            ]
            
            response = llm.invoke(messages)
            res_text = response.content.strip()
            
            # Clean markdown code blocks if present
            if res_text.startswith("```json"):
                res_text = res_text[7:]
            elif res_text.startswith("```"):
                res_text = res_text[3:]
            if res_text.endswith("```"):
                res_text = res_text[:-3]
                
            data = json.loads(res_text.strip())
            
            char_id = data.get("character_id")
            char_name = data.get("character_name")
            persona_prompt = data.get("persona_prompt")
            theme_color = ""
            app_launcher_data = {
                "记事本": "C:\\Windows\\System32\\notepad.exe",
                "网易云音乐": "H:\\\\CloudMusic\\\\cloudmusic.exe"
            }
            env_presets_data = []
            
            if not char_id or not char_name:
                return JSONResponse({"status": "error", "message": "模型生成的 JSON 格式不完整。"}, status_code=500)
            
        # 通用物理写入逻辑：创建目录
        char_dir = os.path.join(SERVICES_DIR, "characters", char_id)
        img_dir = os.path.join(SERVICES_DIR, "static", "images", char_id)
        presets_dir = os.path.join(char_dir, "presets")
        os.makedirs(char_dir, exist_ok=True)
        os.makedirs(img_dir, exist_ok=True)
        os.makedirs(presets_dir, exist_ok=True)
        
        # 写入 config.json
        config_data = {
            "api_provider": "deepseek-v4-pro",
            "character_name": char_name,
            "persona_prompt": persona_prompt,
            "app_launcher": app_launcher_data
        }
        if theme_color:
            config_data["theme_color"] = theme_color
            
        with open(os.path.join(char_dir, "config.json"), "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
            
        # 写入 env_presets.json
        if env_presets_data:
            with open(os.path.join(presets_dir, "env_presets.json"), "w", encoding="utf-8") as f:
                json.dump(env_presets_data, f, ensure_ascii=False, indent=2)
            
        return JSONResponse({
            "status": "success", 
            "character_id": char_id,
            "character_name": char_name
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.get("/api/character_info")
async def api_character_info():
    import json
    char_id = get_active_character_id()
    config = get_config()
    char_name = config.get("character_name", char_id)
    return JSONResponse({
        "character_id": char_id,
        "character_name": char_name,
        "theme_color": config.get("theme_color", ""),
        "image_path": f"/static/images/{char_id}/",
        "enable_greeting": config.get("enable_greeting", True),
        "enable_auto_speak": config.get("enable_auto_speak", True),
        "auto_speak_multiplier": config.get("auto_speak_multiplier", 1.0),
        "bubble_duration_multiplier": config.get("bubble_duration_multiplier", 1.0)
    })

@router.post("/api/switch_character")
async def api_switch_character(request: Request):
    import json
    try:
        data = await request.json()
        new_char_id = data.get("character_id")
        if not new_char_id:
            return JSONResponse({"status": "error", "message": "Missing character_id"}, status_code=400)
            
        with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
            g_config = json.load(f)
        g_config["active_character"] = new_char_id
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(g_config, f, indent=2)
            
        return JSONResponse({"status": "success", "require_restart": True})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.get("/api/tools")
async def api_tools():
    """获取当前系统支持的大模型工具列表"""
    tools = [
        {
            "name": "启动应用",
            "command": "[LAUNCH_APP: 应用名称]",
            "description": "启动系统中已配置的本地应用，如记事本或网易云音乐等。",
            "icon": "fas fa-rocket"
        },
        {
            "name": "网页搜索",
            "command": "[BROWSER_TASK: 关键词] 或 [SEARCH_ENGINE: 关键词]",
            "description": "进行互联网搜索、查资料、获取实时新闻或热点信息。",
            "icon": "fas fa-globe"
        },
        {
            "name": "播放音乐",
            "command": "[MUSIC_PLAY: 歌曲名称 歌手名]",
            "description": "自动在网易云音乐后台点播并播放指定的歌曲。",
            "icon": "fas fa-music"
        },
        {
            "name": "更改用户称呼",
            "command": "[UPDATE_USER_NAME: 新称呼]",
            "description": "如果用户要求改变对他的称呼，可以调用此工具进行修改。",
            "icon": "fas fa-user-tag"
        },
        {
            "name": "更改桌宠名字",
            "command": "[UPDATE_PET_NAME: 新名字]",
            "description": "如果用户要求改变桌宠自己的名字，调用此工具生效。",
            "icon": "fas fa-id-badge"
        },
        {
            "name": "视觉识图",
            "command": "[ANALYZE_SCREEN]",
            "description": "截取当前电脑屏幕并调用视觉多模态大模型进行分析，以实现看屏幕的功能。",
            "icon": "fas fa-eye"
        }
    ]
    return JSONResponse({"status": "success", "tools": tools})

@router.get("/api/settings/config")
def get_config_api():
    """获取本地大模型提供商配置"""
    config = get_config()
    config["has_deepseek"] = bool(os.getenv("DEEPSEEK_API_KEY"))
    config["has_gemini"] = bool(os.getenv("GEMINI_API_KEY"))
    config["enable_auto_speak"] = config.get("enable_auto_speak", True)
    config["auto_speak_multiplier"] = config.get("auto_speak_multiplier", 1.0)
    config["bubble_duration_multiplier"] = config.get("bubble_duration_multiplier", 1.0)
    config["user_prompt"] = config.get("user_prompt", "")
    config["preset_max_depth"] = config.get("preset_max_depth", 2)
    config["preset_block_english"] = config.get("preset_block_english", False)
    config["pre_api_provider"] = config.get("pre_api_provider", "inherit")
    config["post_api_provider"] = config.get("post_api_provider", "inherit")
    config["vision_engine"] = config.get("vision_engine", "gemini")
    config["success"] = True
    return config

@router.post("/api/settings/config")
def post_config_api(payload: dict = Body(...)):
    """保存大模型提供商配置"""
    try:
        config_data = get_config()
        if "api_provider" in payload:
            config_data["api_provider"] = payload["api_provider"].strip()
        if "pre_api_provider" in payload:
            config_data["pre_api_provider"] = payload["pre_api_provider"].strip()
        if "post_api_provider" in payload:
            config_data["post_api_provider"] = payload["post_api_provider"].strip()
        if "vision_engine" in payload:
            config_data["vision_engine"] = payload["vision_engine"].strip()
        if "enable_greeting" in payload:
            config_data["enable_greeting"] = bool(payload["enable_greeting"])
        if "enable_auto_speak" in payload:
            config_data["enable_auto_speak"] = bool(payload["enable_auto_speak"])
        if "auto_speak_multiplier" in payload:
            config_data["auto_speak_multiplier"] = float(payload["auto_speak_multiplier"])
        if "bubble_duration_multiplier" in payload:
            config_data["bubble_duration_multiplier"] = float(payload["bubble_duration_multiplier"])
        if "user_prompt" in payload:
            config_data["user_prompt"] = payload["user_prompt"].strip()
        if "preset_max_depth" in payload:
            config_data["preset_max_depth"] = int(payload["preset_max_depth"])
        if "preset_block_english" in payload:
            config_data["preset_block_english"] = bool(payload["preset_block_english"])
        if "app_launcher" in payload:
            config_data["app_launcher"] = payload["app_launcher"]
        save_config(config_data)
        return {"success": True, "message": "配置已成功保存"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/api/settings/test_vision")
def post_test_vision(payload: dict = Body(...)):
    """测试视觉引擎的识图能力"""
    try:
        from tools.tool_executor import execute_vision_task_node
        engine = payload.get("engine", "gemini")
        
        # 临时覆盖配置以进行测试
        config_data = get_config()
        original_engine = config_data.get("vision_engine")
        config_data["vision_engine"] = engine
        save_config(config_data)
        
        # 构造虚假 state 执行节点
        fake_state = {"vision_task": "test"}
        result = execute_vision_task_node(fake_state)
        
        # 恢复原有配置
        if original_engine:
            config_data["vision_engine"] = original_engine
        else:
            del config_data["vision_engine"]
        save_config(config_data)
        
        return {"status": "success", "result": result.get("vision_result", "未返回结果")}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# 6. 主动说话接口 (自言自语)
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
            "browser_task": None,
            "browser_result": None,
            "music_task": None,
            "music_result": None,
            "launcher_task": None,
            "launcher_result": None,
            "search_task": None,
            "search_result": None,
            "rename_task_user": None,
            "rename_task_pet": None,
            "rename_result": None,
            "vision_task": None,
            "vision_result": None,
            "request_type": request_type
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

        return {
            "success": True,
            "reply": clean_content,
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(updated_history) - 1
        }

    except Exception as e:
        import traceback
        print("\n" + "="*20 + " [PET SPEAK ERROR BACKTRACE] " + "="*20)
        traceback.print_exc()
        print("="*70 + "\n")
        return JSONResponse({"error": str(e)}, status_code=500)

# 7. 秘密日记日期列表接口
@router.get("/api/settings/logs")
def list_logs():
    """获取所有已保存对话和日记的日期列表"""
    try:
        if not os.path.exists(DAILY_HISTORY_DIR):
            return {"success": True, "dates": []}
            
        files = os.listdir(DAILY_HISTORY_DIR)
        dates = []
        for f in files:
            if f.startswith("chat_log_") and f.endswith(".txt"):
                date_str = f.replace("chat_log_", "").replace(".txt", "")
                dates.append(date_str)
                
        dates.sort(reverse=True)
        return {"success": True, "dates": dates}
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 8. 秘密日记具体内容接口
@router.get("/api/settings/logs/{date}")
def get_log_content(date: str):
    """获取特定日期的聊天记录与手写秘密日记 (对等路由)"""
    try:
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            return JSONResponse({"success": False, "error": "无效的日期格式"}, status_code=400)
            
        log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date}.txt")
        config = get_config()
        char_id = config.get("character_id", "rumia")
        diary_file = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{date}.txt")
        
        if not os.path.exists(log_file):
            return JSONResponse({"success": False, "error": "聊天记录文件不存在"}, status_code=404)
            
        with open(log_file, 'r', encoding='utf-8') as lf:
            log_content = lf.read()
            
        diary_content = ""
        if os.path.exists(diary_file):
            with open(diary_file, 'r', encoding='utf-8') as df:
                diary_content = df.read()
        else:
            print(f"[DIARY SYSTEM] 正在为 {date} 动态提炼并生成桌宠的日记...")
            diary_content = generate_pet_diary(date, log_content)
            try:
                with open(diary_file, 'w', encoding='utf-8') as df:
                    df.write(diary_content)
            except Exception as df_ex:
                print(f"动态保存日记失败: {df_ex}")
                
        return {
            "success": True,
            "date": date,
            "chat_content": log_content,
            "diary_content": diary_content
        }
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 8.5. 重新提炼并重写秘密日记接口
@router.post("/api/settings/logs/{date}/rewrite")
def rewrite_log_diary(date: str):
    """重新打包并重写特定日期的角色日记"""
    try:
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            return JSONResponse({"success": False, "error": "无效的日期格式"}, status_code=400)
            
        log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date}.txt")
        config = get_config()
        char_id = config.get("character_id", "rumia")
        diary_file = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{date}.txt")
        
        if not os.path.exists(log_file):
            return JSONResponse({"success": False, "error": "聊天记录文件不存在，无法重写日记"}, status_code=404)
            
        with open(log_file, 'r', encoding='utf-8') as lf:
            log_content = lf.read()
            
        print(f"[DIARY SYSTEM] 正在为 {date} 重新提炼并重写桌宠的日记...")
        new_diary_content = generate_pet_diary(date, log_content)
        
        with open(diary_file, 'w', encoding='utf-8') as df:
            df.write(new_diary_content)
            
        return {
            "success": True,
            "date": date,
            "diary_content": new_diary_content
        }
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 9. 记忆网络关系图谱数据接口
@router.get("/api/settings/memory_graph")
def get_memory_graph():
    """获取目前长短期记忆网络拓扑结构 (全自动线程池托管)"""
    try:
        agent = get_memory_agent()
        if not agent:
            return JSONResponse({"success": False, "error": "记忆系统未初始化"}, status_code=500)
        
        memories_data = agent.get_all(user_id="player_01")
        memories_list = []
        if isinstance(memories_data, dict) and "results" in memories_data:
            memories_list = memories_data["results"]
        elif isinstance(memories_data, dict) and "memories" in memories_data:
            memories_list = memories_data["memories"]
        elif isinstance(memories_data, list):
            memories_list = memories_data
            
        nodes = []
        edges = []
        
        fact_nodes_map = {}
        valid_memory_ids = set()
        
        for item in memories_list:
            if not isinstance(item, dict):
                continue
            m_id = item.get("id")
            m_text = item.get("memory")
            m_meta = item.get("metadata", {})
            m_date = m_meta.get("date", "未知日期") if isinstance(m_meta, dict) else "未知日期"
            
            if not m_id or not m_text:
                continue
                
            valid_memory_ids.add(m_id)
            
            fact_node = {
                "id": m_id,
                "label": m_text[:25] + "..." if len(m_text) > 25 else m_text,
                "title": f"记忆日期: {m_date}\n详细内容: {m_text}",
                "color": {
                    "background": "rgba(255, 121, 198, 0.85)",
                    "border": "#ff79c6",
                    "highlight": {
                        "background": "rgba(255, 121, 198, 0.95)",
                        "border": "#ff79c6"
                    },
                    "hover": {
                        "background": "rgba(255, 121, 198, 0.95)",
                        "border": "#ff79c6"
                    }
                },
                "font": {"color": "#ffffff", "size": 12},
                "shape": "box",
                "margin": 10,
                "shadow": {"enabled": True, "color": "rgba(255, 121, 198, 0.3)", "size": 8}
            }
            nodes.append(fact_node)
            fact_nodes_map[m_id] = fact_node

        entity_nodes_map = {}
        linked_entities_list = []
        try:
            if hasattr(agent, "entity_store") and agent.entity_store:
                entities_data = agent.entity_store.get_all()
                if isinstance(entities_data, list):
                    linked_entities_list = entities_data
                elif isinstance(entities_data, dict) and "results" in entities_data:
                    linked_entities_list = entities_data["results"]
        except Exception as ee:
            print(f"[MEMORY GRAPH] Failed to fetch raw entity store: {ee}")
            
        for entity in linked_entities_list:
            if not isinstance(entity, dict):
                continue
            e_name = entity.get("value") or entity.get("entity")
            linked_ids = entity.get("linked_memory_ids", [])
            
            if not e_name or not isinstance(linked_ids, list):
                continue
                
            has_valid_link = any(mid in valid_memory_ids for mid in linked_ids)
            if not has_valid_link:
                continue
                
            entity_node_id = f"entity_{e_name}"
            
            if entity_node_id not in entity_nodes_map:
                entity_nodes_map[entity_node_id] = {
                    "id": entity_node_id,
                    "label": e_name,
                    "title": f"实体概念: {e_name}\n关联记忆数: {len(linked_ids)}",
                    "color": {
                        "background": "rgba(139, 233, 253, 0.35)",
                        "border": "#8be9fd",
                        "highlight": {
                            "background": "rgba(139, 233, 253, 0.5)",
                            "border": "#50fa7b"
                        },
                        "hover": {
                            "background": "rgba(139, 233, 253, 0.45)",
                            "border": "#50fa7b"
                        }
                    },
                    "font": {"color": "#c4f2fe", "size": 11},
                    "shape": "dot",
                    "size": 10,
                    "shadow": {"enabled": True, "color": "rgba(139, 233, 253, 0.2)", "size": 5}
                }
                nodes.append(entity_nodes_map[entity_node_id])
                
            for m_id in linked_ids:
                if m_id in valid_memory_ids:
                    edges.append({
                        "from": entity_node_id,
                        "to": m_id,
                        "color": {
                            "color": "rgba(98, 114, 164, 0.4)",
                            "highlight": "rgba(139, 233, 253, 0.8)",
                            "hover": "rgba(139, 233, 253, 0.8)"
                        },
                        "width": 1.5,
                        "smooth": {"type": "curvedCW", "roundness": 0.2}
                    })
                    
        return {
            "success": True,
            "nodes": nodes,
            "edges": edges,
            "facts_count": len(valid_memory_ids),
            "entities_count": len(entity_nodes_map)
        }
    except Exception as ex:
        print(f"[API ERROR] Failed to fetch memory graph: {ex}")
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 10. 手动触发记忆蒸馏接口
@router.post("/api/settings/memory_distill_now")
def manual_distill_now(payload: dict = Body(default={})):
    """手动整理今日和未整理的回忆并生成今日手写日记"""
    try:
        agent = get_memory_agent()
        if not agent:
            return JSONResponse({"success": False, "error": "记忆系统未初始化"}, status_code=500)
            
        seed_test = payload.get("seed_test", False)
        
        if seed_test:
            test_fact = "用户最喜欢吃巧克力饼干和红茶，今天过生日。"
            print(f"[MANUAL DISTILL] Seeding test memory: {test_fact}")
            agent.add(
                test_fact,
                user_id="player_01",
                metadata={"date": datetime.now().strftime("%Y-%m-%d"), "test": True}
            )
            return {"success": True, "message": "成功注入一条关于巧克力饼干和红茶生日的测试回忆！"}
            
        config_data = get_config()
        char_id = config_data.get("character_id", "rumia")
        char_name = config_data.get("character_name", "桌宠")
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        log_file_path = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
        
        if not os.path.exists(log_file_path):
            return JSONResponse({"success": False, "error": f"今天还没有聊天记录哦，快去和{char_name}聊聊天吧！"})
            
        with open(log_file_path, 'r', encoding='utf-8') as lf:
            log_content = lf.read().strip()
            
        if not log_content:
            return JSONResponse({"success": False, "error": "今日聊天记录为空！"})
            
        print(f"[MANUAL DISTILL] Distilling today's chat logs ({today_str})...")
        agent.add(
            f"下面是用户与{char_name}在{today_str}这一天的聊天记录。请务必严格使用简体中文（Simplified Chinese）来提取和总结所有的记忆事实、个人偏好和关联实体信息，绝对不要输出任何英文！\n聊天记录如下：\n{log_content}",
            user_id="player_01",
            metadata={"date": today_str}
        )
        
        diary_file_path = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{today_str}.txt")
        print(f"[MANUAL DISTILL] Generating today's diary for {char_name} ({today_str})...")
        today_diary = generate_pet_diary(today_str, log_content)
        try:
            with open(diary_file_path, 'w', encoding='utf-8') as df:
                df.write(today_diary)
        except Exception as df_ex:
            print(f"手动整理时保存日记失败: {df_ex}")
        
        distilled_dates = config_data.get("distilled_dates", [])
        if today_str not in distilled_dates:
            distilled_dates.append(today_str)
            config_data["distilled_dates"] = distilled_dates
            save_config(config_data)
            
        return {"success": True, "message": f"{char_name}开始绞尽脑汁回想，为您写下一篇日记哦！"}

@router.get("/api/debug_qdrant")
def debug_qdrant():
    agent = get_memory_agent()
    if not agent:
        return {"error": "no agent"}
    try:
        res1 = agent.get_all(user_id="player_01")
        res2 = agent.get_all()
        res3 = agent.get_all(filters={"user_id": "player_01"})
        return {"user_id": res1, "all": res2, "filters": res3}
    except Exception as e:
        return {"error": str(e)}
    except Exception as ex:
        print(f"[API ERROR] Manual distill failed: {ex}")
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# === 网易云音乐原生控制 API ===
@router.get("/api/music/search")
def music_search(q: str):
    """搜索网易云音乐单曲"""
    if not q or not q.strip():
        return {"success": False, "error": "Query cannot be empty"}
    songs = netease_music.search_music(q)
    return {"success": True, "songs": songs}

@router.get("/api/music/lyric")
def music_lyric(id: int):
    """根据歌曲ID获取LRC歌词"""
    lyric = netease_music.get_lyric(id)
    return {"success": True, "lyric": lyric}

@router.get("/api/music/url")
def music_url(id: int):
    """获取歌曲播放直链"""
    url = netease_music.get_play_url(id)
    return {"success": True, "url": url}

# 11. 退出游戏接口
@router.post("/api/settings/exit")
def exit_game():
    """安全退出节点，交由前端稍后关闭 Electron 窗口，run.py 会自动清理后端进程"""
    print("[SYSTEM EXIT] 准备安全闭眼去睡觉 (由前端控制退出)...")
    return JSONResponse({"status": "success"})

@router.get("/api/settings/preview_prompt")
def preview_prompt():
    """模拟运行一次查询，并返回即将送给大模型的上下文 Prompt (Dry Run)"""
    from graph.nodes import recall_memories_node, load_presets_node, build_pre_messages, build_main_messages, build_post_messages
    
    test_message = "你好"
    
    # 构造假的状态
    state = {
        "user_message": test_message,
        "is_self_talk": False,
        "history": load_history(),
        "favorability": get_favorability(),
        "recalled_memories": "",
        "custom_presets": "",
        "pre_llm_reply": "",
        "tool_feedback_context": "",
        "main_llm_reply": "你好呀！",
        "post_llm_reply": "",
        "raw_reply": "",
        "emotion": "normal",
        "score": 10,
        "clean_content": "",
        "browser_task": None,
        "browser_result": None,
        "music_task": None,
        "music_result": None,
        "launcher_task": None,
        "launcher_result": None,
        "search_task": None,
        "search_result": None,
        "rename_task_user": None,
        "rename_task_pet": None,
        "rename_result": None,
        "request_type": "chat"
    }
    
    # 执行记忆回调
    mem_result = recall_memories_node(state)
    state.update(mem_result)
    
    # 执行预设加载
    preset_result = load_presets_node(state)
    state.update(preset_result)
    
    def format_msgs(active_messages):
        result_data = []
        total = len(active_messages)
        for i, msg in enumerate(active_messages):
            role_type = "system" if msg.type == "system" else "human" if msg.type == "human" else "assistant"
            role_name = "【系统指令 System】" if msg.type == "system" else "【用户输入 Human】" if msg.type == "human" else "【AI回复 Assistant】"
            
            is_history = (i > 0 and i < total - 1)
            result_data.append({
                "role_type": role_type,
                "role_name": role_name,
                "content": msg.content,
                "is_history": is_history
            })
        return result_data
        
    pre_msgs = build_pre_messages(state)
    main_msgs = build_main_messages(state)
    post_msgs = build_post_messages(state)
    
    return {
        "success": True, 
        "pre_messages": format_msgs(pre_msgs),
        "main_messages": format_msgs(main_msgs),
        "post_messages": format_msgs(post_msgs)
    }


# 12. 预设管理接口
@router.get("/api/presets/list")
def api_presets_list():
    import json
    from core.config_manager import SERVICES_DIR, get_character_dir
    global_file = os.path.join(SERVICES_DIR, "global_presets", "global_presets.json")
    custom_file = os.path.join(get_character_dir(), "presets", "custom_presets.json")
    
    global_presets = []
    if os.path.exists(global_file):
        try:
            with open(global_file, 'r', encoding='utf-8') as f:
                global_presets = json.load(f)
        except Exception:
            pass
            
    custom_presets = []
    if os.path.exists(custom_file):
        try:
            with open(custom_file, 'r', encoding='utf-8') as f:
                custom_presets = json.load(f)
        except Exception:
            pass
            
    return JSONResponse({"success": True, "global": global_presets, "custom": custom_presets})

class PresetSaveRequest(BaseModel):
    type: str # 'global' or 'custom'
    preset: dict

@router.post("/api/presets/save")
def api_presets_save(req: PresetSaveRequest):
    import json
    from core.config_manager import SERVICES_DIR, get_character_dir
    if req.type == "global":
        dir_path = os.path.join(SERVICES_DIR, "global_presets")
        file_path = os.path.join(dir_path, "global_presets.json")
    else:
        dir_path = os.path.join(get_character_dir(), "presets")
        file_path = os.path.join(dir_path, "custom_presets.json")
        
    os.makedirs(dir_path, exist_ok=True)
    
    presets = []
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                presets = json.load(f)
        except Exception:
            presets = []
            
    # 如果同名，覆盖
    new_preset = req.preset
    name = new_preset.get("name", "").strip()
    if not name:
        return JSONResponse({"success": False, "error": "预设名称不能为空"})
        
    found = False
    for i, p in enumerate(presets):
        if p.get("name") == name:
            presets[i] = new_preset
            found = True
            break
            
    if not found:
        presets.append(new_preset)
        
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})

class PresetDeleteRequest(BaseModel):
    type: str
    name: str

@router.post("/api/presets/delete")
def api_presets_delete(req: PresetDeleteRequest):
    import json
    from core.config_manager import SERVICES_DIR, get_character_dir
    if req.type == "global":
        file_path = os.path.join(SERVICES_DIR, "global_presets", "global_presets.json")
    else:
        file_path = os.path.join(get_character_dir(), "presets", "custom_presets.json")
        
    if not os.path.exists(file_path):
        return JSONResponse({"success": True})
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            presets = json.load(f)
            
        presets = [p for p in presets if p.get("name") != req.name]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})

@router.post("/api/worldbook/import")
async def import_worldbook(file: UploadFile = File(...), type: str = Form("custom")):
    """接收酒馆格式的世界书 json 文件，解析并合入 custom_presets 或 global_presets"""
    try:
        content = await file.read()
        wb_data = json.loads(content.decode("utf-8"))
        
        if "entries" not in wb_data:
            return JSONResponse({"success": False, "error": "无效的世界书格式：找不到 entries 字段"})
            
        entries = wb_data.get("entries", {})
        if not isinstance(entries, dict):
            return JSONResponse({"success": False, "error": "无效的世界书格式：entries 不是字典"})
            
        from core.config_manager import get_file_path
        
        if type == "global":
            custom_presets_file = os.path.join(SERVICES_DIR, "global_presets", "global_presets.json")
        else:
            custom_presets_file = get_file_path("presets/custom_presets.json")
        
        custom_presets = []
        if os.path.exists(custom_presets_file):
            with open(custom_presets_file, 'r', encoding='utf-8') as f:
                try:
                    custom_presets = json.load(f)
                except Exception:
                    custom_presets = []
                    
        source_name = file.filename.replace(".json", "") if file.filename else "Unknown_Worldbook"
        
        count = 0
        for entry_id, entry in entries.items():
            if not isinstance(entry, dict):
                continue
                
            new_preset = {
                "name": entry.get("comment", f"wb_entry_{entry_id}"),
                "prompt": entry.get("content", ""),
                "trigger_keywords": entry.get("key", []),
                "secondary_keywords": entry.get("keysecondary", []),
                "constant": entry.get("constant", False),
                "disable": entry.get("disable", False),
                "position": int(entry.get("position", 1)) if entry.get("position") is not None else 1,
                "order": int(entry.get("order", 100)) if entry.get("order") is not None else 100,
                "prevent_recursion": entry.get("preventRecursion", False),
                "worldbook_source": source_name
            }
            
            # Clean up empty arrays
            if not new_preset["trigger_keywords"]:
                del new_preset["trigger_keywords"]
            if not new_preset["secondary_keywords"]:
                del new_preset["secondary_keywords"]
                
            custom_presets.append(new_preset)
            count += 1
            
        with open(custom_presets_file, 'w', encoding='utf-8') as f:
            json.dump(custom_presets, f, ensure_ascii=False, indent=2)
            
        return JSONResponse({"success": True, "count": count})
    except Exception as e:
        return JSONResponse({"success": False, "error": f"解析世界书失败: {str(e)}"})

# 13. 自定义大脑引擎接口
@router.get("/api/engines")
def api_get_engines():
    """获取所有自定义引擎列表"""
    from core.config_manager import get_custom_engines
    engines = get_custom_engines()
    return JSONResponse({"success": True, "engines": engines})

class EngineTestRequest(BaseModel):
    base_url: str
    api_key: str
    model_name: str = "test-model"

@router.post("/api/engines/fetch_models")
def api_engines_fetch_models(req: EngineTestRequest):
    """从给定的 base_url 拉取模型列表 (/models 路由)"""
    import requests
    try:
        url = req.base_url.rstrip("/")
        if not url.endswith("/v1"):
            # 如果用户没填/v1，很多兼容接口也需要/v1/models，我们先直接尝试 /models
            pass
            
        models_url = f"{url}/models"
        headers = {}
        if req.api_key and req.api_key != "sk-local":
            headers["Authorization"] = f"Bearer {req.api_key}"
            
        response = requests.get(models_url, headers=headers, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        models = []
        if isinstance(data, dict) and "data" in data:
            models = [m.get("id") for m in data["data"] if isinstance(m, dict) and "id" in m]
        elif isinstance(data, list):
            models = [m.get("id") if isinstance(m, dict) else str(m) for m in data]
            
        if not models:
            return JSONResponse({"success": False, "error": "获取成功，但模型列表为空"})
            
        return JSONResponse({"success": True, "models": models})
    except Exception as e:
        return JSONResponse({"success": False, "error": f"拉取模型列表失败: {str(e)}"})

@router.post("/api/engines/test")
def api_engines_test(req: EngineTestRequest):
    """测试连接 (发送一条空闲问候)"""
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage
    try:
        api_key = req.api_key
        if not api_key:
            api_key = "sk-local"
            
        llm = ChatOpenAI(
            api_key=api_key,
            base_url=req.base_url,
            model=req.model_name,
            max_retries=0,
            timeout=10
        )
        # 有些严格的后端可能会校验模型名，这里用一个很简单的提示词
        res = llm.invoke([HumanMessage(content="Hi, please reply 'ok' only.")])
        return JSONResponse({"success": True, "reply": res.content})
    except Exception as e:
        return JSONResponse({"success": False, "error": f"测试连接失败: {str(e)}"})

class EngineSaveRequest(BaseModel):
    id: str = ""
    name: str
    model_name: str
    base_url: str
    api_key: str

@router.post("/api/engines/save")
def api_engines_save(req: EngineSaveRequest):
    """保存自定义引擎"""
    from core.config_manager import save_custom_engine
    import uuid
    
    engine_id = req.id
    if not engine_id:
        engine_id = f"custom_{uuid.uuid4().hex[:8]}"
        
    engine_data = {
        "id": engine_id,
        "name": req.name.strip(),
        "model_name": req.model_name.strip(),
        "base_url": req.base_url.strip(),
        "api_key": req.api_key.strip()
    }
    
    success = save_custom_engine(engine_data)
    if success:
        return JSONResponse({"success": True, "engine": engine_data})
    else:
        return JSONResponse({"success": False, "error": "保存失败"})

@router.delete("/api/engines/{engine_id}")
def api_engines_delete(engine_id: str):
    """删除引擎"""
    from core.config_manager import delete_custom_engine
    success = delete_custom_engine(engine_id)
    if success:
        return JSONResponse({"success": True})
    else:
        return JSONResponse({"success": False, "error": "删除失败或引擎不存在"})

# 12. 桌面宠物点击反应库接口
@router.get("/api/pet_reactions")
def api_pet_reactions():
    """获取桌宠5x5点击反应词库"""
    from core.reaction_manager import load_reactions, trigger_initial_generation_async, DEFAULT_EMOTIONS
    char_id = get_active_character_id()
    data = load_reactions(char_id)
    
    if not data:
        # 触发后台生成
        trigger_initial_generation_async(char_id)
        # 返回临时保底数据防止前端报错
        fallback = {e: ["嗯？"] for e in DEFAULT_EMOTIONS}
        fallback["angry"] = ["别碰我！"]
        fallback["crying"] = ["呜呜..."]
        fallback["shy"] = ["哎呀..."]
        fallback["sleeping"] = ["Zzz..."]
        return JSONResponse({"success": True, "reactions": fallback, "is_generating": True})
        
    return JSONResponse({"success": True, "reactions": data, "is_generating": False})

# 13. 静默记忆注入接口
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
