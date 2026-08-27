import os
import sys
import subprocess
import time
import re
import hashlib
import requests
import asyncio
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

    # 4. 移除方括号元数据标签: [normal]、[angry]、[12]、[SLEEP_NOW] 等
    cleaned = re.sub(r'\[[^\]]*\]', '', cleaned)

    # 5. 去除多余标点与空白
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # 如果清洗后全空（例如整句只是动作描写），则退回原文本去除标签后的内容
    if not cleaned:
        fallback = re.sub(r'\[[^\]]*\]', '', text)
        cleaned = re.sub(r'</?[^>]+>', '', fallback).strip()

    return cleaned

def strip_all_bracket_tags(text: str) -> str:
    """去除发音标签如 [happy], [pitch up]，仅供不支持该标签的传统引擎 (如 Edge TTS / OpenAI) 朗读"""
    if not text:
        return ""
    cleaned = re.sub(r'\[[^\]]+\]', '', text)
    return re.sub(r'\s+', ' ', cleaned).strip()

def refine_text_with_post_llm_prosody(
    text: str,
    emotion: str = "normal",
    target_lang: str = "zh",
    char_name: str = "桌宠",
    persona: str = ""
) -> str:
    """使用 Post-LLM 将对白翻译为目标语种 (中/日/英)，并插入 Fish Audio S2 情绪音调标签 [pitch up], [happy], [whisper] 等"""
    clean_text = clean_text_for_speech(text)
    if not clean_text:
        return ""

    from langchain_core.messages import SystemMessage, HumanMessage
    from graph.nodes import call_model_with_fallback

    lang_desc_map = {
        "zh": "保持中文原声对白（不要翻译为外语）",
        "ja": "翻译为极其纯正、符合该角色性格人设的口语日文（使用平假名/片假名/汉字，动漫角色语气，例如傲娇、萌系或元气）",
        "en": "翻译为纯正、符合该角色性格人设的口语英文（动漫英配或日常口语风）"
    }
    lang_instruction = lang_desc_map.get(target_lang, lang_desc_map["zh"])

    system_prompt = (
        "【角色语音情感精修与语种翻译引擎 (TTS Prosody Engine)】\n"
        f"你是一个专为二次元桌宠角色【{char_name}】服务的语音台词精修大师。\n"
        f"角色人设背景：{persona}\n"
        f"当前对话情绪：[{emotion}]\n"
        f"目标朗读语种：{lang_instruction}\n\n"
        "【任务要求】\n"
        "1. 仅输出供 TTS 朗读的最终台词文本，禁止包含任何思考过程、解释、引号或 Markdown 格式。\n"
        "2. 语言转换：按照目标朗读语种要求输出（若为日文/英文，请地道翻译并契合角色口癖与语气；若为中文，保留原口语）。\n"
        "3. 注入 Fish Audio S2 情绪与音调方括号标签 [tag]（若使用其他引擎系统会自动兼容过滤）：\n"
        "   - 支持的标签包括：[happy], [sad], [angry], [excited], [whisper], [pitch up], [pitch down], [speaking slowly], [speaking fast], [soft tone], [laughing], [sighing], [giggle], [long pause] 等。\n"
        "   - 请根据句子的起伏与情感，在句子开头或重点词句前合理插入 1~2 个标签，使发音充满灵魂与起伏（例如：`[pitch up] [happy] 早上好呀！` 或 `[whisper] [soft tone] べ、別にアンタのためじゃないんだからね！`）。\n"
        "4. 绝对不要输出动作描写括号（如 `(微笑)` 或 `（脸红）`），只输出纯口语与 [tag] 音调标签。"
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"原始角色对白：{clean_text}")
    ]

    try:
        config_data = get_config()
        provider = config_data.get("post_api_provider", "inherit")
        response = call_model_with_fallback(messages, provider_override=provider, node_name="POST-LLM-TTS")
        refined = response.content.strip()
        # 清理可能误带的反引号或包裹
        refined = re.sub(r'^```[a-zA-Z]*\n', '', refined)
        refined = re.sub(r'\n```$', '', refined).strip()
        # 清理可能残留的思维链
        refined = re.sub(r'<(?:think|character_thought|thought)[^>]*>.*?</(?:think|character_thought|thought)>', '', refined, flags=re.DOTALL | re.IGNORECASE).strip()
        refined = re.sub(r'</?[^>]+>', '', refined).strip()
        # 移除普通动作括号
        refined = re.sub(r'（[^）]*）', '', refined)
        refined = re.sub(r'\([^\)]*\)', '', refined).strip()
        if refined:
            print(f"[TTS PROSODY REFINED] 原始: '{clean_text}' -> 精修({target_lang}): '{refined}'")
            return refined
    except Exception as ex:
        print(f"[TTS PROSODY POST-LLM WARN] Post-LLM 精修失败，回退至基础规则: {ex}")

    # 降级回退：基础情绪标签注标
    fallback_tag = ""
    if emotion == "angry":
        fallback_tag = "[angry] [pitch up] "
    elif emotion == "shy":
        fallback_tag = "[whisper] [soft tone] "
    elif emotion == "crying":
        fallback_tag = "[sad] [sighing] "
    elif emotion == "normal":
        fallback_tag = "[soft tone] "
    return f"{fallback_tag}{clean_text}".strip()

