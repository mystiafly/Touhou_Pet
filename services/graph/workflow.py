import os
import sqlite3
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
from graph.state import AgentState
from graph.nodes import (
    recall_memories_node,
    load_presets_node,
    pre_llm_node,
    parse_pre_response_node,
    collect_tool_feedback_node,
    main_llm_node,
    should_execute_tools
)
from tools.tool_executor import (
    execute_music_task_node,
    execute_browser_task_node,
    execute_launcher_task_node,
    execute_search_task_node,
    execute_rename_task_node,
    execute_vision_task_node
)

workflow = StateGraph(AgentState)

workflow.add_node("recall_memories", recall_memories_node)
workflow.add_node("load_presets", load_presets_node)
workflow.add_node("pre_llm", pre_llm_node)
workflow.add_node("parse_pre_response", parse_pre_response_node)
workflow.add_node("execute_music_task", execute_music_task_node)
workflow.add_node("execute_browser_task", execute_browser_task_node)
workflow.add_node("execute_launcher_task", execute_launcher_task_node)
workflow.add_node("execute_search_task", execute_search_task_node)
workflow.add_node("execute_rename_task", execute_rename_task_node)
workflow.add_node("execute_vision_task", execute_vision_task_node)
workflow.add_node("collect_tool_feedback", collect_tool_feedback_node)
workflow.add_node("main_llm", main_llm_node)

workflow.set_entry_point("recall_memories")

workflow.add_edge("recall_memories", "load_presets")
workflow.add_edge("load_presets", "pre_llm")
workflow.add_edge("pre_llm", "parse_pre_response")

workflow.add_conditional_edges(
    "parse_pre_response",
    should_execute_tools,
    {
        "execute_music_task": "execute_music_task",
        "execute_browser_task": "execute_browser_task",
        "execute_search_task": "execute_search_task",
        "execute_launcher_task": "execute_launcher_task",
        "execute_rename_task": "execute_rename_task",
        "execute_vision_task": "execute_vision_task",
        "collect_tool_feedback": "collect_tool_feedback"
    }
)

# After tool execution, go to collect_tool_feedback
workflow.add_edge("execute_rename_task", "collect_tool_feedback")
workflow.add_edge("execute_music_task", "collect_tool_feedback")
workflow.add_edge("execute_browser_task", "collect_tool_feedback")
workflow.add_edge("execute_launcher_task", "collect_tool_feedback")
workflow.add_edge("execute_search_task", "collect_tool_feedback")
workflow.add_edge("execute_vision_task", "collect_tool_feedback")

workflow.add_edge("collect_tool_feedback", "main_llm")
workflow.add_edge("main_llm", END)

checkpoint_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rumia_checkpoints.db")
sqlite_conn = sqlite3.connect(checkpoint_db_path, check_same_thread=False)
chat_checkpointer = SqliteSaver(sqlite_conn)

chat_workflow = workflow.compile(checkpointer=chat_checkpointer)
