import re
import os

SERVICES_DIR = r"g:\code\rumia\services"
WEB_INTERFACE_PATH = os.path.join(SERVICES_DIR, "web_interface.py")

with open(WEB_INTERFACE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

api_code = """
@app.get("/api/character_info")
async def api_character_info():
    import json
    char_id = get_active_character_id()
    config = get_config()
    char_name = config.get("character_name", char_id)
    return JSONResponse({
        "character_id": char_id,
        "character_name": char_name,
        "image_path": f"/static/images/{char_id}/"
    })

@app.post("/api/switch_character")
async def api_switch_character(request: Request):
    import json
    try:
        data = await request.json()
        new_char_id = data.get("character_id")
        if not new_char_id:
            return JSONResponse({"status": "error", "message": "Missing character_id"}, status_code=400)
            
        with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
            g_config = json.load(f)
        g_config["active_character"] = new_char_id
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(g_config, f, indent=2)
            
        return JSONResponse({"status": "success", "require_restart": True})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/settings/config")"""

content = content.replace('@app.get("/api/settings/config")', api_code)

with open(WEB_INTERFACE_PATH, "w", encoding="utf-8") as f:
    f.write(content)
print("API patching complete.")
