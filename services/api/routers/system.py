import struct
import os
import json
import time
import shutil
import zipfile
import requests
import subprocess
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Request, Body, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from core.config_manager import get_config, save_config, get_active_character_id, GLOBAL_CONFIG_FILE
from core.stats_manager import stats_manager

router = APIRouter()
SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT_DIR = os.path.dirname(SERVICES_DIR)

@router.get("/api/tools")
async def api_tools():
    """获取当前系统支持的大模型工具列表"""
    tools = [
        {
            "name": "进程探测",
            "command": "[READ_PROCESS]",
            "description": "静默抓取用户当前正在运行的前台活跃程序和窗口标题，用于关心用户或吐槽。",
            "icon": "fas fa-desktop"
        },
        {
            "name": "清理系统内存",
            "command": "[CLEAN_MEMORY]",
            "description": "静默清理操作系统的物理内存与缓存，并在清理后向用户汇报释放的内存量。",
            "icon": "fas fa-broom"
        },
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
            "name": "睡眠挂机",
            "command": "[SLEEP_NOW]",
            "description": "让桌宠进入深度睡眠模式，停止主动说话和后台自言自语，直到被再次唤醒。",
            "icon": "fas fa-bed"
        },
        {
            "name": "定时闹钟任务",
            "command": "[TIMER_TASK: 分钟数, 提醒事项]",
            "description": "设定一个未来的倒计时，在时间到达时强制唤醒桌宠主动开口提醒用户。",
            "icon": "fas fa-clock"
        },
        {
            "name": "视觉识图",
            "command": "[ANALYZE_SCREEN]",
            "description": "截取当前电脑屏幕并调用视觉多模态大模型进行分析，以实现看屏幕的功能。",
            "icon": "fas fa-eye"
        },
        {
            "name": "实时天气查询",
            "command": "[WEATHER: 城市名] 或 [WEATHER: auto]",
            "description": "智能感知本地或指定城市的天气与气温，提供穿衣防雨贴士与角色关怀。",
            "icon": "fas fa-cloud-sun"
        }
    ]
    return JSONResponse({"status": "success", "tools": tools})

@router.post("/api/tools/weather/test")
def test_weather_api(payload: dict = Body(...)):
    """测试天气接口与定位配置"""
    try:
        from core.weather_manager import (
            resolve_target_location,
            fetch_open_meteo,
            fetch_wttr_in,
            fetch_qweather,
            fetch_amap,
            fetch_seniverse,
            get_weather_report
        )
        provider = payload.get("weather_provider", "auto")
        api_key = payload.get("weather_api_key", "").strip()
        city = payload.get("weather_city", "").strip()
        lat = payload.get("weather_lat")
        lon = payload.get("weather_lon")

        # 临时覆盖经纬度
        if not city and (lat is None or lon is None):
            res_city, res_lat, res_lon = resolve_target_location("auto")
        else:
            res_city = city or "北京"
            try:
                res_lat = float(lat) if lat is not None else 39.9042
                res_lon = float(lon) if lon is not None else 116.4074
            except:
                res_lat, res_lon = 39.9042, 116.4074

        report = ""
        if provider == "qweather" and api_key:
            res = fetch_qweather(api_key, res_city, res_lat, res_lon)
            report = f"【和风天气测试成功】城市: {res['city']} | 天气: {res['weather']} | 温度: {res['temperature']} | 温差: {res['temp_range']} | 湿度: {res['humidity']} | 风向: {res['wind']}\n建议: {res['advice']}"
        elif provider == "amap" and api_key:
            res = fetch_amap(api_key, res_city)
            report = f"【高德天气测试成功】城市: {res['city']} | 天气: {res['weather']} | 温度: {res['temperature']} | 温差: {res['temp_range']} | 湿度: {res['humidity']} | 风向: {res['wind']}\n建议: {res['advice']}"
        elif provider == "seniverse" and api_key:
            res = fetch_seniverse(api_key, res_city)
            report = f"【心知天气测试成功】城市: {res['city']} | 天气: {res['weather']} | 温度: {res['temperature']} | 温差: {res['temp_range']}\n建议: {res['advice']}"
        else:
            # 默认或免 Key
            report = get_weather_report(res_city)

        return JSONResponse({"status": "success", "report": report, "city": res_city, "lat": res_lat, "lon": res_lon})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@router.get("/api/tools/weather/locate")
def auto_locate_api():
    """获取公网 IP 自动定位结果"""
    try:
        from core.weather_manager import auto_detect_location
        data = auto_detect_location()
        return JSONResponse({"status": "success", "location": data})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.get("/api/settings/config")
def get_config_api():
    """获取本地大模型提供商配置"""
    char_id = get_active_character_id()
    config = get_config()
    config["character_id"] = config.get("character_id", char_id)
    config["character_name"] = config.get("character_name", char_id)
    config["has_deepseek"] = bool(os.getenv("DEEPSEEK_API_KEY"))
    config["has_gemini"] = bool(os.getenv("GEMINI_API_KEY"))
    config["enable_auto_speak"] = config.get("enable_auto_speak", True)
    config["auto_speak_multiplier"] = config.get("auto_speak_multiplier", 1.0)
    config["bubble_duration_multiplier"] = config.get("bubble_duration_multiplier", 1.0)
    config["user_prompt"] = config.get("user_prompt", "")
    config["preset_max_depth"] = config.get("preset_max_depth", 2)
    config["preset_block_english"] = config.get("preset_block_english", False)
    config["show_thought_button"] = config.get("show_thought_button", True)
    config["show_tool_calls"] = config.get("show_tool_calls", True)
    config["auto_start_on_boot"] = config.get("auto_start_on_boot", False)
    config["enable_tts"] = config.get("enable_tts", True)
    config["enable_tts_click"] = config.get("enable_tts_click", True)
    config["enable_tts_auto"] = config.get("enable_tts_auto", False)
    config["tts_provider"] = config.get("tts_provider", "edge_tts")
    config["tts_speak_mode"] = config.get("tts_speak_mode", "click")
    config["tts_language"] = config.get("tts_language", "zh")
    config["tts_base_url"] = config.get("tts_base_url") or config.get("fish_audio_base_url", "https://api.fish.audio/v1/tts")
    config["tts_api_key"] = config.get("tts_api_key") or config.get("fish_audio_api_key", os.getenv("FISH_AUDIO_API_KEY", ""))
    config["tts_model_name"] = config.get("tts_model_name", "")
    config["fish_audio_base_url"] = config["tts_base_url"]
    config["fish_audio_api_key"] = config["tts_api_key"]
    config["tts_voice_id"] = config.get("tts_voice_id", "")
    config["tts_voice_zh"] = config.get("tts_voice_zh", "")
    config["tts_voice_ja"] = config.get("tts_voice_ja", "")
    config["tts_voice_en"] = config.get("tts_voice_en", "")
    config["pre_api_provider"] = config.get("pre_api_provider", "inherit")
    config["post_api_provider"] = config.get("post_api_provider", "inherit")
    config["vision_engine"] = config.get("vision_engine", "gemini")
    config["flow_mode"] = config.get("flow_mode", False)
    config["history_step_multiplier"] = config.get("history_step_multiplier", 1)
    config["weather_provider"] = config.get("weather_provider", "auto")
    config["weather_api_key"] = config.get("weather_api_key", "")
    config["weather_city"] = config.get("weather_city", "")
    config["weather_lat"] = config.get("weather_lat", 39.9042)
    config["weather_lon"] = config.get("weather_lon", 116.4074)
    config["success"] = True
    return config

