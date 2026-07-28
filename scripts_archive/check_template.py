import json
with open(r'E:\QQ\TavernDB_template_-魔法少女ノ魔女裁判MVU-.json', encoding='utf-8') as f:
    d = json.load(f)
for k in d.keys():
    if k.startswith('sheet_'):
        print(f"{k} -> {d[k].get('name')}")
