import json
with open(r'E:\QQ\TavernDB_template_-魔法少女ノ魔女裁判MVU-.json', encoding='utf-8') as f:
    d = json.load(f)

for k in d.keys():
    if k.startswith('sheet_'):
        print(f"--- {d[k].get('name')} ---")
        print(f"exportConfig.entryType: {d[k].get('exportConfig', {}).get('entryType')}")
        print(f"exportConfig.keywords: {d[k].get('exportConfig', {}).get('keywords')}")
        print(f"updateNode: {d[k].get('sourceData', {}).get('updateNode')[:100]}")