# 1. Fish Audio 驱动
def generate_speech_fish_audio(styled_text: str, voice_id: Optional[str] = None) -> Tuple[bool, Optional[bytes], Optional[str]]:
    """调用 Fish Audio TTS 官方 API 生成 MP3 音频流"""
    if not styled_text or not str(styled_text).strip():
        return False, None, "没有可朗读的有效文本内容"

    config_data = get_config()
    api_key = config_data.get("tts_api_key") or config_data.get("fish_audio_api_key") or os.getenv("FISH_AUDIO_API_KEY", "").strip()
    base_url = config_data.get("tts_base_url") or config_data.get("fish_audio_base_url") or os.getenv("FISH_AUDIO_BASE_URL", "https://api.fish.audio/v1/tts").strip()

    if not api_key:
        return False, None, "未配置 Fish Audio API Key (请在控制台或 .env 中设置)"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "text": styled_text.strip(),
        "format": "mp3",
        "latency": "normal",
        "normalize": True
    }

    if voice_id and str(voice_id).strip():
        vid = str(voice_id).strip()
        # 仅当 voice_id 匹配 32 位 hex ID 时才作为 Fish Audio reference_id 传入，防止误传 Edge-TTS 预设音色名导致 400 报错
        if re.match(r'^[a-f0-9]{32}$', vid, re.I):
            payload["reference_id"] = vid

    try:
        print(f"[TTS FISH AUDIO] 发送 TTS 请求 (长度: {len(styled_text)}): {styled_text}")
        response = requests.post(base_url, headers=headers, json=payload, timeout=12)
        
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

# 2. Edge TTS 免费微软云端语音驱动 (免 Key)
def generate_speech_edge_tts(styled_text: str, voice_id: Optional[str] = None, language: str = "zh") -> Tuple[bool, Optional[bytes], Optional[str]]:
    """使用微软 Edge-TTS 免费生成高保真自然语音"""
    clean_text = strip_all_bracket_tags(styled_text)
    if not clean_text:
        return False, None, "没有可朗读的有效文本内容"

    try:
        import edge_tts
    except ImportError:
        return False, None, "未安装 edge-tts 依赖库 (请运行 pip install edge-tts)"

    # 默认音色映射
    default_voices = {
        "zh": "zh-CN-XiaoxiaoNeural", # 晓晓 (女，极自然)
        "ja": "ja-JP-NanamiNeural",   # 七海 (女，日文动漫风)
        "en": "en-US-AnaNeural"       # Ana (女，美式自然口语)
    }
    lang_key = language.lower() if language else "zh"
    target_voice = default_voices.get(lang_key, "zh-CN-XiaoxiaoNeural")

    # 仅当 voice_id 属于有效 Edge-TTS 音色名（以语言前缀开头且包含 Neural，排查本地音频文件路径和其它TTS ID）
    if voice_id and isinstance(voice_id, str):
        is_path = "/" in voice_id or "\\" in voice_id or voice_id.lower().endswith((".wav", ".mp3", ".ogg", ".flac", ".m4a"))
        if not is_path and ("Neural" in voice_id or voice_id.startswith(("zh-", "ja-", "en-", "ko-"))) and not re.match(r'^[a-f0-9]{32}$', voice_id, re.I):
            target_voice = voice_id

    async def _async_generate() -> bytes:
        communicate = edge_tts.Communicate(clean_text, target_voice)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        return b"".join(audio_chunks)

    try:
        print(f"[TTS EDGE-TTS] 使用微软云端语音 ({target_voice}) 朗读: {clean_text}")
        audio_bytes = asyncio.run(_async_generate())
        if audio_bytes and len(audio_bytes) > 0:
            print(f"[TTS EDGE-TTS] 成功合成音频: {len(audio_bytes)} 字节")
            return True, audio_bytes, None
        return False, None, "Edge-TTS 未返回音频数据"
    except Exception as ex:
        err_msg = f"Edge-TTS 合成异常: {str(ex)}"
        print(f"[TTS EDGE-TTS ERROR] {err_msg}")
        return False, None, err_msg

