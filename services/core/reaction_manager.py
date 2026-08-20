import os
import json
import hashlib
import shutil
import threading
import time
from typing import Dict, List, Optional, Tuple, Any

from core.llm_client import get_llm_client_and_model
from core.config_manager import get_config

REACTIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "characters")
DEFAULT_EMOTIONS = ["normal", "angry", "crying", "shy", "sleeping"]

def get_reactions_dir(char_id: str) -> str:
    char_dir = os.path.join(REACTIONS_DIR, char_id)
    os.makedirs(char_dir, exist_ok=True)
    return char_dir

def get_reactions_file(char_id: str) -> str:
    char_dir = get_reactions_dir(char_id)
    return os.path.join(char_dir, "reactions.json")

def get_reactions_audio_dir(char_id: str) -> str:
    audio_dir = os.path.join(get_reactions_dir(char_id), "reactions_audio")
    os.makedirs(audio_dir, exist_ok=True)
    return audio_dir

def get_reaction_audio_hash(emotion: str, text: str) -> str:
    """计算单句应付词音频的确定性唯一哈希指纹"""
    raw_key = f"{emotion.strip().lower()}_{text.strip()}"
    return hashlib.md5(raw_key.encode('utf-8')).hexdigest()

def get_reaction_audio_file(char_id: str, emotion: str, text: str) -> Optional[str]:
    """获取应付词本地离线音频文件路径 (若存在)"""
    file_hash = get_reaction_audio_hash(emotion, text)
    audio_dir = get_reactions_audio_dir(char_id)
    audio_file = os.path.join(audio_dir, f"{file_hash}.mp3")
    if os.path.exists(audio_file) and os.path.getsize(audio_file) > 512:
        return audio_file
    return None

def get_reaction_audio_url(char_id: str, emotion: str, text: str) -> Optional[str]:
    """获取应付词本地音频可访问 URL"""
    if get_reaction_audio_file(char_id, emotion, text):
        file_hash = get_reaction_audio_hash(emotion, text)
        return f"/api/pet_reactions/audio_file/{char_id}/{file_hash}.mp3"
    return None

def save_reaction_audio_file(char_id: str, emotion: str, text: str, audio_bytes: bytes) -> str:
    """持久化保存单句应付词音频流"""
    file_hash = get_reaction_audio_hash(emotion, text)
    audio_dir = get_reactions_audio_dir(char_id)
    audio_file = os.path.join(audio_dir, f"{file_hash}.mp3")
    with open(audio_file, "wb") as f:
        f.write(audio_bytes)
    return f"/api/pet_reactions/audio_file/{char_id}/{file_hash}.mp3"

