from typing import TypedDict, List, Optional, Dict, Any

class AgentState(TypedDict):
    user_message: str
    is_self_talk: bool
    history: List[Dict[str, Any]]
    favorability: int
    recalled_memories: List[str]
    active_databank: str
    selected_memory: str
    custom_presets: str
    raw_reply: str
    pre_llm_reply: str
    tool_feedback_context: str
    main_llm_reply: str
    post_llm_reply: str
    emotion: str
    score: int
    clean_content: str
    thought: Optional[str]
    browser_task: Optional[str]
    browser_result: Optional[str]
    launcher_task: Optional[str]
    launcher_result: Optional[str]
    search_task: Optional[str]
    search_result: Optional[str]

    # 读进程工具
    process_task: Optional[bool]
    process_result: Optional[str]

    vision_task: Optional[str]
    vision_result: Optional[str]
    clean_memory_task: Optional[bool]
    clean_memory_result: Optional[Dict[str, Any]]
    request_type: Optional[str]
    retry_count: Optional[int]
