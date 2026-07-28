from core.databank_manager import parse_and_execute_databank_commands, load_databank
import os

print("Initial Content:")
merged = load_databank()
print(merged['sheet_global_data']['content'])

llm_reply = """我明白啦，现在时间流逝了！
```databank
UPDATE_TABLE: sheet_global_data, 1, 6, 2024-01-01 10:00
```
"""
clean = parse_and_execute_databank_commands(llm_reply)

print("\nCleaned Output:")
print(clean)

print("\nAfter Update Content:")
merged = load_databank()
print(merged['sheet_global_data']['content'])
