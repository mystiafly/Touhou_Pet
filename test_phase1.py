import json

user_msg_lower = "姐姐？".lower()
with open('g:/code/rumia/services/characters/wriggle/presets/custom_presets.json', encoding='utf-8') as f:
    presets = json.load(f)

for preset in presets:
    primary_kws = preset.get("trigger_keywords", []) or preset.get("key", [])
    secondary_kws = preset.get("secondary_keywords", []) or preset.get("keysecondary", [])
    
    has_primary = False
    if not primary_kws:
        has_primary = True
    else:
        for kw in primary_kws:
            if kw and isinstance(kw, str) and kw.lower() in user_msg_lower:
                has_primary = True
                print(f"Primary match: '{kw}' in '{user_msg_lower}'")
                break
                
    has_secondary = False
    if not secondary_kws:
        has_secondary = True
    else:
        for kw in secondary_kws:
            if kw and isinstance(kw, str) and kw.lower() in user_msg_lower:
                has_secondary = True
                print(f"Secondary match: '{kw}' in '{user_msg_lower}'")
                break
                
    if has_primary and has_secondary and (primary_kws or secondary_kws):
        print(f"[PRESETS] 关键词(复合)直接命中，触发预设: {preset.get('name')}")