def sync_windows_autostart_registry(enable: bool):
    """在 Windows 注册表中同步自启动项"""
    import sys
    if sys.platform != "win32":
        return
    try:
        import winreg
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        app_name = "RumiaDesktopPet"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                if getattr(sys, 'frozen', False):
                    exe_path = f'"{sys.executable}"'
                else:
                    # 优先检测 Electron 可执行文件或项目启动主脚本
                    from core.config_manager import SERVICES_DIR
                    exe_path = f'"{sys.executable}" "{os.path.abspath(os.path.join(SERVICES_DIR, "..", "main.js"))}"'
                winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe_path)
            else:
                try:
                    winreg.DeleteValue(key, app_name)
                except FileNotFoundError:
                    pass
    except Exception as re:
        print(f"[AUTOSTART REGISTRY SYNC WARN] {re}")

@router.post("/api/settings/config")
def post_config_api(payload: dict = Body(...)):
    """保存大模型提供商配置及角色基础设定"""
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
        if "flow_mode" in payload:
            config_data["flow_mode"] = bool(payload["flow_mode"])
        if "history_step_multiplier" in payload:
            try:
                val = int(payload["history_step_multiplier"])
                if val in [1, 2, 4, 8]:
                    config_data["history_step_multiplier"] = val
            except Exception:
                pass
        if "enable_greeting" in payload:
            config_data["enable_greeting"] = bool(payload["enable_greeting"])
        if "enable_auto_speak" in payload:
            config_data["enable_auto_speak"] = bool(payload["enable_auto_speak"])
        if "show_thought_button" in payload:
            config_data["show_thought_button"] = bool(payload["show_thought_button"])
        if "show_tool_calls" in payload:
            config_data["show_tool_calls"] = bool(payload["show_tool_calls"])
        if "auto_start_on_boot" in payload:
            config_data["auto_start_on_boot"] = bool(payload["auto_start_on_boot"])
            sync_windows_autostart_registry(config_data["auto_start_on_boot"])
        if "enable_tts" in payload:
            config_data["enable_tts"] = bool(payload["enable_tts"])
        if "enable_tts_click" in payload:
            config_data["enable_tts_click"] = bool(payload["enable_tts_click"])
        if "enable_tts_auto" in payload:
            config_data["enable_tts_auto"] = bool(payload["enable_tts_auto"])
        if "tts_speak_mode" in payload:
            config_data["tts_speak_mode"] = payload["tts_speak_mode"].strip()
        if "tts_language" in payload:
            config_data["tts_language"] = payload["tts_language"].strip()
        if "tts_provider" in payload:
            config_data["tts_provider"] = payload["tts_provider"].strip()
        if "tts_base_url" in payload:
            config_data["tts_base_url"] = payload["tts_base_url"].strip()
            config_data["fish_audio_base_url"] = config_data["tts_base_url"]
        if "tts_api_key" in payload:
            config_data["tts_api_key"] = payload["tts_api_key"].strip()
            config_data["fish_audio_api_key"] = config_data["tts_api_key"]
        if "tts_model_name" in payload:
            config_data["tts_model_name"] = payload["tts_model_name"].strip()
        if "fish_audio_base_url" in payload:
            config_data["fish_audio_base_url"] = payload["fish_audio_base_url"].strip()
            config_data["tts_base_url"] = config_data["fish_audio_base_url"]
        if "fish_audio_api_key" in payload:
            config_data["fish_audio_api_key"] = payload["fish_audio_api_key"].strip()
            config_data["tts_api_key"] = config_data["fish_audio_api_key"]
        if "tts_voice_id" in payload:
            config_data["tts_voice_id"] = str(payload["tts_voice_id"]).strip()
        if "tts_voice_zh" in payload:
            config_data["tts_voice_zh"] = str(payload["tts_voice_zh"]).strip()
        if "tts_voice_ja" in payload:
            config_data["tts_voice_ja"] = str(payload["tts_voice_ja"]).strip()
        if "tts_voice_en" in payload:
            config_data["tts_voice_en"] = str(payload["tts_voice_en"]).strip()
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
        if "weather_provider" in payload:
            config_data["weather_provider"] = str(payload["weather_provider"]).strip()
        if "weather_api_key" in payload:
            config_data["weather_api_key"] = str(payload["weather_api_key"]).strip()
        if "weather_city" in payload:
            config_data["weather_city"] = str(payload["weather_city"]).strip()
        if "weather_lat" in payload:
            try:
                config_data["weather_lat"] = float(payload["weather_lat"])
            except:
                pass
        if "weather_lon" in payload:
            try:
                config_data["weather_lon"] = float(payload["weather_lon"])
            except:
                pass

        if "character_name" in payload:
            cname = str(payload["character_name"]).strip()
            if cname:
                config_data["character_name"] = cname

        require_restart = False
        if "character_id" in payload:
            new_char_id = str(payload["character_id"]).strip().lower()
            old_char_id = get_active_character_id()
            if new_char_id and new_char_id != old_char_id:
                import re
                if not re.match(r'^[a-z0-9_]+$', new_char_id):
                    return JSONResponse({"success": False, "status": "error", "message": "角色英文标识仅允许小写英文字母、数字和下划线！"}, status_code=400)
                
                from core.config_manager import USER_DATA_DIR, SERVICES_DIR, GLOBAL_CONFIG_FILE
                chars_root = os.path.join(USER_DATA_DIR, "characters")
                old_dir = os.path.join(chars_root, old_char_id)
                new_dir = os.path.join(chars_root, new_char_id)

                if os.path.exists(new_dir):
                    return JSONResponse({"success": False, "status": "error", "message": f"角色英文标识 '{new_char_id}' 已存在，请换一个名称！"}, status_code=400)
                
                if os.path.exists(old_dir):
                    os.rename(old_dir, new_dir)
                else:
                    os.makedirs(new_dir, exist_ok=True)

                old_img_dir = os.path.join(SERVICES_DIR, "static", "images", old_char_id)
                new_img_dir = os.path.join(SERVICES_DIR, "static", "images", new_char_id)
                if os.path.exists(old_img_dir) and not os.path.exists(new_img_dir):
                    try:
                        os.rename(old_img_dir, new_img_dir)
                    except Exception:
                        pass

                config_data["character_id"] = new_char_id
                
                g_cfg = {}
                if os.path.exists(GLOBAL_CONFIG_FILE):
                    try:
                        with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as gf:
                            g_cfg = json.load(gf)
                    except Exception:
                        pass
                g_cfg["active_character"] = new_char_id
                with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as gf:
                    json.dump(g_cfg, gf, ensure_ascii=False, indent=2)

                require_restart = True

        save_config(config_data)
        return {"success": True, "status": "success", "message": "配置已成功保存", "require_restart": require_restart}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/api/settings/test_vision")