# 3. OpenAI / 硅基流动 / 阶跃星辰 / 智谱兼容 Speech API 驱动
def generate_speech_openai_compatible(
    styled_text: str,
    voice_id: Optional[str] = None,
    language: str = "zh"
) -> Tuple[bool, Optional[bytes], Optional[str]]:
    """调用 OpenAI 兼容规范 (/v1/audio/speech) 生成语音 (支持 OpenAI、SiliconFlow、StepFun、智谱等)"""
    clean_text = strip_all_bracket_tags(styled_text)
    if not clean_text:
        return False, None, "没有可朗读的有效文本内容"

    config_data = get_config()
    api_key = config_data.get("tts_api_key") or os.getenv("TTS_API_KEY", "").strip()
    base_url = (config_data.get("tts_base_url") or "https://api.siliconflow.cn/v1/audio/speech").strip()
    model_name = (config_data.get("tts_model_name") or "FunAudioLLM/CosyVoice2-0.5B").strip()

    # 规范化 URL 路径
    if not base_url.endswith("/speech") and not base_url.endswith("/audio/speech"):
        if base_url.endswith("/v1"):
            base_url = f"{base_url}/audio/speech"
        elif base_url.endswith("/v1/"):
            base_url = f"{base_url}audio/speech"

    target_voice = voice_id or "alex" # 硅基流动与OpenAI常见默认音色

    headers = {
        "Content-Type": "application/json"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model_name,
        "input": clean_text,
        "voice": target_voice,
        "response_format": "mp3"
    }

    try:
        print(f"[TTS OPENAI-COMPATIBLE] 请求 {base_url} (模型: {model_name}, 音色: {target_voice}): {clean_text}")
        response = requests.post(base_url, headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            audio_bytes = response.content
            print(f"[TTS OPENAI-COMPATIBLE] 成功合成音频: {len(audio_bytes)} 字节")
            return True, audio_bytes, None
        else:
            err_msg = f"OpenAI 兼容 API 错误 ({response.status_code}): {response.text}"
            print(f"[TTS OPENAI ERROR] {err_msg}")
            return False, None, err_msg
    except Exception as ex:
        err_msg = f"OpenAI 兼容 API 请求异常: {str(ex)}"
        print(f"[TTS OPENAI EXCEPTION] {err_msg}")
        return False, None, err_msg

# 4. GPT-SoVITS 本地 / 云端 Fast-Inference API 驱动
def ensure_gpt_sovits_process() -> bool:
    """自动检测并静默拉起本地 GPT-SoVITS 语音服务，免除用户手动启动的繁琐"""
    try:
        r = requests.get("http://127.0.0.1:9880/control", timeout=0.8)
        if r.status_code in [200, 400]:
            return True
    except Exception:
        pass

    known_dirs = [
        r"E:\ai\GPT-SoVITS-v2pro-20250604",
        r"D:\ai\GPT-SoVITS-v2pro-20250604",
        r"C:\ai\GPT-SoVITS-v2pro-20250604"
    ]
    for gdir in known_dirs:
        py_exe = os.path.join(gdir, "runtime", "python.exe")
        api_py = os.path.join(gdir, "api_v2.py")
        if os.path.exists(py_exe) and os.path.exists(api_py):
            try:
                print(f"[TTS GPT-SOVITS] 检测到本地语音服务未运行，正在静默自动拉起: {gdir}")
                creationflags = 0
                if sys.platform == "win32":
                    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
                cmd = [
                    py_exe, "-I", "api_v2.py",
                    "-a", "127.0.0.1",
                    "-p", "9880",
                    "-c", "GPT_SoVITS/configs/tts_infer.yaml"
                ]
                subprocess.Popen(cmd, cwd=gdir, creationflags=creationflags)
                for _ in range(12):
                    time.sleep(1.0)
                    try:
                        r = requests.get("http://127.0.0.1:9880/control", timeout=0.5)
                        if r.status_code in [200, 400]:
                            print("[TTS GPT-SOVITS] 本地语音服务已自动拉起并就绪！")
                            return True
                    except Exception:
                        pass
            except Exception as e:
                print(f"[TTS GPT-SOVITS] 自动拉起异常: {e}")
            break
    return False

def generate_speech_gpt_sovits(
    styled_text: str,
    voice_id: Optional[str] = None,
    language: str = "zh"
) -> Tuple[bool, Optional[bytes], Optional[str]]:
    """调用 GPT-SoVITS 本地/云端 WebUI 接口生成语音"""
    ensure_gpt_sovits_process()

    clean_text = strip_all_bracket_tags(styled_text)
    if not clean_text:
        return False, None, "没有可朗读的有效文本内容"

    config_data = get_config()
    base_url = (config_data.get("tts_base_url") or "http://127.0.0.1:9880/tts").strip()
    if not base_url.endswith("/tts"):
        base_url = f"{base_url.rstrip('/')}/tts"

    lang_map = { "zh": "zh", "ja": "ja", "en": "en" }
    target_lang = lang_map.get(language.lower(), "zh")

    ref_audio = voice_id or ""
    # 自动探测有效参考音频
    if not ref_audio or not os.path.exists(ref_audio):
        candidates = [
            r"E:\ai\GPT-SoVITS-v2pro-20250604\ref_audio\koishi\koishi_ref_1.wav",
            os.path.abspath(r"services\characters\koishi\voice_reference\koishi_ref_1.wav")
        ]
        for c in candidates:
            if os.path.exists(c):
                ref_audio = c
                break

    if not ref_audio or not os.path.exists(ref_audio):
        return False, None, "GPT-SoVITS 缺少有效参考音频 (ref_audio_path)"

    prompt_text = ""
    prompt_lang = "zh"
    if "koishi_ref_1" in ref_audio:
        prompt_text = "我是古明地恋哦，你也是来地灵殿找我玩的吗？"
        prompt_lang = "zh"
    elif "koishi_ref_2" in ref_audio:
        prompt_text = "闭上第三只眼之后，就能去任何想去的地方啦！"
        prompt_lang = "zh"
    elif "koishi_ref_3" in ref_audio:
        prompt_text = "无意识的感觉，其实很轻松自在呢～"
        prompt_lang = "zh"
    else:
        prompt_lang = target_lang

    payload = {
        "text": clean_text,
        "text_lang": target_lang,
        "ref_audio_path": ref_audio,
        "prompt_text": prompt_text,
        "prompt_lang": prompt_lang,
        "media_type": "wav",
        "streaming_mode": False
    }

    try:
        print(f"[TTS GPT-SOVITS] 请求本地接口 {base_url} (语种: {target_lang}, 音频: {os.path.basename(ref_audio)}): {clean_text}")
        response = requests.post(base_url, json=payload, timeout=35)
        if response.status_code == 200 and len(response.content) > 0:
            audio_bytes = response.content
            print(f"[TTS GPT-SOVITS] 成功合成音频: {len(audio_bytes)} 字节")
            return True, audio_bytes, None
        else:
            # 降级尝试 GET
            response_get = requests.get(base_url, params=payload, timeout=35)
            if response_get.status_code == 200 and len(response_get.content) > 0:
                return True, response_get.content, None
            return False, None, f"GPT-SoVITS 响应错误 ({response.status_code}): {response.text}"
    except Exception as ex:
        return False, None, f"GPT-SoVITS 连接失败: {str(ex)}"

# 5. 通用 HTTP 自定义接口驱动
def generate_speech_custom_http(
    styled_text: str,
    voice_id: Optional[str] = None
) -> Tuple[bool, Optional[bytes], Optional[str]]:
    """调用通用自定义 HTTP POST 音频接口"""
    clean_text = strip_all_bracket_tags(styled_text)
    if not clean_text:
        return False, None, "没有可朗读的有效文本内容"

    config_data = get_config()
    base_url = (config_data.get("tts_base_url") or "").strip()
    api_key = (config_data.get("tts_api_key") or "").strip()

    if not base_url:
        return False, None, "未配置自定义 TTS 接口地址 (Base URL)"

    headers = { "Content-Type": "application/json" }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "text": clean_text,
        "voice": voice_id or "",
        "format": "mp3"
    }

    try:
        response = requests.post(base_url, headers=headers, json=payload, timeout=30)
        if response.status_code == 200:
            return True, response.content, None
        return False, None, f"自定义接口返回错误 ({response.status_code}): {response.text}"
    except Exception as ex:
        return False, None, f"自定义接口请求异常: {str(ex)}"

