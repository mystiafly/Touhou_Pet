import os
import shutil
import json

SERVICES_DIR = r"g:\code\rumia\services"
CHARACTERS_DIR = os.path.join(SERVICES_DIR, "characters")
RUMIA_DIR = os.path.join(CHARACTERS_DIR, "rumia")
GLOBAL_PRESETS_DIR = os.path.join(SERVICES_DIR, "global_presets")
RUMIA_PRESETS_DIR = os.path.join(RUMIA_DIR, "presets")

def create_dirs():
    os.makedirs(RUMIA_DIR, exist_ok=True)
    os.makedirs(GLOBAL_PRESETS_DIR, exist_ok=True)
    os.makedirs(RUMIA_PRESETS_DIR, exist_ok=True)

def move_file(filename, dest_dir, new_name=None):
    src = os.path.join(SERVICES_DIR, filename)
    if not os.path.exists(src):
        return
    dst = os.path.join(dest_dir, new_name if new_name else filename)
    try:
        shutil.move(src, dst)
        print(f"Moved {filename} -> {dst}")
    except Exception as e:
        print(f"Failed to move {filename}: {e}")

def move_dir(dirname, dest_dir):
    src = os.path.join(SERVICES_DIR, dirname)
    if not os.path.exists(src):
        return
    dst = os.path.join(dest_dir, dirname)
    try:
        shutil.move(src, dst)
        print(f"Moved {dirname} -> {dst}")
    except Exception as e:
        print(f"Failed to move {dirname}: {e}")

def create_global_config():
    cfg_path = os.path.join(SERVICES_DIR, "global_config.json")
    if not os.path.exists(cfg_path):
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump({"active_character": "rumia"}, f, indent=2)
        print("Created global_config.json")

def split_presets():
    # old presets folder
    old_presets = os.path.join(SERVICES_DIR, "presets")
    if os.path.exists(old_presets):
        # custom_presets.json -> characters/rumia/presets/
        cp = os.path.join(old_presets, "custom_presets.json")
        if os.path.exists(cp):
            shutil.move(cp, os.path.join(RUMIA_PRESETS_DIR, "custom_presets.json"))
            print("Moved custom_presets.json to rumia/presets/")
            
        # self_talk_presets.json -> characters/rumia/presets/
        sp = os.path.join(old_presets, "self_talk_presets.json")
        if os.path.exists(sp):
            shutil.move(sp, os.path.join(RUMIA_PRESETS_DIR, "self_talk_presets.json"))
            print("Moved self_talk_presets.json to rumia/presets/")
        
        # create a default global nsfw_rules.json
        nr = os.path.join(GLOBAL_PRESETS_DIR, "nsfw_rules.json")
        if not os.path.exists(nr):
            with open(nr, "w", encoding="utf-8") as f:
                json.dump([
                    "【通用底层规则】当用户触发特定的敏感场景（如NSFW）时，你必须保持你当前角色的核心人设绝对不崩塌。基于你的性格特点给出合理的反馈。"
                ], f, ensure_ascii=False, indent=2)
            print("Created nsfw_rules.json in global_presets/")

        # remove old presets folder if empty
        try:
            os.rmdir(old_presets)
        except:
            pass

def main():
    print("Starting migration to V1.0.0 Architecture...")
    create_dirs()
    create_global_config()
    
    # move specific files to rumia
    move_file("config.json", RUMIA_DIR)
    move_file("dialog_history.json", RUMIA_DIR)
    move_file("user_profile.json", RUMIA_DIR)
    move_file("favorability.json", RUMIA_DIR)
    move_file("rumia_checkpoints.db", RUMIA_DIR, "checkpoints.db")
    move_file("rumia_checkpoints.db-shm", RUMIA_DIR, "checkpoints.db-shm")
    move_file("rumia_checkpoints.db-wal", RUMIA_DIR, "checkpoints.db-wal")
    
    # move dirs to rumia
    move_dir("qdrant_db", RUMIA_DIR)
    
    # split presets
    split_presets()
    print("Migration completed.")

if __name__ == "__main__":
    main()
