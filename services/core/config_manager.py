import os
import json
import shutil
import sys

# 设置 HuggingFace 国内镜像与离线模式，彻底屏绝 WinError 10060 网络超时错误
os.environ["HF_ENDPOINT"] = os.getenv("HF_ENDPOINT", "https://hf-mirror.com")
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# 获取真实的软件便携根目录 (Portable Directory)
if getattr(sys, 'frozen', False):
    APP_DIR = os.path.dirname(os.path.abspath(sys.executable))
    if os.path.basename(APP_DIR).lower() in ["backend", "bin", "dist"]:
        parent_dir = os.path.dirname(APP_DIR)
        if os.path.basename(parent_dir).lower() == "resources":
            APP_DIR = os.path.dirname(parent_dir)
        elif os.path.exists(os.path.join(parent_dir, "services")):
            APP_DIR = parent_dir
    SERVICES_DIR = os.path.join(APP_DIR, "services") if os.path.exists(os.path.join(APP_DIR, "services")) else APP_DIR
else:
    SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 统一便携化 (Portable Mode)：所有日记、记忆、角色配置就近存放在软件自身目录，彻底告别 AppData 碎片化
USER_DATA_DIR = SERVICES_DIR

# 绑定本地内嵌 HuggingFace 缓存路径
LOCAL_MODELS_DIR = os.path.join(USER_DATA_DIR, "models")
os.environ["HF_HOME"] = os.getenv("HF_HOME", LOCAL_MODELS_DIR)

def init_user_data_dir():
    """初始化便携目录，并自动从旧版 AppData 无损迁移历史日记与记忆"""
    try:
        os.makedirs(USER_DATA_DIR, exist_ok=True)
        os.makedirs(os.path.join(USER_DATA_DIR, "logs"), exist_ok=True)
        os.makedirs(LOCAL_MODELS_DIR, exist_ok=True)
        
        # 0. 自动从旧版 AppData 迁移历史数据 (向后无缝兼容老用户)
        app_data = os.getenv('APPDATA')
        if app_data:
            legacy_appdata = os.path.join(app_data, 'RumiaDesktopPet')
            if os.path.exists(legacy_appdata) and os.path.abspath(legacy_appdata) != os.path.abspath(USER_DATA_DIR):
                try:
                    legacy_chars = os.path.join(legacy_appdata, "characters")
                    if os.path.exists(legacy_chars):
                        dst_chars = os.path.join(USER_DATA_DIR, "characters")
                        os.makedirs(dst_chars, exist_ok=True)
                        for char_id in os.listdir(legacy_chars):
                            src_char = os.path.join(legacy_chars, char_id)
                            dst_char = os.path.join(dst_chars, char_id)
                            if os.path.isdir(src_char):
                                os.makedirs(dst_char, exist_ok=True)
                                # 迁移 daily_history 日记与聊天记录
                                src_dh = os.path.join(src_char, "daily_history")
                                dst_dh = os.path.join(dst_char, "daily_history")
                                if os.path.exists(src_dh):
                                    os.makedirs(dst_dh, exist_ok=True)
                                    for df in os.listdir(src_dh):
                                        s_df = os.path.join(src_dh, df)
                                        d_df = os.path.join(dst_dh, df)
                                        if not os.path.exists(d_df):
                                            shutil.copy2(s_df, d_df)
                                # 迁移 qdrant_db
                                src_q = os.path.join(src_char, "qdrant_db")
                                dst_q = os.path.join(dst_char, "qdrant_db")
                                if os.path.exists(src_q) and not os.path.exists(dst_q):
                                    shutil.copytree(src_q, dst_q)
                                # 迁移 databank / dialog_history / favorability
                                for fn in ["databank_state.json", "dialog_history.json", "favorability.json"]:
                                    s_fn = os.path.join(src_char, fn)
                                    d_fn = os.path.join(dst_char, fn)
                                    if os.path.exists(s_fn) and not os.path.exists(d_fn):
                                        shutil.copy2(s_fn, d_fn)
                except Exception as me:
                    print(f"[PORTABLE MIGRATION] 旧版 AppData 数据迁移提示: {me}")

        # 1. 自动同步内嵌模型文件 (sentence-transformers/all-MiniLM-L6-v2)
        src_models = os.path.join(SERVICES_DIR, "models")
        if os.path.exists(src_models) and os.path.abspath(src_models) != os.path.abspath(LOCAL_MODELS_DIR):
            for item in os.listdir(src_models):
                s_item = os.path.join(src_models, item)
                d_item = os.path.join(LOCAL_MODELS_DIR, item)
                if not os.path.exists(d_item):
                    try:
                        if os.path.isdir(s_item):
                            shutil.copytree(s_item, d_item)
                        else:
                            shutil.copy2(s_item, d_item)
                    except Exception: pass
    except Exception as e:
        print(f"[WARN] init_user_data_dir Warning: {e}")

init_user_data_dir()

GLOBAL_CONFIG_FILE = os.path.join(USER_DATA_DIR, "global_config.json")

def get_active_character_id():
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f).get("active_character", "rumia")
        except:
            pass
    return "rumia"

def get_character_dir():
    char_id = get_active_character_id()
    d = os.path.join(USER_DATA_DIR, "characters", char_id)
    os.makedirs(d, exist_ok=True)
    return d

