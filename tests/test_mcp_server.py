import pytest
import json
from unittest.mock import patch
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "services"))
from mcp_server import handle_rpc_request, MCP_TOOLS_MANIFEST, TOOLS_REGISTRY

def test_mcp_initialize():
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {}
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    assert resp["id"] == 1
    assert "result" in resp
    assert resp["result"]["serverInfo"]["name"] == "touhou-desk-pet-mcp"
    assert "tools" in resp["result"]["capabilities"]

def test_mcp_tools_list():
    req = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    assert resp["id"] == 2
    tools = resp["result"]["tools"]
    tool_names = [t["name"] for t in tools]
    
    # 验证全部核心工具清单
    assert "desk_pet_status" in tool_names
    assert "desk_pet_chat" in tool_names
    assert "desk_pet_speak" in tool_names
    assert "desk_pet_switch_character" in tool_names
    assert "desk_pet_query_databank" in tool_names
    assert "desk_pet_get_app_launcher_whitelist" in tool_names
    assert "desk_pet_update_app_launcher_whitelist" in tool_names
    assert "desk_pet_launch_app" in tool_names
    assert "desk_pet_trigger_agent" in tool_names

@patch("mcp_server.http_get")
def test_tool_desk_pet_status(mock_get):
    mock_get.return_value = {
        "character_id": "flandre",
        "character_name": "芙兰朵露·斯卡蕾特",
        "favorability": 88,
        "current_mood": "开心",
        "current_activity": "在地下室玩玩偶",
        "active_skin": "default"
    }
    req = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "desk_pet_status",
            "arguments": {}
        }
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    assert "result" in resp
    text = resp["result"]["content"][0]["text"]
    assert "芙兰朵露" in text
    assert "88/100" in text

@patch("mcp_server.http_get")
def test_tool_app_launcher_whitelist(mock_get):
    mock_get.return_value = {
        "success": True,
        "app_launcher": {
            "VSCode": "C:\\fake\\code.exe",
            "微信": "C:\\fake\\wechat.exe"
        }
    }
    req = {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "desk_pet_get_app_launcher_whitelist",
            "arguments": {}
        }
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    text = resp["result"]["content"][0]["text"]
    assert "VSCode" in text
    assert "微信" in text

@patch("mcp_server.http_post")
def test_tool_update_app_launcher_whitelist(mock_post):
    mock_post.return_value = {"status": "success"}
    req = {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "desk_pet_update_app_launcher_whitelist",
            "arguments": {
                "app_launcher": {
                    "Steam": "D:\\Steam\\steam.exe"
                }
            }
        }
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    text = resp["result"]["content"][0]["text"]
    assert "已成功更新" in text
    assert "Steam" in text

def test_mcp_invalid_tool_call():
    req = {
        "jsonrpc": "2.0",
        "id": 6,
        "method": "tools/call",
        "params": {
            "name": "non_existent_tool",
            "arguments": {}
        }
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    assert "error" in resp
    assert resp["error"]["code"] == -32601

def test_mcp_unknown_method():
    req = {
        "jsonrpc": "2.0",
        "id": 7,
        "method": "unknown_method",
        "params": {}
    }
    resp = handle_rpc_request(req)
    assert resp is not None
    assert "error" in resp
    assert resp["error"]["code"] == -32601
