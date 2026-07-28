import re
import os

SERVICES_DIR = r"g:\code\rumia\services"
WEB_INTERFACE_PATH = os.path.join(SERVICES_DIR, "web_interface.py")

with open(WEB_INTERFACE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace Globals
new_globals = """# 全局变量定义
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
GLOBAL_CONFIG_FILE = os.path.join(SERVICES_DIR, "global_config.json")
GLOBAL_PRESETS_DIR = os.path.join(SERVICES_DIR, "global_presets")
CHARACTERS_DIR = os.path.join(SERVICES_DIR, "characters")
DAILY_HISTORY_DIR = os.path.join(SERVICES_DIR, "daily_history")
MIN_HISTORY_ROUNDS = 8
MAX_HISTORY_ROUNDS = 16

def get_active_character_id():
    import json
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("active_character", "rumia")
        except:
            pass
    return "rumia"

def get_char_dir():
    import os
    char_id = get_active_character_id()
    path = os.path.join(CHARACTERS_DIR, char_id)
    if not os.path.exists(path):
        os.makedirs(path)
    return path

def get_file_path(filename):
    import os
    return os.path.join(get_char_dir(), filename)
"""

# Find the old globals and replace them
pattern = r"# 全局变量定义.*?USER_PROFILE_FILE = os\.path\.join\(SERVICES_DIR, \"user_profile\.json\"\)"
content = re.sub(pattern, new_globals, content, flags=re.DOTALL)

# 2. Delete the variable assignments for presets
content = re.sub(r'PRESETS_DIR = os\.path\.join\(os\.path\.dirname\(__file__\), "presets"\)\n', '', content)
content = re.sub(r'CUSTOM_PRESETS_FILE = os\.path\.join\(PRESETS_DIR, "custom_presets\.json"\)\n', '', content)
content = re.sub(r'SELF_TALK_PRESETS_FILE = os\.path\.join\(PRESETS_DIR, "self_talk_presets\.json"\)\n', '', content)

# 3. Replace usages using word boundaries
content = re.sub(r'\bCONFIG_FILE\b', "get_file_path('config.json')", content)
content = re.sub(r'\bHISTORY_FILE\b', "get_file_path('dialog_history.json')", content)
content = re.sub(r'\bFAVORABILITY_FILE\b', "get_file_path('favorability.json')", content)
content = re.sub(r'\bUSER_PROFILE_FILE\b', "get_file_path('user_profile.json')", content)
content = re.sub(r'\bPRESETS_DIR\b', "get_file_path('presets')", content)
content = re.sub(r'\bCUSTOM_PRESETS_FILE\b', "get_file_path('presets/custom_presets.json')", content)
content = re.sub(r'\bSELF_TALK_PRESETS_FILE\b', "get_file_path('presets/self_talk_presets.json')", content)

# 4. Fix qdrant_db path
content = content.replace(
    '"path": os.path.abspath(os.path.join(os.path.dirname(__file__), "qdrant_db"))',
    '"path": get_file_path("qdrant_db")'
)
content = content.replace(
    'qdrant_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "qdrant_db"))',
    'qdrant_path = get_file_path("qdrant_db")'
)

# 5. Fix SQLite checkpointer
content = content.replace(
    'sqlite_conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), "rumia_checkpoints.db"), check_same_thread=False)',
    'sqlite_conn = sqlite3.connect(get_file_path("checkpoints.db"), check_same_thread=False)'
)

with open(WEB_INTERFACE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patching complete.")
