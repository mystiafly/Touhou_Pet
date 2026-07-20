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

def get_config():
    """读取本地配置，默认api_provider为gemini"""
    config_file = get_file_path("config.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"api_provider": "gemini"}

def save_config(config_data):
    """保存本地配置"""
    config_file = get_file_path("config.json")
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存配置失败: {e}")

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