def post_test_vision(payload: dict = Body(...)):
    """测试视觉引擎的识图能力"""
    try:
        from tools.tool_executor import execute_vision_task_node
        engine = payload.get("engine", "gemini")
        
        # 构造虚假 state 并指定测试引擎，免去写盘恢复的竞态死锁与还原覆盖问题
        fake_state = {
            "vision_task": "test",
            "vision_engine_override": engine
        }
        result = execute_vision_task_node(fake_state)
        
        return {"status": "success", "result": result.get("vision_result", "未返回结果")}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# --------------------------------------------------------------------------
# 系统版本与远程仓库一键更新 API
# --------------------------------------------------------------------------

@router.get("/api/system/version")
def get_system_version_api():
    """获取当前系统版本与 Git Commit"""
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        pkg_path = os.path.join(root_dir, "package.json")
        version = "1.21.0"
        if os.path.exists(pkg_path):
            with open(pkg_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                version = data.get("version", version)
        
        commit_hash = ""
        try:
            import subprocess
            res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=root_dir, capture_output=True, text=True, timeout=3)
            if res.returncode == 0:
                commit_hash = res.stdout.strip()
        except:
            pass

        return {"status": "success", "version": version, "commit": commit_hash}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.get("/api/system/check_fullscreen_game")
def check_fullscreen_game_api():
    """检测当前是否有全屏独占/无边框全屏游戏处于前台，用于全屏游戏时自动挂起桌宠至系统托盘"""
    try:
        from core.system_inspector import is_fullscreen_game_active
        config = get_config()
        auto_minimize_enabled = config.get("auto_minimize_on_fullscreen_game", True)
        is_fs = is_fullscreen_game_active()
        return {
            "status": "success",
            "is_fullscreen": is_fs,
            "auto_minimize_enabled": auto_minimize_enabled
        }
    except Exception as e:
        return {"status": "error", "is_fullscreen": False, "auto_minimize_enabled": False, "message": str(e)}

@router.get("/api/system/export_logs")
def export_system_logs_api():
    """打包导出所有系统日志 (同时全量兼容项目源码版与 AppData 安装包版)"""
    import io
    import zipfile
    from datetime import datetime
    from fastapi.responses import Response

    try:
        from core.config_manager import USER_DATA_DIR, SERVICES_DIR, get_config, get_active_character_id
        
        appdata_base = os.path.join(os.getenv('APPDATA') or os.path.expanduser('~'), 'RumiaDesktopPet')
        project_root = os.path.dirname(SERVICES_DIR)

        candidate_dirs = [
            (os.path.join(appdata_base, "logs"), "appdata_logs"),
            (os.path.join(SERVICES_DIR, "logs"), "services_logs"),
            (os.path.join(project_root, "logs"), "root_logs"),
        ]

        candidate_files = [
            (os.path.join(project_root, "backend_output.log"), "project_dev/backend_output.log"),
            (os.path.join(project_root, "log.txt"), "project_dev/log.txt"),
            (os.path.join(project_root, "data", "bg_task_log.txt"), "project_dev/bg_task_log.txt"),
            (os.path.join(appdata_base, "backend_output.log"), "appdata/backend_output.log"),
            (os.path.join(appdata_base, "electron_debug.log"), "appdata/electron_debug.log"),
            (os.path.join(appdata_base, "data", "bg_task_log.txt"), "appdata/bg_task_log.txt"),
        ]

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            added_paths = set()

            for ldir, tag in candidate_dirs:
                if os.path.exists(ldir) and os.path.isdir(ldir):
                    for root, _, files in os.walk(ldir):
                        for file in files:
                            full_path = os.path.abspath(os.path.join(root, file))
                            if full_path not in added_paths:
                                try:
                                    rel_name = os.path.relpath(full_path, start=ldir)
                                    arcname = f"logs/{tag}/{rel_name}"
                                    zip_file.write(full_path, arcname)
                                    added_paths.add(full_path)
                                except Exception:
                                    pass

            for fpath, tag in candidate_files:
                full_path = os.path.abspath(fpath)
                if os.path.exists(full_path) and os.path.isfile(full_path) and full_path not in added_paths:
                    try:
                        arcname = f"logs/{tag}"
                        zip_file.write(full_path, arcname)
                        added_paths.add(full_path)
                    except Exception:
                        pass

            try:
                is_frozen = getattr(sys, 'frozen', False)
                pkg_path = os.path.join(project_root, "package.json")
                ver = "未知"
                if os.path.exists(pkg_path):
                    with open(pkg_path, "r", encoding="utf-8") as f:
                        ver = json.load(f).get("version", ver)
                        
                cfg = get_config()
                diag_info = [
                    "==================================================",
                    "  Rumia DeskPet System Diagnostic Report",
                    "==================================================",
                    f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    f"App Version: v{ver}",
                    f"Is Standalone Executable (Frozen): {is_frozen}",
                    f"Active Character: {get_active_character_id()}",
                    f"API Provider: {cfg.get('api_provider', 'unknown')}",
                    f"Model Name: {cfg.get('engine_model_name', 'default')}",
                    f"Operating System: {sys.platform} ({os.name})",
                    f"Python Version: {sys.version.split()[0]}",
                    f"User Data Dir (%APPDATA%): {USER_DATA_DIR}",
                    f"Project Source Dir: {SERVICES_DIR}",
                    f"Total Collected Log Files: {len(added_paths)}",
                    "=================================================="
                ]
                zip_file.writestr("logs/system_info.txt", "\n".join(diag_info))
            except Exception:
                pass

        zip_buffer.seek(0)
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"Rumia_DeskPet_Logs_{timestamp_str}.zip"
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"打包导出日志失败: {str(e)}"}, status_code=500)


