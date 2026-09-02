import pytest
from core.dsh_manager import (
    check_dsh_environment,
    resolve_dsh_env,
    get_dsh_executable,
    strip_ansi_codes
)
from graph.nodes import parse_pre_response_node, should_execute_tools
from tools.tool_executor import execute_dsh_task_node

def test_dsh_environment_check():
    status = check_dsh_environment()
    assert isinstance(status, dict)
    assert "is_installed" in status
    assert "has_api_key" in status
    assert "settings" in status
    assert status["settings"]["dsh_preset"] in ["standard", "ptc", "minimal", "creator"]

def test_resolve_dsh_env():
    env = resolve_dsh_env()
    assert isinstance(env, dict)
    assert "DSH_DEFAULT_PRESET" in env
    assert "DSH_PERMISSION_MODE" in env
    assert env["DSH_PERMISSION_MODE"] in ["workspace-write", "danger-full-access"]

def test_strip_ansi_codes():
    raw_text = "\x1b[32mHello\x1b[0m \x1b[1mWorld\x1b[0m"
    clean = strip_ansi_codes(raw_text)
    assert clean == "Hello World"

def test_trigger_command_recognition():
    # 1. 明确输入 "启动agent"
    fake_state = {
        "user_message": "启动agent 帮我写一个测试脚本",
        "raw_reply": "[NO_TOOLS_NEEDED]",
        "history": []
    }
    res = parse_pre_response_node(fake_state)
    assert res.get("dsh_task") is not None

    # 2. 仅输入 "启动agent"
    fake_state2 = {
        "user_message": "启动agent",
        "raw_reply": "[NO_TOOLS_NEEDED]",
        "history": []
    }
    res2 = parse_pre_response_node(fake_state2)
    assert res2.get("dsh_task") is not None

    # 3. 普通聊天，不包含 "启动agent"
    fake_state3 = {
        "user_message": "今天天气真好，出去散散步吧",
        "raw_reply": "[NO_TOOLS_NEEDED]",
        "history": []
    }
    res3 = parse_pre_response_node(fake_state3)
    assert res3.get("dsh_task") is None

def test_should_execute_tools_routing():
    fake_state_with_dsh = {
        "dsh_task": "帮我写测试",
        "dsh_result": None
    }
    assert should_execute_tools(fake_state_with_dsh) == "execute_dsh_task"

    fake_state_done = {
        "dsh_task": "帮我写测试",
        "dsh_result": "已完成"
    }
    assert should_execute_tools(fake_state_done) == "collect_tool_feedback"

def test_execute_dsh_task_node_disabled():
    fake_state = {"dsh_task": "__DISABLED__"}
    res = execute_dsh_task_node(fake_state)
    assert "dsh_result" in res
    assert "控制台" in res["dsh_result"] or "Agent 设置" in res["dsh_result"]

def test_execute_dsh_task_node_standby():
    fake_state = {"dsh_task": "待命就绪确认"}
    res = execute_dsh_task_node(fake_state)
    assert "dsh_result" in res
    assert "待命" in res["dsh_result"]
