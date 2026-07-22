from typing import TypedDict, List, Optional, Dict, Any

class AgentState(TypedDict):
    user_message: str
    is_self_talk: bool
    history: List[Dict[str, Any]]
    favorability: int
    recalled_memories: str
    custom_presets: str
    raw_reply: str
    pre_llm_reply: str
    tool_feedback_context: str
    main_llm_reply: str
    post_llm_reply: str
    emotion: str
    score: int
    clean_content: str
    browser_task: Optional[str]
    browser_result: Optional[str]
    music_task: Optional[str]
    music_result: Optional[dict]
    launcher_task: Optional[str]
    launcher_result: Optional[str]
    search_task: Optional[str]
    search_result: Optional[str]
    rename_task_user: Optional[str]
    rename_task_pet: Optional[str]
    rename_result: Optional[str]
    vision_task: Optional[str]
    vision_result: Optional[str]
    request_type: Optional[str]
