import os
import json

SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLOBAL_CONFIG_FILE = os.path.join(SERVICES_DIR, "global_config.json")

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
    d = os.path.join(SERVICES_DIR, "characters", char_id)
    os.makedirs(d, exist_ok=True)
    return d

def get_file_path(filename):
    return os.path.join(get_character_dir(), filename)

GLOBAL_KEYS = {
    "api_provider", "engine_base_url", "engine_api_key", "engine_model_name",
    "engines", "pre_api_provider", "post_api_provider", "app_launcher",
    "vision_engine", "active_character", "custom_engines"
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

