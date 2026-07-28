import sys
import os
sys.path.append(r"g:\code\rumia")
sys.path.append(r"g:\code\rumia\services")

from services.web_interface import chat_workflow

print(chat_workflow.get_graph().draw_mermaid())
