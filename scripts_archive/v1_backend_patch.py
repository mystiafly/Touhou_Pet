import re

js_path = r"G:\code\rumia\services\web_interface.py"

with open(js_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add globals and get_active_character_id
imports_and_globals = """# 全局变量定义
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
GLOBAL_CONFIG_FILE = os.path.join(SERVICES_DIR, "global_config.json")

def get_active_character_id():
    import json
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

CONFIG_FILE = get_file_path("config.json")
HISTORY_FILE = get_file_path("dialog_history.json")
DAILY_HISTORY_DIR = get_file_path("daily_history")
FAVORABILITY_FILE = get_file_path("favorability.json")
USER_PROFILE_FILE = get_file_path("user_profile.json")
"""

content = re.sub(
    r"# 全局变量定义.*?USER_PROFILE_FILE = os.path.join\(SERVICES_DIR, \"user_profile\.json\"\)",
    imports_and_globals,
    content,
    flags=re.DOTALL
)

# 2. Fix get_config and save_config to use dynamic property instead of static global evaluating once
get_config_func = """def get_config():
    \"\"\"读取本地配置，默认api_provider为gemini\"\"\"
    config_file = get_file_path("config.json")
    if os.path.exists(config_file):
        try:
            import json
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"api_provider": "gemini"}

def save_config(config_data):
    \"\"\"保存本地配置\"\"\"
    config_file = get_file_path("config.json")
    try:
        import json
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
"""

content = re.sub(
    r"def get_config\(\):.*?json\.dump\(config_data, f, ensure_ascii=False, indent=2\)",
    get_config_func,
    content,
    flags=re.DOTALL
)

# 3. Replace HISTORY_FILE / FAVORABILITY_FILE usages to be dynamic where they are used inside functions if they depend on global state, but actually they are used via save/load functions which can just call get_file_path directly.
content = content.replace("HISTORY_FILE", 'get_file_path("history.json")')
content = content.replace("FAVORABILITY_FILE", 'get_file_path("favorability.json")')
content = content.replace("USER_PROFILE_FILE", 'get_file_path("user_profile.json")')
# Revert the initialization block mistakes since we just replaced the constants
content = content.replace('get_file_path("history.json") = get_file_path("dialog_history.json")', '')
content = content.replace('get_file_path("favorability.json") = get_file_path("favorability.json")', '')
content = content.replace('get_file_path("user_profile.json") = get_file_path("user_profile.json")', '')

# Fix Mem0 Qdrant path
mem0_qdrant_fix = """                    "path": os.path.join(get_character_dir(), "qdrant_db"),"""
content = re.sub(
    r'                    "path": os.path.abspath\(os.path.join\(os.path.dirname\(__file__\), "qdrant_db"\)\),',
    mem0_qdrant_fix,
    content
)

# Fix Sqlite path
sqlite_fix = """    db_path = os.path.join(get_character_dir(), "checkpoints.db")
    conn = sqlite3.connect(db_path, check_same_thread=False)"""
content = re.sub(
    r'    db_path = os\.path\.join\(os\.path\.dirname\(__file__\), "checkpoints\.db"\)\n    conn = sqlite3\.connect\(db_path, check_same_thread=False\)',
    sqlite_fix,
    content
)

with open(js_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Backend V1.0.0 patch applied!")
