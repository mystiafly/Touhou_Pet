from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_visual_vision_quick_tool_is_wired_end_to_end():
    pet_template = (ROOT / "services" / "templates" / "pet.html").read_text(encoding="utf-8")
    pet_core = (ROOT / "services" / "static" / "js" / "pet" / "pet_core.js").read_text(encoding="utf-8")
    chat_router = (ROOT / "services" / "api" / "routers" / "chat.py").read_text(encoding="utf-8")
    graph_nodes = (ROOT / "services" / "graph" / "nodes.py").read_text(encoding="utf-8")

    assert 'id="tool-vision"' in pet_template
    assert "type: 'analyze_screen'" in pet_core
    assert "request_type == 'analyze_screen'" in chat_router
    assert '"vision_task": "analyze_screen" if request_type == \'analyze_screen\'' in chat_router
    assert 'vision_task = state.get("vision_task")' in graph_nodes
