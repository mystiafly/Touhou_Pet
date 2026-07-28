import sys
import re

path = r'g:\code\rumia\services\static\js\dashboard.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

marker = '// ================== DataBank 渲染逻辑 =================='
idx = content.find(marker)
if idx == -1:
    print('Marker not found!')
    sys.exit(1)

base_content = content[:idx]

with open(r'g:\code\rumia\databank_js.txt', 'r', encoding='utf-8') as f:
    new_logic = f.read()

with open(path, 'w', encoding='utf-8') as f:
    f.write(base_content + new_logic)
print('Replaced DataBank JS logic fully.')
