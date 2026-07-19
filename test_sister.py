import json
with open('g:/code/rumia/services/characters/wriggle/presets/custom_presets.json', encoding='utf-8') as f:
    d = json.load(f)
for p in d:
    for kw in (p.get('trigger_keywords', []) + p.get('secondary_keywords', [])):
        if kw and isinstance(kw, str) and kw.lower() in '姐姐？'.lower():
            print(f"Matched {p.get('name')} on keyword: {repr(kw)}")
