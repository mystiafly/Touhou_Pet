import os
import shutil

IMAGES_DIR = r"g:\code\rumia\services\static\images"
RUMIA_IMG_DIR = os.path.join(IMAGES_DIR, "rumia")

if not os.path.exists(RUMIA_IMG_DIR):
    os.makedirs(RUMIA_IMG_DIR)

for fname in os.listdir(IMAGES_DIR):
    if fname.startswith("rumia_") and fname.endswith(".png"):
        new_name = fname.replace("rumia_", "")
        src = os.path.join(IMAGES_DIR, fname)
        dst = os.path.join(RUMIA_IMG_DIR, new_name)
        try:
            shutil.move(src, dst)
            print(f"Moved {fname} -> rumia/{new_name}")
        except Exception as e:
            print(f"Failed to move {fname}: {e}")
