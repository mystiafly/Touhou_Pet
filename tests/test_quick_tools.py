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
    assert '"vision_task": state.get("vision_task")' in graph_nodes
    assert 'vision_task = state.get("vision_task")' in graph_nodes


def test_global_quick_shortcuts_are_wired_end_to_end():
    settings_template = (ROOT / "services" / "templates" / "dashboard" / "tabs" / "basic_settings.html").read_text(encoding="utf-8")
    shortcut_template = (ROOT / "services" / "templates" / "dashboard" / "tabs" / "shortcut_settings.html").read_text(encoding="utf-8")
    dashboard_template = (ROOT / "services" / "templates" / "dashboard.html").read_text(encoding="utf-8")
    shortcut_module = (ROOT / "services" / "static" / "js" / "dashboard" / "modules" / "shortcut_settings.js").read_text(encoding="utf-8")
    pet_core = (ROOT / "services" / "static" / "js" / "pet" / "pet_core.js").read_text(encoding="utf-8")
    config_manager = (ROOT / "services" / "core" / "config_manager.py").read_text(encoding="utf-8")
    system_router = (ROOT / "services" / "api" / "routers" / "system.py").read_text(encoding="utf-8")
    main_process = (ROOT / "main.js").read_text(encoding="utf-8")
    preload = (ROOT / "preload.js").read_text(encoding="utf-8")

    assert 'id="quick-shortcuts-list"' not in settings_template
    assert 'id="shortcut-settings-view"' in shortcut_template
    assert 'id="quick-shortcuts-list"' in shortcut_template
    assert 'data-target="shortcut-settings-view"' in dashboard_template
    assert 'shortcut_settings.js' in dashboard_template
    assert "quick_shortcuts" in shortcut_module
    assert "setQuickShortcuts" in shortcut_module
    assert "onQuickShortcutTriggered" in pet_core
    assert "quick_shortcuts" in config_manager
    assert '"quick_shortcuts"' in system_router
    assert "globalShortcut" in main_process
    assert "set-quick-shortcuts" in main_process
    assert "quick-shortcut-triggered" in main_process
    assert "setQuickShortcuts" in preload
    assert "onQuickShortcutTriggered" in preload