def get_file_path(filename):
    return os.path.join(get_character_dir(), filename)

GLOBAL_KEYS = {
    "api_provider", "engine_base_url", "engine_api_key", "engine_model_name",
    "engines", "pre_api_provider", "post_api_provider", "app_launcher",
    "vision_engine", "active_character", "custom_engines", "temperature",
    "enable_greeting", "enable_auto_speak", "auto_speak_multiplier",
    "bubble_duration_multiplier", "show_thought_button", "show_tool_calls",
    "auto_minimize_on_fullscreen_game", "preset_max_depth", "preset_block_english",
    "flow_mode", "history_step_multiplier", "auto_start_on_boot",
    "enable_tts", "enable_tts_click", "enable_tts_auto", "tts_provider", "tts_speak_mode",
    "tts_base_url", "tts_api_key", "tts_model_name",
    "fish_audio_base_url", "fish_audio_api_key",
    "weather_provider", "weather_api_key", "weather_city", "weather_lat", "weather_lon"
}

CHARACTER_CONFIG_WHITELIST = {
    "character_id", "character_name", "persona_prompt", "user_prompt",
    "theme_color", "active_skin", "wallpaper_url", "wallpaper_fit",
    "bgm_url", "immersive_effects", "created_at", "version",
    "tts_voice_id", "tts_language", "tts_voice_zh", "tts_voice_ja", "tts_voice_en"
}

def get_config():
    """读取并合并全局与角色本地配置"""
    global_config = {}
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                global_config = json.load(f)
        except:
            pass
            
    char_config = {}
    config_file = get_file_path("config.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                char_config = json.load(f)
                
            if "user_prompt" not in char_config:
                user_prompt_path = get_file_path("user_prompt.txt")
                if os.path.exists(user_prompt_path):
                    try:
                        with open(user_prompt_path, 'r', encoding='utf-8') as pf:
                            char_config["user_prompt"] = pf.read()
                    except:
                        pass
        except:
            pass
            
    merged = {**global_config, **char_config}
    if "api_provider" not in merged:
        merged["api_provider"] = "gemini"
    if "auto_minimize_on_fullscreen_game" not in merged:
        merged["auto_minimize_on_fullscreen_game"] = True
    if "auto_start_on_boot" not in merged:
        merged["auto_start_on_boot"] = False
    if "enable_tts" not in merged:
        merged["enable_tts"] = True
    if "enable_tts_click" not in merged:
        merged["enable_tts_click"] = True
    if "enable_tts_auto" not in merged:
        merged["enable_tts_auto"] = False
    if "tts_speak_mode" not in merged:
        merged["tts_speak_mode"] = "click"
    if "tts_language" not in merged:
        merged["tts_language"] = "zh"
    if "tts_provider" not in merged:
        merged["tts_provider"] = "fish_audio"
    if "tts_base_url" not in merged:
        merged["tts_base_url"] = merged.get("fish_audio_base_url") or os.getenv("FISH_AUDIO_BASE_URL", "https://api.fish.audio/v1/tts")
    if "tts_api_key" not in merged:
        merged["tts_api_key"] = merged.get("fish_audio_api_key") or os.getenv("FISH_AUDIO_API_KEY", "")
    if "tts_model_name" not in merged:
        merged["tts_model_name"] = ""
    if "fish_audio_base_url" not in merged:
        merged["fish_audio_base_url"] = merged["tts_base_url"]
    if "fish_audio_api_key" not in merged:
        merged["fish_audio_api_key"] = merged["tts_api_key"]
    return merged

def save_config(config_data):
    """保存本地配置 (拆分到全局和角色)"""
    global_config = {}
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                global_config = json.load(f)
        except:
            pass
            
    char_config = {}
    config_file = get_file_path("config.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                char_config = json.load(f)
        except:
            pass
            
    for k, v in config_data.items():
        if k in GLOBAL_KEYS:
            global_config[k] = v
            if k in char_config:
                del char_config[k]
        else:
            char_config[k] = v
            if k in global_config and k != "active_character":
                del global_config[k]

    try:
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(global_config, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存全局配置失败: {e}")

    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(char_config, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存角色配置失败: {e}")

def get_custom_engines():
    """获取所有自定义的大脑引擎"""
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get("custom_engines", [])
        except:
            pass
    return []

def save_custom_engine(engine_data):
    """保存一个新的或更新自定义大脑引擎"""
    config = {}
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except:
            pass
    
    engines = config.get("custom_engines", [])
    
    # 如果已存在相同的 engine_id，则更新
    existing = False
    for i, e in enumerate(engines):
        if e.get("id") == engine_data.get("id"):
            engines[i] = engine_data
            existing = True
            break
            
    if not existing:
        engines.append(engine_data)
        
    config["custom_engines"] = engines
    
    try:
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存引擎失败: {e}")
        return False

def delete_custom_engine(engine_id):
    """删除指定的自定义大脑引擎"""
    if not os.path.exists(GLOBAL_CONFIG_FILE):
        return False
        
    config = {}
    try:
        with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except:
        return False
        
    engines = config.get("custom_engines", [])
    new_engines = [e for e in engines if e.get("id") != engine_id]
    
    if len(engines) == len(new_engines):
        return False
        
    config["custom_engines"] = new_engines
    try:
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"删除引擎失败: {e}")
        return False