# --- 核心调度器 ---
def dispatch_speech_synthesis(styled_text: str, voice_id: Optional[str] = None, language: str = "zh") -> Tuple[bool, Optional[bytes], Optional[str]]:
    """根据系统配置的 TTS 提供商统一分发合成请求，未配置接口或配置无效时默认使用 Edge-TTS 微软女声"""
    config_data = get_config()
    provider = (config_data.get("tts_provider") or "edge_tts").lower().strip()

    # 1. 明确使用或默认使用 Edge-TTS (免 Key 微软高保真女声)
    if provider in ["edge_tts", "edge", "microsoft", "default", "none", ""]:
        return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)

    # 2. Fish Audio (若未填 Key 或请求失败则自动回退至 Edge-TTS 女声)
    elif provider in ["fish_audio", "fish"]:
        api_key = config_data.get("tts_api_key") or config_data.get("fish_audio_api_key") or os.getenv("FISH_AUDIO_API_KEY", "").strip()
        if not api_key:
            print("[TTS FALLBACK] 未设置 Fish Audio API Key，自动切换为默认 Edge-TTS 微软女声")
            return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)
        success, audio_bytes, error = generate_speech_fish_audio(styled_text, voice_id=voice_id)
        if not success or not audio_bytes:
            print(f"[TTS FALLBACK] Fish Audio 无法合成 ({error})，自动降级为 Edge-TTS 微软女声")
            return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)
        return success, audio_bytes, error

    # 3. OpenAI / 硅基流动 / 阶跃星辰等 (若失败自动回退至 Edge-TTS 女声)
    elif provider in ["openai", "siliconflow", "stepfun", "zhipu", "custom_openai", "openai_compatible"]:
        success, audio_bytes, error = generate_speech_openai_compatible(styled_text, voice_id=voice_id, language=language)
        if not success or not audio_bytes:
            print(f"[TTS FALLBACK] OpenAI 兼容接口失败 ({error})，自动降级为 Edge-TTS 微软女声")
            return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)
        return success, audio_bytes, error

    # 4. GPT-SoVITS (若本地服务未启动则自动回退至 Edge-TTS 女声)
    elif provider in ["gpt_sovits", "gpt-sovits", "sovits"]:
        success, audio_bytes, error = generate_speech_gpt_sovits(styled_text, voice_id=voice_id, language=language)
        if not success or not audio_bytes:
            print(f"[TTS FALLBACK] GPT-SoVITS 连接失败 ({error})，自动降级为 Edge-TTS 微软女声")
            return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)
        return success, audio_bytes, error

    # 5. 通用 HTTP 自定义接口
    elif provider in ["custom_http", "custom"]:
        success, audio_bytes, error = generate_speech_custom_http(styled_text, voice_id=voice_id)
        if not success or not audio_bytes:
            print(f"[TTS FALLBACK] 自定义接口失败 ({error})，自动降级为 Edge-TTS 微软女声")
            return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)
        return success, audio_bytes, error

    # 其他所有情况一律默认回退至 Edge-TTS 女声
    else:
        return generate_speech_edge_tts(styled_text, voice_id=voice_id, language=language)

