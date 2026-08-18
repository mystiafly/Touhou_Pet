import os
import re
import hashlib
import requests
from typing import Tuple, Optional
from dotenv import load_dotenv
from core.config_manager import get_config, get_active_character_id

# 确保加载根目录 .env
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

TTS_CACHE_DIR = os.path.join(ROOT_DIR, "data", "tts_cache")
os.makedirs(TTS_CACHE_DIR, exist_ok=True)

def clean_text_for_speech(text: str) -> str:
    """清洗对白文本，去除动作描写、思维链、表情标签等，只保留纯正口语"""
    if not text or not isinstance(text, str):
        return ""
    
    # 1. 移除思维链内容
    cleaned = re.sub(r'<(?:think|character_thought|thought|tucao)[^>]*>.*?</(?:think|character_thought|thought|tucao)>', '', text, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'</?(?:think|character_thought|thought|tucao)[^>]*>', '', cleaned, flags=re.IGNORECASE)

    # 2. 移除圆括号内的动作/心理描写: (双手叉腰)、（脸红扭头）
    cleaned = re.sub(r'（[^）]*）', '', cleaned)
    cleaned = re.sub(r'\([^\)]*\)', '', cleaned)

    # 3. 移除星号动作描写: *打了个哈欠*
    cleaned = re.sub(r'\*[^\*]*\*', '', cleaned)

    # 4. 移除方括号标签: [normal]、[12]、[SLEEP_NOW]
    cleaned = re.sub(r'\[[^\]]*\]', '', cleaned)

    # 5. 去除多余标点与空白
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # 如果清洗后全空（例如整句只是动作描写），则退回原文本去除标签后的内容
    if not cleaned:
        fallback = re.sub(r'\[[^\]]*\]', '', text)
        cleaned = re.sub(r'</?[^>]+>', '', fallback).strip()

    return cleaned

def generate_speech_fish_audio(text: str, voice_id: Optional[str] = None) -> Tuple[bool, Optional[bytes], Optional[str]]:
    """调用 Fish Audio TTS 接口生成 MP3 音频流"""
    clean_text = clean_text_for_speech(text)
    if not clean_text:
        return False, None, "没有可朗读的有效文本内容"

    config_data = get_config()
    api_key = config_data.get("fish_audio_api_key") or os.getenv("FISH_AUDIO_API_KEY", "").strip()
    base_url = config_data.get("fish_audio_base_url") or os.getenv("FISH_AUDIO_BASE_URL", "https://api.fish.audio/v1/tts").strip()

    if not api_key:
        return False, None, "未配置 Fish Audio API Key (请在控制台或 .env 中设置)"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "text": clean_text,
        "format": "mp3",
        "latency": "normal",
        "normalize": True
    }

    # 优先使用传入的 voice_id，其次使用角色配置中的 tts_voice_id
    effective_voice_id = voice_id or config_data.get("tts_voice_id", "")
    if effective_voice_id and str(effective_voice_id).strip():
        payload["reference_id"] = str(effective_voice_id).strip()

    try:
        print(f"[TTS FISH AUDIO] 发送 TTS 请求 ({len(clean_text)} 字)...")
        response = requests.post(base_url, headers=headers, json=payload, timeout=25)
        
        if response.status_code == 200:
            audio_bytes = response.content
            print(f"[TTS FISH AUDIO] 成功合成音频: {len(audio_bytes)} 字节")
            return True, audio_bytes, None
        else:
            err_msg = f"Fish Audio API 响应错误 ({response.status_code}): {response.text}"
            print(f"[TTS FISH AUDIO ERROR] {err_msg}")
            return False, None, err_msg
    except Exception as ex:
        err_msg = f"Fish Audio 请求异常: {str(ex)}"
        print(f"[TTS FISH AUDIO EXCEPTION] {err_msg}")
        return False, None, err_msg

def synthesize_and_cache_audio(text: str, char_id: Optional[str] = None, voice_id: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
    """合成语音并存入本地缓存，返回缓存音频的相对访问路径 /api/tts/audio/{hash}.mp3"""
    clean_text = clean_text_for_speech(text)
    if not clean_text:
        return False, None, "文本为空"

    active_char = char_id or get_active_character_id()
    config_data = get_config()
    effective_voice_id = voice_id or config_data.get("tts_voice_id", "")

    # 计算哈希指纹
    hash_key = f"{active_char}_{effective_voice_id}_{clean_text}"
    file_hash = hashlib.md5(hash_key.encode('utf-8')).hexdigest()
    cache_file = os.path.join(TTS_CACHE_DIR, f"{file_hash}.mp3")

    # 如果缓存已存在，直接命中返回
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1024:
        print(f"[TTS CACHE HIT] 命中语音缓存: {file_hash}.mp3")
        return True, f"/api/tts/audio/{file_hash}.mp3", None

    # 调用合成器
    success, audio_bytes, error = generate_speech_fish_audio(clean_text, voice_id=effective_voice_id)
    if not success or not audio_bytes:
        return False, None, error

    try:
        with open(cache_file, "wb") as f:
            f.write(audio_bytes)
        return True, f"/api/tts/audio/{file_hash}.mp3", None
    except Exception as e:
        return False, None, f"缓存写入失败: {e}"