@router.post("/api/system/check_update")
def check_system_update_api():
    """检测远程 GitHub 仓库最新版本与 Commit 日志 (支持 Git 镜像与 CDN 直连检测)"""
    import subprocess
    import requests
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        pkg_path = os.path.join(root_dir, "package.json")
        current_version = "1.21.0"
        if os.path.exists(pkg_path):
            with open(pkg_path, "r", encoding="utf-8") as f:
                current_version = json.load(f).get("version", current_version)

        is_git_repo = os.path.exists(os.path.join(root_dir, ".git"))
        
        if is_git_repo:
            # 1. 尝试直接 fetch 或通过高可用 Git 镜像源 fetch
            fetch_remotes = [
                ["git", "fetch", "origin", "main"],
                ["git", "fetch", "https://ghfast.top/https://github.com/mystiafly/Touhou_Pet.git", "main"],
                ["git", "fetch", "https://gh-proxy.com/https://github.com/mystiafly/Touhou_Pet.git", "main"]
            ]
            fetch_success = False
            for cmd in fetch_remotes:
                try:
                    res = subprocess.run(cmd, cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
                    if res.returncode == 0:
                        fetch_success = True
                        break
                except Exception:
                    continue

            if fetch_success:
                local_hash = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5).stdout.strip()
                remote_hash = subprocess.run(["git", "rev-parse", "--short", "FETCH_HEAD"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5).stdout.strip()
                has_update = (local_hash != remote_hash)

                latest_version = current_version
                try:
                    remote_pkg_str = subprocess.run(["git", "show", "FETCH_HEAD:package.json"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5).stdout
                    if remote_pkg_str:
                        latest_version = json.loads(remote_pkg_str).get("version", current_version)
                except:
                    pass

                commit_logs = []
                if has_update:
                    log_res = subprocess.run(
                        ["git", "log", "HEAD..FETCH_HEAD", "-n", "10", "--pretty=format:%h - %s (%cr)"],
                        cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5
                    )
                    if log_res.returncode == 0 and log_res.stdout.strip():
                        commit_logs = log_res.stdout.strip().split("\n")

                return {
                    "status": "success",
                    "has_update": has_update,
                    "current_version": current_version,
                    "latest_version": latest_version,
                    "local_commit": local_hash,
                    "remote_commit": remote_hash,
                    "commit_logs": commit_logs,
                    "is_git": True
                }

        # 2. 非 Git 仓库或 Git Fetch 失败时，通过高可用 CDN 直连检测版本
        latest_version = current_version
        urls = [
            "https://cdn.jsdelivr.net/gh/mystiafly/Touhou_Pet@main/package.json",
            "https://ghfast.top/https://raw.githubusercontent.com/mystiafly/Touhou_Pet/main/package.json",
            "https://gh-proxy.com/https://raw.githubusercontent.com/mystiafly/Touhou_Pet/main/package.json",
            "https://raw.githubusercontent.com/mystiafly/Touhou_Pet/main/package.json"
        ]
        for url in urls:
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    latest_version = resp.json().get("version", current_version)
                    break
            except Exception:
                continue

        has_update = (current_version != latest_version)
        commit_logs = [f"发现新版本 v{latest_version}（本地当前为 v{current_version}）"] if has_update else ["当前已是最新版本"]

        return {
            "status": "success",
            "has_update": has_update,
            "current_version": current_version,
            "latest_version": latest_version,
            "local_commit": "zip-package",
            "remote_commit": f"v{latest_version}",
            "commit_logs": commit_logs,
            "is_git": is_git_repo
        }
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"检测更新异常: {str(e)}"}, status_code=500)


