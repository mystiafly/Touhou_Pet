import sys
import json
sys.path.append('G:\\code\\rumia\\services')
from graph.workflow import chat_workflow

res = chat_workflow.invoke(
    {
        'user_message': '你在干嘛呀？快出来玩',
        'is_self_talk': False,
        'history': [],
        'favorability': 50
    },
    config={'configurable': {'thread_id': 'test2'}}
)

print("--- RAW LLM OUTPUT ---")
print(res.get('raw_llm_output', 'NOT_FOUND'))
print("----------------------")
