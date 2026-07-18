import json
import sys
sys.path.append('g:/code/rumia/services')
from core.config_manager import get_file_path
from tools.presets_manager import load_and_trigger_presets

# Mock context
context = {
    "fav_level": 50,
    "current_char": "wriggle",
    "is_self_talk": False,
    "user_message": "姐姐？"
}

# Run the manager
result = load_and_trigger_presets(context)
print(f"Triggered count: {len(result)}")
for p in result:
    print(f"- {p.get('name')}")
