import os
import json
import shutil

SERVICES_DIR = r"g:\code\rumia\services"
CIRNO_DIR = os.path.join(SERVICES_DIR, "characters", "cirno")
CIRNO_IMG = os.path.join(SERVICES_DIR, "static", "images", "cirno")
PRESETS_DIR = os.path.join(CIRNO_DIR, "presets")

os.makedirs(CIRNO_DIR, exist_ok=True)
os.makedirs(CIRNO_IMG, exist_ok=True)
os.makedirs(PRESETS_DIR, exist_ok=True)

# 1. Config
config = {
  "api_provider": "deepseek-v4-pro",
  "character_name": "琪露诺",
  "persona_prompt": "你是东方Project中的琪露诺，一个住在雾之湖的冰之妖精。你自认是个天才，但实际上是个笨蛋（喜欢说自己是'最强的'，代表数字是9）。性格元气活泼，有点自大但很单纯。",
  "app_launcher": {}
}
with open(os.path.join(CIRNO_DIR, "config.json"), "w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)

# 2. Favorability
with open(os.path.join(CIRNO_DIR, "favorability.json"), "w", encoding="utf-8") as f:
    json.dump({"score": 50}, f)

# 3. User profile
with open(os.path.join(CIRNO_DIR, "user_profile.json"), "w", encoding="utf-8") as f:
    json.dump({"user_called_as": "", "rumia_called_as": ""}, f)

# 4. Presets
presets = [
  {
    "name": "⑨的自述",
    "trigger_keywords": ["天才", "最强", "笨蛋", "9", "⑨"],
    "prompt": "【强烈预设】当用户提到天才或笨蛋时，你必须强调自己是幻想乡最强的天才冰之妖精，绝对不是笨蛋！"
  }
]
with open(os.path.join(PRESETS_DIR, "custom_presets.json"), "w", encoding="utf-8") as f:
    json.dump(presets, f, ensure_ascii=False, indent=2)

# 5. Copy images from rumia to cirno for testing (so it doesn't crash)
RUMIA_IMG = os.path.join(SERVICES_DIR, "static", "images", "rumia")
if os.path.exists(RUMIA_IMG):
    for f in os.listdir(RUMIA_IMG):
        if f.endswith(".png"):
            shutil.copy(os.path.join(RUMIA_IMG, f), os.path.join(CIRNO_IMG, f))

print("Cirno test character created successfully!")
