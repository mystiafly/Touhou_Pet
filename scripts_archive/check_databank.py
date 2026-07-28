from core.databank_manager import get_active_tables, get_databank_rules_for_llm
import os
from core.config_manager import get_active_character_id

char_id = get_active_character_id()
print("Active Character:", char_id)

user_message = "去东京找麻美"
tables = get_active_tables(user_message, current_pool="")
print("\n--- INJECTED TABLES ---")
print(tables)

rules = get_databank_rules_for_llm()
print("\n--- INJECTED RULES ---")
print(rules)