def synthesize_and_cache_audio(
    text: str,
    char_id: Optional[str] = None,
    emotion: str = "normal",
    language: Optional[str] = None,
    voice_id: Optional[str] = None,
    skip_refine: bool = False
) -> Tuple[bool, Optional[str], Optional[str]]:
    """合成语音并存入本地缓存，返回缓存音频的相对访问路径 /api/tts/audio/{hash}.mp3"""
    raw_clean = clean_text_for_speech(text)
    if not raw_clean:
        return False, None, "文本为空"

    active_char = char_id or get_active_character_id()
    config_data = get_config()
    provider = (config_data.get("tts_provider") or "edge_tts").lower().strip()
    char_name = config_data.get("character_name", "桌宠")
    persona = config_data.get("persona_prompt", "")
    
    # 确定目标语言与对应音色 ID
    target_lang = (language or config_data.get("tts_language") or "zh").lower()
    
    # 根据语言获取对应音色 ID
    effective_voice_id = voice_id
    if not effective_voice_id:
        if target_lang == "ja":
            effective_voice_id = config_data.get("tts_voice_ja") or config_data.get("tts_voice_id", "")
        elif target_lang == "en":
            effective_voice_id = config_data.get("tts_voice_en") or config_data.get("tts_voice_id", "")
        else:
            effective_voice_id = config_data.get("tts_voice_zh") or config_data.get("tts_voice_id", "")

    # 针对不同引擎智能适配音色 ID 格式，彻底防止跨引擎格式冲突
    if provider in ["fish_audio", "fish"]:
        if effective_voice_id and not re.match(r'^[a-f0-9]{32}$', str(effective_voice_id).strip(), re.I):
            # 若当前语言音色非 32 位 hex (如误存了 Edge 音色名)，优先尝试角色主 tts_voice_id
            main_vid = str(config_data.get("tts_voice_id", "")).strip()
            effective_voice_id = main_vid if re.match(r'^[a-f0-9]{32}$', main_vid, re.I) else None
    elif provider in ["edge_tts", "edge", "microsoft", "default", "none", ""]:
        if effective_voice_id and re.match(r'^[a-f0-9]{32}$', str(effective_voice_id).strip(), re.I):
            # 若传入的是 32 位 Fish ID，Edge-TTS 自动忽略并采用内置动漫推荐音色
            effective_voice_id = None

    # 执行 Post-LLM 精修 (翻译 + 注入情绪音调标签)
    if not skip_refine:
        styled_text = refine_text_with_post_llm_prosody(
            raw_clean,
            emotion=emotion,
            target_lang=target_lang,
            char_name=char_name,
            persona=persona
        )
    else:
        styled_text = raw_clean

    if not styled_text:
        styled_text = raw_clean

    # 计算哈希指纹 (将 provider 纳入 hash 防止切换服务商时冲突)
    hash_key = f"{provider}_{active_char}_{target_lang}_{effective_voice_id}_{styled_text}"
    file_hash = hashlib.md5(hash_key.encode('utf-8')).hexdigest()
    cache_file = os.path.join(TTS_CACHE_DIR, f"{file_hash}.mp3")

    # 如果缓存已存在，直接命中返回
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1024:
        print(f"[TTS CACHE HIT] 命中语音缓存 ({provider}): {file_hash}.mp3")
        return True, f"/api/tts/audio/{file_hash}.mp3", None

    # 通过调度器统一合成
    success, audio_bytes, error = dispatch_speech_synthesis(styled_text, voice_id=effective_voice_id, language=target_lang)
    if not success or not audio_bytes:
        return False, None, error

    try:
        with open(cache_file, "wb") as f:
            f.write(audio_bytes)
        return True, f"/api/tts/audio/{file_hash}.mp3", None
    except Exception as e:
        return False, None, f"缓存写入失败: {e}"
