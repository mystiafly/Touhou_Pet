import json
import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(BASE_DIR, "characters", "rumia", "config.json")
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    if "distilled_dates" in config:
        config["distilled_dates"] = []
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        print("Cleared distilled_dates in rumia config.")

for qdrant_path in [os.path.join(BASE_DIR, "qdrant_db"), os.path.join(BASE_DIR, "qdrant_db_temp")]:
    if os.path.exists(qdrant_path):
        shutil.rmtree(qdrant_path)
        print(f"Deleted Qdrant storage directory {qdrant_path} to wipe existing memories.")
