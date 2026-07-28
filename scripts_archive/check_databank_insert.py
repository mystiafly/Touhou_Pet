from core.databank_manager import parse_and_execute_databank_commands, load_databank
import os

llm_reply = """我明白啦，现在初始化！
```databank
INSERT_ROW: sheet_global_data, ["01", "东京", "新宿区", "御苑", "2024", "1H", "2024"]
```
"""
clean = parse_and_execute_databank_commands(llm_reply)

print("\nCleaned Output:")
print(clean)

print("\nAfter Update Content:")
merged = load_databank()
print(merged['sheet_global_data']['content'])
