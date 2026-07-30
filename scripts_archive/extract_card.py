import os
import json
import shutil

src_char_dir = r"g:\code\rumia\services\characters\wriggle"
src_img_dir = r"g:\code\rumia\services\static\images\wriggle"
dest_dir = r"g:\code\rumia\temp_wriggle_card"

if os.path.exists(dest_dir):
    shutil.rmtree(dest_dir)

# Create directories
os.makedirs(os.path.join(dest_dir, "assets", "main_sprites"), exist_ok=True)
    pass
os.makedirs(os.path.join(dest_dir, "prompts"), exist_ok=True)
os.makedirs(os.path.join(dest_dir, "presets"), exist_ok=True)
os.makedirs(os.path.join(dest_dir, "databank"), exist_ok=True)

# 1. 15张立绘 + 2张侧边立绘
for img in os.listdir(src_img_dir):
    if not img.endswith(".png"): continue
    src_path = os.path.join(src_img_dir, img)
    shutil.copy(src_path, os.path.join(dest_dir, "assets", "main_sprites", img))

# 2. 读取 config
with open(os.path.join(src_char_dir, "config.json"), "r", encoding="utf-8") as f:
    config = json.load(f)

# 3. 构造 manifest.json
manifest = {
    "name": config.get("character_name", "莉格露"),
    "version": "1.0.0",
    "author": "System",
    "description": "萤火虫妖怪，活泼、直率，有些男孩子气。",
    "theme_color": "#76C789", 
    "compatible_version": ">=1.0.0"
}
with open(os.path.join(dest_dir, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

# 4. User提示词
user_prompt = config.get("user_prompt", "")
with open(os.path.join(dest_dir, "prompts", "user_prompt.txt"), "w", encoding="utf-8") as f:
    f.write(user_prompt)

# 5. 核心提示词
shutil.copy(os.path.join(src_char_dir, "base_prompt.txt"), os.path.join(dest_dir, "prompts", "base_prompt.txt"))

# 6. 专属预设
shutil.copy(os.path.join(src_char_dir, "presets", "custom_presets.json"), os.path.join(dest_dir, "presets", "custom_presets.json"))
shutil.copy(os.path.join(src_char_dir, "presets", "self_talk_presets.json"), os.path.join(dest_dir, "presets", "self_talk_presets.json"))

# 7. 动态数据库
shutil.copy(os.path.join(src_char_dir, "databank_template.json"), os.path.join(dest_dir, "databank", "template.json"))
state_path = os.path.join(src_char_dir, "databank_state.json")
if os.path.exists(state_path):
    shutil.copy(state_path, os.path.join(dest_dir, "databank", "state.json"))

print("Extraction complete!")
