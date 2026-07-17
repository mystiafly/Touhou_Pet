import os
import sqlite3
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
from graph.state import AgentState
from graph.nodes import (
    recall_memories_node,
    load_presets_node,
    generate_response_node,
    parse_response_node,
    update_history_node,
    should_continue
)
from tools.tool_executor import (
    execute_music_task_node,
    execute_browser_task_node,
    execute_launcher_task_node,
    execute_search_task_node,
    execute_rename_task_node
)

# 编排与编译 LangGraph 对话状态图
workflow = StateGraph(AgentState)

workflow.add_node("recall_memories", recall_memories_node)
workflow.add_node("load_presets", load_presets_node)
workflow.add_node("generate_response", generate_response_node)
workflow.add_node("parse_response", parse_response_node)
workflow.add_node("execute_music_task", execute_music_task_node)
workflow.add_node("execute_browser_task", execute_browser_task_node)
workflow.add_node("execute_launcher_task", execute_launcher_task_node)
workflow.add_node("execute_search_task", execute_search_task_node)
workflow.add_node("execute_rename_task", execute_rename_task_node)
workflow.add_node("update_history", update_history_node)

workflow.set_entry_point("recall_memories")

workflow.add_edge("recall_memories", "load_presets")
workflow.add_edge("load_presets", "generate_response")
workflow.add_edge("generate_response", "parse_response")

# 在解析之后增加条件路由分支 (ReAct 循环)
workflow.add_conditional_edges(
    "parse_response",
    should_continue,
    {
        "execute_music_task": "execute_music_task",
        "execute_browser_task": "execute_browser_task",
        "execute_search_task": "execute_search_task",
        "execute_launcher_task": "execute_launcher_task",
        "execute_rename_task": "execute_rename_task",
        "update_history": "update_history"
    }
)

# 工具执行完毕后循环返回大模型重新思考并生成
workflow.add_edge("execute_rename_task", "generate_response")
workflow.add_edge("execute_music_task", "generate_response")
workflow.add_edge("execute_browser_task", "generate_response")
workflow.add_edge("execute_launcher_task", "generate_response")
workflow.add_edge("execute_search_task", "generate_response")

workflow.add_edge("update_history", END)

# 初始化并挂载 SQLite 持久化检查点
checkpoint_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rumia_checkpoints.db")
sqlite_conn = sqlite3.connect(checkpoint_db_path, check_same_thread=False)
chat_checkpointer = SqliteSaver(sqlite_conn)

chat_workflow = workflow.compile(checkpointer=chat_checkpointer)
