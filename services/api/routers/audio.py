import os
import json
import time
from typing import Dict, Any, Optional, List
from fastapi import BackgroundTasks, APIRouter, Request, Body, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from core.config_manager import get_config, get_active_character_id

router = APIRouter()
SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@router.post("/api/tts/speak")
def api_tts_speak(payload: dict = Body(...)):
    """接收文本并调用 TTS 接口生成语音 (带 Post-LLM 情绪音调与翻译精修)"""
    text = payload.get("text", "")
    char_id = payload.get("character_id") or get_active_character_id()
    emotion = payload.get("emotion", "normal")
    language = payload.get("language")
    voice_id = payload.get("voice_id")
    skip_refine = bool(payload.get("skip_refine", False))

    if not text or not str(text).strip():
        return JSONResponse({"success": False, "error": "文本为空"}, status_code=400)

    from core.tts_client import synthesize_and_cache_audio, TTS_CACHE_DIR
    success, audio_url, error = synthesize_and_cache_audio(
        str(text).strip(),
        char_id=char_id,
        emotion=emotion,
        language=language,
        voice_id=voice_id,
        skip_refine=skip_refine
    )
    if success and audio_url:
        # 如果当前发音的文本属于该角色的应付词，自动转存收录为离线语音
        try:
            from core.reaction_manager import load_reactions, save_reaction_audio_file
            reactions = load_reactions(char_id) or {}
            clean_t = str(text).strip()
            if any(clean_t in lines for lines in reactions.values()):
                filename = os.path.basename(audio_url)
                cache_file = os.path.join(TTS_CACHE_DIR, filename)
                if os.path.exists(cache_file):
                    with open(cache_file, "rb") as f:
                        save_reaction_audio_file(char_id, emotion, clean_t, f.read())
        except Exception as e:
            print(f"[REACTION AUDIO AUTO-SAVE WARN] {e}")

        return JSONResponse({"success": True, "audio_url": audio_url})
    else:
        return JSONResponse({"success": False, "error": error or "语音合成失败"}, status_code=500)


@router.get("/api/tts/audio/{filename}")
def api_tts_audio_file(filename: str):
    """读取并提供 TTS 缓存音频文件"""
    from core.tts_client import TTS_CACHE_DIR
    file_path = os.path.join(TTS_CACHE_DIR, filename)
    if not os.path.exists(file_path):
        return JSONResponse({"error": "Audio file not found"}, status_code=404)
    return FileResponse(file_path, media_type="audio/mpeg")


@router.get("/api/tts/gpt_sovits/status")
def api_tts_gpt_sovits_status():
    """检查本地 GPT-SoVITS 语音服务是否在线"""
    import requests
    from core.config_manager import get_config
    config = get_config()
    base_url = (config.get("tts_base_url") or "http://127.0.0.1:9880/tts").strip()
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        control_url = f"{parsed.scheme}://{parsed.netloc}/control"
        r = requests.get(control_url, timeout=0.8)
        running = r.status_code in [200, 400]
    except Exception:
        running = False
        
    return JSONResponse({"success": True, "running": running, "url": base_url})


@router.post("/api/tts/gpt_sovits/launch")
def api_tts_gpt_sovits_launch():
    """尝试自动在本地拉起 GPT-SoVITS 语音服务进程"""
    from core.tts_client import ensure_gpt_sovits_process
    started = ensure_gpt_sovits_process()
    return JSONResponse({"success": started, "message": "本地 GPT-SoVITS 服务已就绪！" if started else "未检测到本地 GPT-SoVITS 运行环境，请确认是否已解压安装。"})

