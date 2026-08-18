import os
import json
import shutil
import sys

# 设置 HuggingFace 国内镜像与离线模式，彻底屏绝 WinError 10060 网络超时错误
os.environ["HF_ENDPOINT"] = os.getenv("HF_ENDPOINT", "https://hf-mirror.com")
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if getattr(sys, 'frozen', False):
    app_data = os.getenv('APPDATA') or os.path.expanduser('~')
    USER_DATA_DIR = os.path.join(app_data, 'RumiaDesktopPet')
else:
    USER_DATA_DIR = SERVICES_DIR

# 绑定本地内嵌 HuggingFace 缓存路径
LOCAL_MODELS_DIR = os.path.join(USER_DATA_DIR, "models")
os.environ["HF_HOME"] = os.getenv("HF_HOME", LOCAL_MODELS_DIR)

def init_user_data_dir():
    """初始化 AppData 用户目录，在打包部署时从应用包中解压并初始化出厂设置"""
    try:
        os.makedirs(USER_DATA_DIR, exist_ok=True)
        os.makedirs(os.path.join(USER_DATA_DIR, "logs"), exist_ok=True)
        os.makedirs(LOCAL_MODELS_DIR, exist_ok=True)
        
        # 0. 自动同步内嵌模型文件 (sentence-transformers/all-MiniLM-L6-v2)
        src_models = os.path.join(SERVICES_DIR, "models")
        if os.path.exists(src_models):
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

        if getattr(sys, 'frozen', False):
            # 1. 自动同步/解压 global_config.json
            dst_global = os.path.join(USER_DATA_DIR, "global_config.json")
            if not os.path.exists(dst_global):
                src_global = os.path.join(SERVICES_DIR, "global_config.json")
                if os.path.exists(src_global):
                    try: shutil.copy2(src_global, dst_global)
                    except Exception: pass
                    
            # 2. 自动解压/出厂 characters 角色预设包
            dst_chars = os.path.join(USER_DATA_DIR, "characters")
            if not os.path.exists(dst_chars):
                src_chars = os.path.join(SERVICES_DIR, "characters")
                if os.path.exists(src_chars):
                    try: shutil.copytree(src_chars, dst_chars)
                    except Exception: pass

            # 3. 自动解压/出厂 global_presets 场景感应预设
            dst_presets = os.path.join(USER_DATA_DIR, "global_presets")
            if not os.path.exists(dst_presets):
                src_presets = os.path.join(SERVICES_DIR, "global_presets")
                if os.path.exists(src_presets):
                    try: shutil.copytree(src_presets, dst_presets)
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
    "vision_engine", "active_character", "custom_engines",
    "enable_greeting", "enable_auto_speak", "auto_speak_multiplier",
    "bubble_duration_multiplier", "show_thought_button",
    "auto_minimize_on_fullscreen_game", "preset_max_depth", "preset_block_english",
    "flow_mode", "history_step_multiplier", "auto_start_on_boot",
    "enable_tts", "tts_provider", "tts_speak_mode", "fish_audio_base_url", "fish_audio_api_key"
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
    if "tts_speak_mode" not in merged:
        merged["tts_speak_mode"] = "click"
    if "tts_language" not in merged:
        merged["tts_language"] = "zh"
    if "tts_provider" not in merged:
        merged["tts_provider"] = "fish_audio"
    if "fish_audio_base_url" not in merged:
        merged["fish_audio_base_url"] = os.getenv("FISH_AUDIO_BASE_URL", "https://api.fish.audio/v1/tts")
    if "fish_audio_api_key" not in merged:
        merged["fish_audio_api_key"] = os.getenv("FISH_AUDIO_API_KEY", "")
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