@router.post("/api/system/perform_update")
def perform_system_update_api():
    """执行一键更新 (优先 Git 拉取与智能镜像，若无 Git 或 Git 失败则自动流式下载源码包增量覆盖)"""
    import subprocess
    import zipfile
    import requests
    import shutil
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        is_git_repo = os.path.exists(os.path.join(root_dir, ".git"))
        
        # 1. 尝试使用 Git 更新 (极速毫秒级，增量仅几 KB~几 MB)
        git_installed = False
        try:
            git_ver = subprocess.run(["git", "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5)
            git_installed = (git_ver.returncode == 0)
        except Exception:
            git_installed = False

        if git_installed:
            if not is_git_repo:
                print("[SYSTEM UPDATE] 当前目录缺少 .git，正在自动初始化 Git 仓库...")
                subprocess.run(["git", "init"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
                subprocess.run(["git", "remote", "add", "origin", "https://github.com/mystiafly/Touhou_Pet.git"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)

            # 尝试通过多个镜像源执行 fetch
            fetch_remotes = [
                ["git", "fetch", "origin", "main"],
                ["git", "fetch", "https://ghfast.top/https://github.com/mystiafly/Touhou_Pet.git", "main"],
                ["git", "fetch", "https://gh-proxy.com/https://github.com/mystiafly/Touhou_Pet.git", "main"]
            ]
            git_fetch_ok = False
            for cmd in fetch_remotes:
                try:
                    res = subprocess.run(cmd, cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
                    if res.returncode == 0:
                        git_fetch_ok = True
                        break
                except Exception:
                    continue

            if git_fetch_ok:
                try:
                    # 先暂存或重置已跟踪文件的冲突，安全保留用户数据目录
                    subprocess.run(["git", "reset", "--hard", "FETCH_HEAD"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
                    # 恢复主远程仓库 URL
                    subprocess.run(["git", "remote", "set-url", "origin", "https://github.com/mystiafly/Touhou_Pet.git"], cwd=root_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5)
                    return {
                        "status": "success",
                        "message": "更新成功！已通过 Git 极速同步至最新版本。建议重启桌宠生效。",
                        "output": "Git 增量更新完成"
                    }
                except Exception as e:
                    print(f"[SYSTEM UPDATE] Git reset 遇到问题: {e}，将降级到 ZIP 覆盖更新...")

        # 2. 如果无 Git 或 Git 网络受阻，通过高可用镜像源流式下载 ZIP 归档包进行增量覆盖更新
        print("[SYSTEM UPDATE] 正在通过 GitHub 镜像源流式下载增量更新包...")
        zip_urls = [
            "https://gh-proxy.com/https://github.com/mystiafly/Touhou_Pet/archive/refs/heads/main.zip",
            "https://ghfast.top/https://github.com/mystiafly/Touhou_Pet/archive/refs/heads/main.zip",
            "https://github.moeyy.xyz/https://github.com/mystiafly/Touhou_Pet/archive/refs/heads/main.zip",
            "https://github.com/mystiafly/Touhou_Pet/archive/refs/heads/main.zip"
        ]
        
        temp_dir = os.path.join(root_dir, "data", "temp_update")
        os.makedirs(temp_dir, exist_ok=True)
        temp_zip_path = os.path.join(temp_dir, "update_archive.zip")

        download_success = False
        last_error_msg = ""
        for url in zip_urls:
            try:
                print(f"[SYSTEM UPDATE] 尝试连接更新源: {url}")
                with requests.get(url, stream=True, timeout=(10, 180)) as resp:
                    if resp.status_code == 200:
                        with open(temp_zip_path, "wb") as f_zip:
                            for chunk in resp.iter_content(chunk_size=512 * 1024):
                                if chunk:
                                    f_zip.write(chunk)
                        download_success = True
                        print(f"[SYSTEM UPDATE] 成功下载更新包，大小: {os.path.getsize(temp_zip_path)} 字节")
                        break
                    else:
                        last_error_msg = f"HTTP {resp.status_code}"
            except Exception as ex:
                last_error_msg = str(ex)
                print(f"[SYSTEM UPDATE] 更新源 {url} 失败: {ex}")
                continue

        if not download_success or not os.path.exists(temp_zip_path):
            return JSONResponse({
                "status": "error",
                "message": f"一键更新失败：无法从镜像源下载完整安装包 ({last_error_msg})，请检查网络或开启代理后重试。"
            }, status_code=500)

        # 3. 解压并安全覆盖，严格保护用户隐私与配置数据
        updated_count = 0
        skipped_count = 0
        with zipfile.ZipFile(temp_zip_path, "r") as zf:
            for member in zf.infolist():
                parts = member.filename.split("/", 1)
                if len(parts) < 2 or not parts[1]:
                    continue
                rel_path = parts[1]
                
                # 个人数据保护与本地持久化配置白名单保护
                target_path = os.path.join(root_dir, rel_path.replace("/", os.sep))
                if (
                    rel_path.startswith("data/")
                    or rel_path.startswith("logs/")
                    or rel_path.endswith(".env")
                    or rel_path == "global_config.json"
                    or "daily_history" in rel_path
                    or rel_path.endswith(".db")
                    or rel_path.endswith(".sqlite3")
                    or rel_path.endswith("dialog_history.json")
                    or rel_path.endswith("favorability.json")
                    or (rel_path.endswith("config.json") and os.path.exists(target_path))
                ):
                    skipped_count += 1
                    continue

                if member.is_dir():
                    os.makedirs(target_path, exist_ok=True)
                else:
                    try:
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with zf.open(member) as src, open(target_path, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        updated_count += 1
                    except PermissionError:
                        # 正在运行的被占用文件跳过，待重启时生效
                        skipped_count += 1
                    except Exception as e:
                        print(f"[SYSTEM UPDATE] 写入文件 {rel_path} 警告: {e}")

        # 清理临时下载文件
        try:
            if os.path.exists(temp_zip_path):
                os.remove(temp_zip_path)
        except:
            pass

        return {
            "status": "success",
            "message": f"更新成功！已覆盖同步 {updated_count} 个最新核心文件（已安全保留所有个人配置与记忆）。建议重启桌宠生效。",
            "output": f"增量覆盖完成：更新 {updated_count} 个文件，安全保留 {skipped_count} 个数据项。"
        }
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"一键更新异常: {str(e)}"}, status_code=500)


@router.post("/api/system/import_update_zip")
async def import_system_update_zip_api(file: UploadFile = File(...)):
    """接收用户上传的本地 ZIP 源码包，执行强制增量覆盖更新 (严格保护用户数据与个人配置)"""
    import zipfile
    import shutil
    try:
        if not file.filename or not file.filename.lower().endswith(".zip"):
            return JSONResponse({"status": "error", "message": "上传的文件不是 ZIP 格式压缩包"}, status_code=400)

        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        temp_dir = os.path.join(root_dir, "data", "temp_update")
        os.makedirs(temp_dir, exist_ok=True)
        uploaded_zip_path = os.path.join(temp_dir, "user_uploaded_update.zip")

        # 写入临时文件
        with open(uploaded_zip_path, "wb") as f_out:
            while content := await file.read(1024 * 1024):
                f_out.write(content)

        if not os.path.exists(uploaded_zip_path) or os.path.getsize(uploaded_zip_path) < 50:
            if os.path.exists(uploaded_zip_path):
                os.remove(uploaded_zip_path)
            return JSONResponse({"status": "error", "message": "上传的 ZIP 文件内容过小或已损坏"}, status_code=400)

        updated_count = 0
        skipped_count = 0
        new_version = None

        with zipfile.ZipFile(uploaded_zip_path, "r") as zf:
            namelist = zf.namelist()
            
            # 检测是否存在公共顶层文件夹 (如 Touhou_Pet-main/ 或 rumia/)
            prefix_to_strip = ""
            for name in namelist:
                parts = name.split("/")
                if len(parts) >= 2 and parts[-1] in ["package.json", "main.js", "run.py"]:
                    prefix_to_strip = parts[0] + "/"
                    break

            for member in zf.infolist():
                filename = member.filename
                if prefix_to_strip and filename.startswith(prefix_to_strip):
                    rel_path = filename[len(prefix_to_strip):]
                else:
                    rel_path = filename

                if not rel_path or rel_path.endswith("/"):
                    continue

                # 安全保护白名单：绝不覆盖用户个人数据与本地历史配置
                target_path = os.path.join(root_dir, rel_path.replace("/", os.sep))
                if (
                    rel_path.startswith("data/")
                    or rel_path.startswith("logs/")
                    or rel_path.endswith(".env")
                    or rel_path == "global_config.json"
                    or "daily_history" in rel_path
                    or rel_path.endswith(".db")
                    or rel_path.endswith(".sqlite3")
                    or rel_path.endswith("dialog_history.json")
                    or rel_path.endswith("favorability.json")
                    or (rel_path.endswith("config.json") and os.path.exists(target_path))
                ):
                    skipped_count += 1
                    continue

                # 检查是否包含 package.json 以提取新版本号
                if rel_path == "package.json":
                    try:
                        with zf.open(member) as f_pkg:
                            pkg_data = json.loads(f_pkg.read().decode("utf-8"))
                            new_version = pkg_data.get("version")
                    except Exception:
                        pass

                if member.is_dir():
                    os.makedirs(target_path, exist_ok=True)
                else:
                    try:
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with zf.open(member) as src, open(target_path, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        updated_count += 1
                    except PermissionError:
                        skipped_count += 1
                    except Exception as e:
                        print(f"[SYSTEM UPDATE] 写入文件 {rel_path} 警告: {e}")

        # 清理临时文件
        try:
            if os.path.exists(uploaded_zip_path):
                os.remove(uploaded_zip_path)
        except Exception:
            pass

        version_msg = f"（已升级至 v{new_version}）" if new_version else ""
        return {
            "status": "success",
            "message": f"离线包强制导入更新成功{version_msg}！已覆盖同步 {updated_count} 个核心代码文件（已安全保留所有个人配置与记忆）。请重启桌宠生效。",
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "new_version": new_version
        }
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"导入更新发生异常: {str(e)}"}, status_code=500)


@router.get("/api/system/backend_log")
def get_backend_log_api(lines: int = 200):
    """读取后端实时全量输出日志 (logs/backend_output.log)"""
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        log_path = os.path.join(root_dir, "logs", "backend_output.log")
        if not os.path.exists(log_path):
            return {"status": "success", "lines": [], "path": os.path.abspath(log_path), "message": "日志文件尚未生成"}
        
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()
            recent_lines = [l.rstrip() for l in all_lines[-lines:]]
            return {
                "status": "success",
                "path": os.path.abspath(log_path),
                "total_lines": len(all_lines),
                "lines": recent_lines
            }
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# 6. 主动说话接口 (自言自语)

@router.post("/api/settings/exit")
def exit_game():
    """安全退出节点，交由前端稍后关闭 Electron 窗口，run.py 会自动清理后端进程"""
    print("[SYSTEM EXIT] 准备安全闭眼去睡觉 (由前端控制退出)...")
    return JSONResponse({"status": "success"})


@router.get("/api/engines")
@router.get("/api/settings/custom_engines")
def api_get_engines():
    """获取所有自定义引擎列表"""
    from core.config_manager import get_custom_engines
    engines = get_custom_engines()
    return JSONResponse({"success": True, "engines": engines})

class EngineTestRequest(BaseModel):
    base_url: str
    api_key: str
    model_name: str = "test-model"
    temperature: Optional[float] = None

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
    from core.llm_client import get_safe_temperature
    try:
        api_key = req.api_key
        if not api_key:
            api_key = "sk-local"
            
        temp = get_safe_temperature(req.model_name, req.temperature if req.temperature is not None else 0.7)
        llm = ChatOpenAI(
            api_key=api_key,
            base_url=req.base_url,
            model=req.model_name,
            temperature=temp,
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
    temperature: Optional[float] = 0.7

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
        "api_key": req.api_key.strip(),
        "temperature": req.temperature if req.temperature is not None else 0.7
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

@router.post("/api/stats/ping")
def api_stats_ping():
    """接收前端心跳，更新桌宠活跃时长"""
    try:
        char_id = get_active_character_id()
        stats_manager.ping(char_id)
        return JSONResponse({"status": "success"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.get("/api/stats/dashboard")
def api_stats_dashboard():
    """获取仪表盘统计数据"""
    try:
        data = stats_manager.get_dashboard_stats()
        return JSONResponse({"status": "success", "data": data})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.post("/api/character/upload_wallpaper")
async def api_upload_wallpaper(file: UploadFile = File(...)):
    """接收用户上传的壁纸文件，自动保存为当前角色的 wallpaper 并存入 assets 目录"""
    import shutil, time
    from core.config_manager import get_character_dir, get_active_character_id, save_config, get_config
    try:
        char_id = get_active_character_id()
        char_dir = get_character_dir()
        assets_dir = os.path.join(char_dir, "assets")
        os.makedirs(assets_dir, exist_ok=True)
        
        # 清理旧的 wallpaper.* 文件，防止不同格式冲突
        for old_f in os.listdir(assets_dir):
            if old_f.lower().startswith("wallpaper."):
                try:
                    os.remove(os.path.join(assets_dir, old_f))
                except Exception:
                    pass

        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
        if not ext or ext not in ['.gif', '.png', '.jpg', '.jpeg', '.webp']:
            ext = '.gif' if file.content_type and 'gif' in file.content_type else '.png'
            
        target_filename = f"wallpaper{ext}"
        target_path = os.path.join(assets_dir, target_filename)
        
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 增加时间戳，强行刷新浏览器静态图片缓存
        timestamp = int(time.time() * 1000)
        wallpaper_url = f"/char_assets/{char_id}/assets/{target_filename}?t={timestamp}"
        
        config = get_config()
        config["immersive_wallpaper"] = wallpaper_url
        config["immersive_bg_mode"] = "image"
        save_config(config)
        
        return JSONResponse({"success": True, "wallpaper_url": wallpaper_url})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

@router.post("/api/character/upload_bgm")
async def api_upload_bgm(file: UploadFile = File(...)):
    """接收用户上传的沉浸模式 BGM 音乐文件，保存至 assets 目录并更新配置"""
    import shutil, time
    from core.config_manager import get_character_dir, get_active_character_id, save_config, get_config
    try:
        char_id = get_active_character_id()
        char_dir = get_character_dir()
        assets_dir = os.path.join(char_dir, "assets")
        os.makedirs(assets_dir, exist_ok=True)
        
        # 清理旧的 bgm.* 文件，防止格式冲突
        for old_f in os.listdir(assets_dir):
            if old_f.lower().startswith("bgm."):
                try:
                    os.remove(os.path.join(assets_dir, old_f))
                except Exception:
                    pass

        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".mp3"
        if not ext or ext not in ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']:
            ext = '.mp3'
            
        target_filename = f"bgm{ext}"
        target_path = os.path.join(assets_dir, target_filename)
        
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 增加时间戳，强行刷新浏览器静态音频缓存
        timestamp = int(time.time() * 1000)
        bgm_url = f"/char_assets/{char_id}/assets/{target_filename}?t={timestamp}"
        
        config = get_config()
        config["immersive_bgm_url"] = bgm_url
        config["enable_immersive_bgm"] = True
        save_config(config)
        
        return JSONResponse({"success": True, "bgm_url": bgm_url})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

# --------------------------------------------------------------------------
# Steam Wallpaper Engine (WE) 工坊支持与管理接口
# --------------------------------------------------------------------------
import json
import urllib.parse
from fastapi.responses import FileResponse

COMMON_WE_PATHS = [
    r"H:\SteamLibrary\steamapps\workshop\content\431960",
    r"C:\Program Files (x86)\Steam\steamapps\workshop\content\431960",
    r"C:\Program Files\Steam\steamapps\workshop\content\431960",
    r"D:\SteamLibrary\steamapps\workshop\content\431960",
    r"E:\SteamLibrary\steamapps\workshop\content\431960",
    r"F:\SteamLibrary\steamapps\workshop\content\431960",
    r"G:\SteamLibrary\steamapps\workshop\content\431960",
]

def extract_we_scene(sdir: str):
    """自动解包 WE .pkg 二进制场景资源，提取 4K 极清底层原图 (PNG/JPG) 与 BGM 音频"""
    import io
    from PIL import Image

    pkg_path = os.path.join(sdir, 'scene.pkg')
    if not os.path.exists(pkg_path):
        return None
        
    extracted_dir = os.path.join(sdir, 'extracted')
    os.makedirs(extracted_dir, exist_ok=True)
    
    bg_path = os.path.join(extracted_dir, 'base_bg.png')
    bgm_path = os.path.join(extracted_dir, 'bgm.mp3')
    
    try:
        with open(pkg_path, 'rb') as f:
            magic_len = struct.unpack('<I', f.read(4))[0]
            magic = f.read(magic_len).decode('utf-8', errors='ignore')
            num_files = struct.unpack('<I', f.read(4))[0]
            
            files = []
            for _ in range(num_files):
                name_len = struct.unpack('<I', f.read(4))[0]
                name_bytes = f.read(name_len)
                name = name_bytes.decode('utf-8', errors='ignore')
                offset = struct.unpack('<I', f.read(4))[0]
                length = struct.unpack('<I', f.read(4))[0]
                files.append((name, name_bytes, offset, length))
            
            header_end = f.tell()
            
            best_area = 0
            best_img_bytes = None
            
            for name, name_bytes, offset, length in files:
                f.seek(header_end + offset)
                data = f.read(length)
                
                lower_name = name.lower()
                if ('.mp3' in lower_name or '.wav' in lower_name or '.ogg' in lower_name or b'.mp3' in name_bytes) and not os.path.exists(bgm_path):
                    with open(bgm_path, 'wb') as audio_f:
                        audio_f.write(data)
                        
                png_idx = data.find(b'\x89PNG')
                jpg_idx = data.find(b'\xff\xd8\xff')
                
                headers = []
                if png_idx != -1: headers.append(png_idx)
                if jpg_idx != -1: headers.append(jpg_idx)
                
                for h_idx in headers:
                    img_bytes = data[h_idx:]
                    try:
                        im = Image.open(io.BytesIO(img_bytes))
                        area = im.size[0] * im.size[1]
                        if area > best_area:
                            best_area = area
                            best_img_bytes = img_bytes
                    except Exception:
                        pass
            
            if best_img_bytes:
                # 写入极清底图 (允许覆盖旧版较低分辨率的缓存)
                with open(bg_path, 'wb') as img_f:
                    img_f.write(best_img_bytes)
    except Exception as e:
        print(f"[WE UNPACK ERROR] {pkg_path}: {e}")
            
    return {
        'extracted_bg_path': bg_path if os.path.exists(bg_path) else '',
        'extracted_bgm_path': bgm_path if os.path.exists(bgm_path) else ''
    }

@router.get("/api/wallpaper_engine/scan")
def api_scan_wallpaper_engine(custom_path: str = ""):
    """扫描 Steam Wallpaper Engine (431960) 创意工坊壁纸"""
    scanned_path = ""
    items = []

    target_paths = []
    if custom_path and os.path.exists(custom_path):
        target_paths.append(custom_path)
    target_paths.extend(COMMON_WE_PATHS)

    for path in target_paths:
        if os.path.exists(path) and os.path.isdir(path):
            scanned_path = path
            try:
                subdirs = [os.path.join(path, d) for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))]
                for sdir in subdirs:
                    project_json_path = os.path.join(sdir, "project.json")
                    if os.path.exists(project_json_path):
                        try:
                            with open(project_json_path, "r", encoding="utf-8", errors="ignore") as pf:
                                meta = json.load(pf)
                            
                            folder_id = os.path.basename(sdir)
                            title = meta.get("title", f"壁纸 {folder_id}")
                            bg_type = meta.get("type", "scene").lower()
                            file_entry = meta.get("file", "")
                            preview_file = meta.get("preview", "preview.jpg")

                            preview_full_path = os.path.join(sdir, preview_file)
                            if not os.path.exists(preview_full_path):
                                preview_full_path = ""
                                for pf_name in ["preview.jpg", "preview.png", "preview.gif"]:
                                    if os.path.exists(os.path.join(sdir, pf_name)):
                                        preview_full_path = os.path.join(sdir, pf_name)
                                        break

                            media_full_path = os.path.join(sdir, file_entry) if file_entry else ""

                            # 仅检视是否先前已解包过，绝不在扫描循环中强行同步解包所有pkg
                            extracted_bg_url = ""
                            extracted_bgm_url = ""
                            extracted_bg_path = os.path.join(sdir, "extracted", "base_bg.png")
                            extracted_bgm_path = os.path.join(sdir, "extracted", "bgm.mp3")
                            if os.path.exists(extracted_bg_path):
                                mtime = int(os.path.getmtime(extracted_bg_path))
                                extracted_bg_url = f"/api/wallpaper_engine/media?path={urllib.parse.quote(extracted_bg_path)}&t={mtime}"
                            if os.path.exists(extracted_bgm_path):
                                mtime = int(os.path.getmtime(extracted_bgm_path))
                                extracted_bgm_url = f"/api/wallpaper_engine/media?path={urllib.parse.quote(extracted_bgm_path)}&t={mtime}"

                            items.append({
                                "folder_id": folder_id,
                                "folder_path": sdir,
                                "title": title,
                                "type": bg_type, # "video", "scene", "web"
                                "file_entry": file_entry,
                                "media_path": media_full_path if os.path.exists(media_full_path) else "",
                                "media_url": f"/api/wallpaper_engine/media?path={urllib.parse.quote(media_full_path)}" if media_full_path else "",
                                "preview_url": f"/api/wallpaper_engine/media?path={urllib.parse.quote(preview_full_path)}" if preview_full_path else "",
                                "extracted_bg_url": extracted_bg_url,
                                "extracted_bgm_url": extracted_bgm_url,
                                "description": meta.get("description", "")
                            })
                        except Exception as e:
                            print(f"[WE SCAN ERROR] {sdir}: {e}")
                if items:
                    break
            except Exception as e:
                print(f"[WE PATH SCAN ERROR] {path}: {e}")

    return {
        "success": True,
        "scanned_path": scanned_path,
        "items": items
    }

@router.post("/api/wallpaper_engine/unpack")
async def api_unpack_wallpaper_engine_item(request: Request):
    """按需只解包用户选中的单个 .pkg 场景壁纸，响应极速且绝不卡死主线程"""
    try:
        data = await request.json()
        folder_path = data.get("folder_path", "")
        if not folder_path or not os.path.exists(folder_path):
            return JSONResponse({"success": False, "message": "文件夹不存在"}, status_code=400)
            
        extracted = extract_we_scene(folder_path)
        extracted_bg_url = ""
        extracted_bgm_url = ""
        if extracted:
            if extracted.get("extracted_bg_path"):
                mtime = int(os.path.getmtime(extracted['extracted_bg_path']))
                extracted_bg_url = f"/api/wallpaper_engine/media?path={urllib.parse.quote(extracted['extracted_bg_path'])}&t={mtime}"
            if extracted.get("extracted_bgm_path"):
                mtime = int(os.path.getmtime(extracted['extracted_bgm_path']))
                extracted_bgm_url = f"/api/wallpaper_engine/media?path={urllib.parse.quote(extracted['extracted_bgm_path'])}&t={mtime}"

        return JSONResponse({
            "success": True,
            "extracted_bg_url": extracted_bg_url,
            "extracted_bgm_url": extracted_bgm_url
        })
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

import subprocess, ctypes

def find_wallpaper_engine_exe():
    candidate_paths = [
        r'H:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'C:\Program Files\Steam\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'D:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'F:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'G:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe',
        r'H:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper32.exe',
        r'C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine\wallpaper32.exe',
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            return p
    return ""

def set_desktop_icons_visible(visible: bool):
    """通过 Win32 API 隐藏或恢复 Windows 桌面图标，实现纯净沉浸效果"""
    try:
        progman = ctypes.windll.user32.FindWindowW('Progman', None)
        defview = ctypes.windll.user32.FindWindowExW(progman, 0, 'SHELLDLL_DefView', None)
        if not defview:
            workerw = 0
            while True:
                workerw = ctypes.windll.user32.FindWindowExW(0, workerw, 'WorkerW', None)
                if not workerw:
                    break
                defview = ctypes.windll.user32.FindWindowExW(workerw, 0, 'SHELLDLL_DefView', None)
                if defview:
                    break
        if defview:
            show_cmd = 5 if visible else 0  # 5=SW_SHOW, 0=SW_HIDE
            ctypes.windll.user32.ShowWindow(defview, show_cmd)
            return True
    except Exception as e:
        print(f"[WIN32 ICON TOGGLE ERROR] {e}")
    return False

@router.post("/api/wallpaper_engine/apply_native")
async def api_apply_wallpaper_engine_native(request: Request):
    """调用 Wallpaper Engine 命令行 API 切换原生壁纸播放"""
    from core.config_manager import save_config, get_config
    try:
        data = await request.json()
        folder_path = data.get("folder_path", "")
        project_json = os.path.join(folder_path, "project.json") if folder_path else ""
        
        we_exe = find_wallpaper_engine_exe()
        if not we_exe:
            return JSONResponse({"success": False, "message": "未在系统中未找到 Wallpaper Engine 可执行文件"}, status_code=404)
        if not os.path.exists(project_json):
            return JSONResponse({"success": False, "message": "壁纸 project.json 不存在"}, status_code=400)
            
        cmd = [we_exe, "-control", "openWallpaper", "-file", project_json]
        subprocess.Popen(cmd)
        
        config = get_config()
        config["immersive_bg_mode"] = "we_native"
        config["immersive_we_folder"] = folder_path
        if "preview_url" in data:
            config["immersive_wallpaper"] = data["preview_url"]
        save_config(config)
        
        return JSONResponse({"success": True, "we_exe": we_exe})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

@router.post("/api/wallpaper_engine/set_clean_desktop")
async def api_set_clean_desktop(request: Request):
    """进入/退出沉浸模式时，切换桌面图标显示状态以达到纯净观赏效果"""
    try:
        data = await request.json()
        hide_icons = data.get("hide_icons", False)
        ok = set_desktop_icons_visible(not hide_icons)
        return JSONResponse({"success": ok})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

@router.get("/api/wallpaper_engine/media")
def api_serve_wallpaper_engine_media(path: str = ""):
    """安全的本地壁纸引擎媒体文件代理与流式传输"""
    if not path:
        return JSONResponse({"status": "error", "message": "Missing path"}, status_code=400)
    
    decoded_path = urllib.parse.unquote(path)
    if not os.path.exists(decoded_path):
        return JSONResponse({"status": "error", "message": "File not found"}, status_code=404)

    return FileResponse(decoded_path)

@router.post("/api/character/save_immersive_config")
async def api_save_immersive_config(request: Request):
    """保存当前角色的沉浸模式高阶配置 (支持背景模式、WE壁纸路径、缩放规则)"""
    from core.config_manager import save_config, get_config
    try:
        data = await request.json()
        config = get_config()
        
        if "immersive_bg_mode" in data:
            config["immersive_bg_mode"] = data["immersive_bg_mode"] # "image", "video", "web", "transparent"
        if "immersive_wallpaper" in data:
            config["immersive_wallpaper"] = data["immersive_wallpaper"]
        if "immersive_media_url" in data:
            config["immersive_media_url"] = data["immersive_media_url"]
        if "immersive_bgm_url" in data:
            config["immersive_bgm_url"] = data["immersive_bgm_url"]
        if "enable_immersive_bgm" in data:
            config["enable_immersive_bgm"] = bool(data["enable_immersive_bgm"])
        if "enable_immersive_starlight" in data:
            config["enable_immersive_starlight"] = bool(data["enable_immersive_starlight"])
        if "enable_immersive_meteors" in data:
            config["enable_immersive_meteors"] = bool(data["enable_immersive_meteors"])
        if "enable_immersive_parallax" in data:
            config["enable_immersive_parallax"] = bool(data["enable_immersive_parallax"])
        if "enable_immersive_screenshot_btn" in data:
            config["enable_immersive_screenshot_btn"] = bool(data["enable_immersive_screenshot_btn"])
        if "wallpaper_fit" in data:
            config["wallpaper_fit"] = data["wallpaper_fit"]
            
        save_config(config)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


