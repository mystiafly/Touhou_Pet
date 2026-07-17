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