def load_reactions(char_id: str) -> Optional[Dict[str, List[str]]]:
    file_path = get_reactions_file(char_id)
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[REACTION] Failed to load reactions: {e}")

    # 备选回退：检查角色目录下的 reactions.json (支持角色包解压或初始内置)
    try:
        from core.config_manager import USER_DATA_DIR, SERVICES_DIR
        for base in [USER_DATA_DIR, SERVICES_DIR]:
            fallback = os.path.join(base, "characters", char_id, "reactions.json")
            if os.path.exists(fallback):
                with open(fallback, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    save_reactions(char_id, data)
                    return data
    except Exception:
        pass

    return None

def save_reactions(char_id: str, data: Dict[str, List[str]]):
    file_path = get_reactions_file(char_id)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[REACTION] Failed to save reactions: {e}")

def get_reactions_detail(char_id: str) -> Dict[str, List[Dict[str, Any]]]:
    """获取附带离线音频状态的应付词完整明细结构"""
    data = load_reactions(char_id) or {e: [] for e in DEFAULT_EMOTIONS}
    detail = {}
    for emotion in DEFAULT_EMOTIONS:
        lines = data.get(emotion, [])
        detail[emotion] = []
        for line in lines:
            audio_url = get_reaction_audio_url(char_id, emotion, line)
            detail[emotion].append({
                "text": line,
                "has_audio": bool(audio_url),
                "audio_url": audio_url
            })
    return detail

def append_reaction(char_id: str, emotion: str, text: str):
    data = load_reactions(char_id) or {e: [] for e in DEFAULT_EMOTIONS}
    if emotion not in data:
        data[emotion] = []
    
    # Avoid duplicates
    if text not in data[emotion]:
        data[emotion].append(text)
        if len(data[emotion]) > 50:
            data[emotion].pop(0)
        save_reactions(char_id, data)

def remove_reaction(char_id: str, emotion: str, text: str) -> bool:
    data = load_reactions(char_id)
    if not data:
        return False
    if emotion in data and text in data[emotion]:
        data[emotion].remove(text)
        save_reactions(char_id, data)
        # 清理对应的本地离线音频
        audio_file = get_reaction_audio_file(char_id, emotion, text)
        if audio_file and os.path.exists(audio_file):
            try:
                os.remove(audio_file)
            except Exception:
                pass
        return True
    return False

def record_single_reaction_audio(
    char_id: str,
    emotion: str,
    text: str,
    skip_refine: bool = False
) -> Tuple[bool, Optional[str], Optional[str]]:
    """生成并录制单句应付词音频到本地"""
    from core.tts_client import synthesize_and_cache_audio, TTS_CACHE_DIR
    success, audio_url, err = synthesize_and_cache_audio(
        text,
        emotion=emotion,
        char_id=char_id,
        skip_refine=skip_refine
    )
    if not success or not audio_url:
        return False, None, err

    # 提取生成出的 mp3 文件名并复制到 reactions_audio
    filename = os.path.basename(audio_url)
    cache_mp3 = os.path.join(TTS_CACHE_DIR, filename)
    if os.path.exists(cache_mp3):
        try:
            with open(cache_mp3, "rb") as f:
                audio_bytes = f.read()
            local_url = save_reaction_audio_file(char_id, emotion, text, audio_bytes)
            return True, local_url, None
        except Exception as e:
            return False, None, f"转存离线音频失败: {e}"
    
    return True, audio_url, None

# =========================================================================
# 批量录制后台任务管理器 (Batch Voice Recording Pipeline)
# =========================================================================

class ReactionBatchRecorder:
    def __init__(self):
        self._lock = threading.Lock()
        self.is_running = False
        self.char_id = ""
        self.total = 0
        self.completed = 0
        self.current_emotion = ""
        self.current_text = ""
        self.errors = []
        self.stop_requested = False
        self._thread: Optional[threading.Thread] = None

    def start_batch(self, char_id: str, force_overwrite: bool = False) -> Tuple[bool, str]:
        with self._lock:
            if self.is_running:
                return False, "批量录制任务正在进行中，请勿重复启动"

            data = load_reactions(char_id) or {}
            all_items = []
            for e in DEFAULT_EMOTIONS:
                for text in data.get(e, []):
                    if force_overwrite or not get_reaction_audio_file(char_id, e, text):
                        all_items.append((e, text))

            if not all_items:
                return False, "所有应付词均已录制完成，无需重复生成"

            self.is_running = True
            self.char_id = char_id
            self.total = len(all_items)
            self.completed = 0
            self.errors = []
            self.stop_requested = False
            self.current_emotion = ""
            self.current_text = ""

            def _worker():
                print(f"[BATCH RECORDER] 开始为 {char_id} 批量录制 {len(all_items)} 句应付词语音...")
                for emotion, text in all_items:
                    if self.stop_requested:
                        print("[BATCH RECORDER] 收到中止请求，批量录制停止。")
                        break

                    self.current_emotion = emotion
                    self.current_text = text
                    print(f"[BATCH RECORDER] [{self.completed + 1}/{self.total}] ({emotion}) 正在录制: '{text}'")

                    try:
                        succ, _, err = record_single_reaction_audio(char_id, emotion, text)
                        if not succ:
                            self.errors.append(f"[{emotion}] '{text}': {err}")
                    except Exception as ex:
                        self.errors.append(f"[{emotion}] '{text}': {str(ex)}")

                    self.completed += 1
                    time.sleep(0.3) # 间隔防止高频请求限制

                self.is_running = False
                self.current_emotion = ""
                self.current_text = ""
                print(f"[BATCH RECORDER] 批量录制完成: 成功 {self.completed - len(self.errors)}/{self.total}, 失败 {len(self.errors)}")

            self._thread = threading.Thread(target=_worker, daemon=True)
            self._thread.start()
            return True, "批量录制任务已启动"

    def stop_batch(self):
        with self._lock:
            if self.is_running:
                self.stop_requested = True

    def get_progress(self) -> Dict[str, Any]:
        with self._lock:
            percent = int((self.completed / self.total) * 100) if self.total > 0 else (100 if not self.is_running else 0)
            return {
                "is_running": self.is_running,
                "char_id": self.char_id,
                "total": self.total,
                "completed": self.completed,
                "percent": percent,
                "current_emotion": self.current_emotion,
                "current_text": self.current_text,
                "errors": self.errors
            }

batch_recorder = ReactionBatchRecorder()

def generate_initial_reactions(char_id: str):
    """Generate the initial 5x5 reaction library using LLM"""
    client, model_name = get_llm_client_and_model()
    config = get_config()
    char_name = config.get("character_name", "桌宠")
    char_persona = config.get("priority_reminder", "")
    
    prompt = (
        f"你现在的角色设定是：\n{char_persona}\n\n"
        f"请为你自己（{char_name}）生成一套用于桌面宠物互动的“被点击反应短句库”。\n"
        f"当用户用鼠标点击你时，你会随机说出这些短句。\n"
        f"必须为以下5种心情各生成5句短句，语气必须极度符合你的人设，口语化，自然，字数尽量短（10字以内最佳）：\n"
        f"1. normal (正常状态，例如：“怎么啦？”、“别戳啦”)\n"
        f"2. angry (生气状态，例如：“别烦我！”、“走开！”)\n"
        f"3. crying (委屈/哭泣状态，例如：“呜呜...干嘛欺负我...”、“好痛...”)\n"
        f"4. shy (害羞状态，例如：“哎呀，别这样...”、“不要盯着我看啦...”)\n"
        f"5. sleeping (睡觉状态，例如：“呼...Zzz”、“好困...别吵...”)\n\n"
        f"请严格返回一段合法的 JSON，不要输出任何其他说明文字，格式如下：\n"
        f"{{\n"
        f"  \"normal\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"angry\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"crying\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"shy\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"sleeping\": [\"...\", \"...\", \"...\", \"...\", \"...\"]\n"
        f"}}"
    )
    
    try:
        from core.llm_client import get_safe_temperature
        print(f"[REACTION] 正在为 {char_id} 初始生成 5x5 词库...")
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=get_safe_temperature(model_name, 0.8),
                max_tokens=2000
            )
        except Exception as api_err:
            err_str = str(api_err).lower()
            if "temperature" in err_str and ("only 1" in err_str or "must be 1" in err_str or "invalid temperature" in err_str):
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=1.0,
                    max_tokens=2000
                )
            else:
                raise api_err
        content = response.choices[0].message.content.strip()
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            new_data = json.loads(match.group(0))
            existing_data = load_reactions(char_id) or {e: [] for e in DEFAULT_EMOTIONS}
            for e in DEFAULT_EMOTIONS:
                if e not in existing_data:
                    existing_data[e] = []
                if e in new_data and isinstance(new_data[e], list):
                    for text in new_data[e]:
                        if text not in existing_data[e]:
                            existing_data[e].append(text)
            
            save_reactions(char_id, existing_data)
            print(f"[REACTION] 初始 5x5 词库补全完毕并保存。")
            return existing_data
    except Exception as e:
        print(f"[REACTION] 生成初始词库失败: {e}")
    
    return None

def trigger_initial_generation_async(char_id: str):
    def worker():
        generate_initial_reactions(char_id)
    t = threading.Thread(target=worker)
    t.daemon = True
    t.start()
