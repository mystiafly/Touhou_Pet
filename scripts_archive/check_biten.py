import json

with open('g:/code/rumia/services/characters/wriggle/presets/custom_presets.json', encoding='utf-8') as f:
    d = json.load(f)

for p in d:
    if '孙美天' in p['name']:
        print(f"Name: {p['name']}")
        print(f"Primary Keywords: {p.get('trigger_keywords', [])}")
        print(f"Secondary Keywords: {p.get('secondary_keywords', [])}")
