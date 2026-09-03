#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Touhou Desk Pet (东方桌宠) MCP Server
通过标准 Model Context Protocol (Stdio JSON-RPC 2.0) 暴露桌宠状态感知、角色互动、DataBank 与应用启动白名单管理能力
"""

import sys
import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

# 确保在 Windows 环境下强制使用 UTF-8 编码进行 Stdio 通信
if sys.platform == "win32":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = os.environ.get("TOUHOU_PET_URL", "http://127.0.0.1:5000")

def log(msg: str):
    """向 stderr 输出调试日志，防止污染标准输入输出通道"""
    sys.stderr.write(f"[TouhouPet-MCP] {msg}\n")
    sys.stderr.flush()

def http_get(endpoint: str, timeout: float = 3.0) -> Optional[Dict[str, Any]]:
    url = f"{BASE_URL}{endpoint}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TouhouPet-MCP/1.46.0"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = response.read().decode("utf-8")
            return json.loads(data)
    except urllib.error.URLError:
        return None
    except Exception as e:
        log(f"HTTP GET {endpoint} 异常: {e}")
        return None

def http_post(endpoint: str, payload: Dict[str, Any], timeout: float = 60.0) -> Optional[Dict[str, Any]]:
    url = f"{BASE_URL}{endpoint}"
    try:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "TouhouPet-MCP/1.46.0"
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = response.read().decode("utf-8")
            return json.loads(data)
    except urllib.error.URLError:
        return None
    except Exception as e:
        log(f"HTTP POST {endpoint} 异常: {e}")
        return None

# =========================================================================
# MCP Tools 实现
# =========================================================================

def tool_desk_pet_status(args: Dict[str, Any]) -> str:
    """获取桌宠当前状态"""
    info = http_get("/api/character_info")
    if not info or not info.get("character_id"):
        return "【桌宠服务离线】未能连接到桌宠后端 (http://127.0.0.1:5000)。请确认桌宠主程序是否已启动。"
    
    char_id = info.get("character_id", "unknown")
    char_name = info.get("character_name", char_id)
    fav = info.get("favorability", 0)
    mood = info.get("current_mood", "平静")
    activity = info.get("current_activity", "发呆中")
    skin = info.get("active_skin", "default")
    
    return (
        f"【东方桌宠实时状态】\n"
        f"- 当前角色: {char_name} (ID: {char_id})\n"
        f"- 好感度指数: {fav}/100\n"
        f"- 当前心情: {mood}\n"
        f"- 正在做的事: {activity}\n"
        f"- 当前装扮/套装: {skin}\n"
        f"- 后端通信状态: 🟢 运行中 (127.0.0.1:5000)"
    )

def tool_desk_pet_chat(args: Dict[str, Any]) -> str:
    """向桌宠发送对话"""
    user_msg = args.get("message", "").strip()
    if not user_msg:
        return "错误：消息内容不能为空。"
        
    res = http_post("/api/chat", {"message": user_msg}, timeout=90.0)
    if not res:
        return "【发送失败】桌宠服务无响应，请确认桌宠是否正在运行。"
        
    reply = res.get("clean_content") or res.get("reply") or "（桌宠默默看了你一眼，没有说话）"
    raw_reply = res.get("raw_reply", "")
    emotion = res.get("emotion", "normal")
    score = res.get("score", 10)
    
    thought = ""
    if "<character_thought>" in raw_reply:
        try:
            thought = raw_reply.split("<character_thought>")[1].split("</character_thought>")[0].strip()
        except Exception:
            pass

    output_lines = []
    if thought:
        output_lines.append(f"【桌宠内心活动 (Thought)】\n{thought}\n")
    output_lines.append(f"【桌宠台词回应】\n[{emotion}][好感变动评分:{score}] {reply}")
    return "\n".join(output_lines)

def tool_desk_pet_speak(args: Dict[str, Any]) -> str:
    """触发桌宠主动自言自语"""
    req_type = args.get("request_type", "greeting")
    prompt = args.get("prompt", "")
    
    res = http_post("/api/chat/self_talk", {"request_type": req_type, "prompt": prompt}, timeout=60.0)
    if not res:
        return "【触发失败】桌宠服务无响应。"
        
    reply = res.get("clean_content") or res.get("reply") or "..."
    emotion = res.get("emotion", "normal")
    return f"【桌宠主动说话 ({req_type})】\n[{emotion}] {reply}"

def tool_desk_pet_switch_character(args: Dict[str, Any]) -> str:
    """一键切换活跃角色"""
    target_char = args.get("character_id", "").strip().lower()
    if not target_char:
        return "错误：必须指定目标角色 ID (如 flandre, rumia, mystia, koishi, lily, wriggle)。"
        
    res = http_post("/api/settings/config", {"active_character": target_char})
    if not res or res.get("status") != "success":
        return f"【切换失败】无法切换到角色 {target_char}，请确认该角色配置文件是否存在。"
        
    return f"🎉 活跃桌宠已成功切换为：【{target_char}】！系统配置已实时生效更新。"

def tool_desk_pet_query_databank(args: Dict[str, Any]) -> str:
    """查询角色的动态数据库 DataBank 表格"""
    table_filter = args.get("table_name", "").strip()
    res = http_get("/api/databank")
    if not res or res.get("status") != "success":
        return "【查询失败】未找到该角色的 DataBank 数据库或桌宠服务离线。"
        
    data = res.get("data", {})
    tables = data.get("sheets", {}) or data.get("tables", {})
    if not tables:
        return f"当前角色的 DataBank 为空或暂无数据表。"
        
    output = []
    for sheet_id, sheet_data in tables.items():
        name = sheet_data.get("name", sheet_id)
        if table_filter and (table_filter.lower() not in sheet_id.lower() and table_filter.lower() not in name.lower()):
            continue
            
        columns = sheet_data.get("columns", [])
        rows = sheet_data.get("rows", [])
        output.append(f"### 表格: {name} ({sheet_id})")
        output.append(f"字段: {', '.join(columns)}")
        output.append(f"当前行数: {len(rows)}")
        for idx, row in enumerate(rows[:5]):  # 最多展示前 5 行
            row_vals = row if isinstance(row, list) else list(row.values()) if isinstance(row, dict) else [str(row)]
            output.append(f"  [{idx+1}] {row_vals}")
        if len(rows) > 5:
            output.append(f"  ... (还有 {len(rows)-5} 条记录)")
        output.append("")
        
    return "\n".join(output) if output else f"未匹配到名称包含 '{table_filter}' 的数据表。"

def tool_desk_pet_get_app_launcher_whitelist(args: Dict[str, Any]) -> str:
    """【重点工具】获取当前工具设置中的应用启动白名单配置"""
    cfg = http_get("/api/settings/config")
    if not cfg or not cfg.get("success"):
        return "【获取失败】桌宠服务离线，无法获取配置。"
        
    app_launcher = cfg.get("app_launcher", {})
    if not app_launcher:
        return "【应用启动白名单】目前尚未登记任何本地应用白名单。\n您可以通过 `desk_pet_update_app_launcher_whitelist` 添加常用的本地软件（如微信、VSCode、网易云等）。"
        
    output = ["【应用启动白名单配置表 (app_launcher)】"]
    output.append(f"已登记应用总数: {len(app_launcher)}\n")
    for alias, path in app_launcher.items():
        exists_str = "✅ 存在" if os.path.exists(path) else "❌ 路径无效/未找到"
        output.append(f"- 唤醒别名: 【{alias}】")
        output.append(f"  本地路径: {path} ({exists_str})")
        
    output.append("\n说明：用户只要在对话中说“帮我打开【别名】”，桌宠便会智能识别并安全唤醒对应路径。")
    return "\n".join(output)

def tool_desk_pet_update_app_launcher_whitelist(args: Dict[str, Any]) -> str:
    """【重点工具】更新应用启动白名单"""
    new_launcher = args.get("app_launcher")
    if not isinstance(new_launcher, dict):
        return "错误：app_launcher 必须是一个字典对象，例如 {'微信': 'C:\\\\Path\\\\WeChat.exe'}。"
        
    # 保存至桌宠配置中心
    res = http_post("/api/settings/config", {"app_launcher": new_launcher})
    if not res or res.get("status") != "success":
        return f"【更新失败】保存白名单配置出错: {res}"
        
    return (
        f"🎉 应用启动白名单已成功更新并热生效！\n"
        f"当前白名单包含 {len(new_launcher)} 个受信任应用：{', '.join(new_launcher.keys())}。\n"
        f"系统大模型已自动更新前置 Prompt，用户随时可指令桌宠唤醒这些应用。"
    )

def tool_desk_pet_launch_app(args: Dict[str, Any]) -> str:
    """【重点工具】触发桌宠安全拉起白名单应用"""
    alias = args.get("app_alias", "").strip()
    if not alias:
        return "错误：app_alias 不能为空。"
        
    cfg = http_get("/api/settings/config")
    if not cfg:
        return "【启动失败】无法连接到桌宠后端。"
        
    app_launcher = cfg.get("app_launcher", {})
    matched_path = None
    for name, path in app_launcher.items():
        if alias.lower() in name.lower() or name.lower() in alias.lower():
            matched_path = path
            break
            
    if not matched_path:
        return f"【启动失败】白名单中未找到与 '{alias}' 匹配的应用程序。现有可用别名: {list(app_launcher.keys())}"
        
    if ("\\" in matched_path or "/" in matched_path) and not os.path.exists(matched_path):
        return f"【启动失败】登记的物理路径不存在: '{matched_path}'，请检查文件是否被移动。"
        
    try:
        if os.name == 'nt':
            os.startfile(matched_path)
        else:
            import subprocess
            subprocess.Popen([matched_path], shell=False)
        return f"🚀 已成功为用户唤醒应用程序：【{alias}】 (目标路径: {matched_path})"
    except Exception as e:
        return f"【唤醒异常】操作系统执行启动时报错: {str(e)}"

def tool_desk_pet_trigger_agent(args: Dict[str, Any]) -> str:
    """通过桌宠调用 DSH 智能体"""
    task = args.get("task", "").strip()
    if not task:
        return "错误：task 内容不能为空。"
        
    # 直接通过 /api/chat 发送带“启动agent”前缀的指令
    res = http_post("/api/chat", {"message": f"启动agent {task}"}, timeout=120.0)
    if not res:
        return "【智能体执行超时或离线】DSH 任务未能及时返回，请在控制台检查任务耗时或重试。"
        
    reply = res.get("clean_content") or res.get("reply") or "DSH 智能体执行已结束。"
    return f"【DSH 智能体执行完成 - 桌宠汇报】\n{reply}"

# 工具映射表
TOOLS_REGISTRY = {
    "desk_pet_status": tool_desk_pet_status,
    "desk_pet_chat": tool_desk_pet_chat,
    "desk_pet_speak": tool_desk_pet_speak,
    "desk_pet_switch_character": tool_desk_pet_switch_character,
    "desk_pet_query_databank": tool_desk_pet_query_databank,
    "desk_pet_get_app_launcher_whitelist": tool_desk_pet_get_app_launcher_whitelist,
    "desk_pet_update_app_launcher_whitelist": tool_desk_pet_update_app_launcher_whitelist,
    "desk_pet_launch_app": tool_desk_pet_launch_app,
    "desk_pet_trigger_agent": tool_desk_pet_trigger_agent
}

MCP_TOOLS_MANIFEST = [
    {
        "name": "desk_pet_status",
        "description": "获取东方桌宠当前运行状态、活跃角色、好感度、心情及活动",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "desk_pet_chat",
        "description": "向当前桌宠发送对话，获取角色第一人称心理思考（character_thought）和台词回复",
        "inputSchema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "要对桌宠说的话或下达的指令"}
            },
            "required": ["message"]
        }
    },
    {
        "name": "desk_pet_speak",
        "description": "触发桌宠主动自言自语（打招呼、闲聊、催促休息等）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "request_type": {
                    "type": "string",
                    "enum": ["greeting", "idle", "lonely"],
                    "description": "主动搭话类型",
                    "default": "greeting"
                },
                "prompt": {"type": "string", "description": "可选触发提示词", "default": ""}
            }
        }
    },
    {
        "name": "desk_pet_switch_character",
        "description": "一键切换活跃桌宠角色（例如 flandre, rumia, mystia, koishi, lily, wriggle）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "character_id": {"type": "string", "description": "目标角色的标识符 ID"}
            },
            "required": ["character_id"]
        }
    },
    {
        "name": "desk_pet_query_databank",
        "description": "查询当前活跃角色的动态数据库（DataBank 状态表、回忆表、日常摘要表）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "要查询的数据表名称或 Sheet ID，留空则展示全部", "default": ""}
            }
        }
    },
    {
        "name": "desk_pet_get_app_launcher_whitelist",
        "description": "【核心工具】获取当前工具设置中配置的全部本地应用启动白名单映射表（别名 -> 本地绝对路径）",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "desk_pet_update_app_launcher_whitelist",
        "description": "【核心工具】更新桌宠的应用启动白名单。可批量添加新应用（如微信、VSCode、Steam）或修改可执行文件路径",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_launcher": {
                    "type": "object",
                    "description": "应用映射字典，键为唤醒别名，值为本地程序绝对路径"
                }
            },
            "required": ["app_launcher"]
        }
    },
    {
        "name": "desk_pet_launch_app",
        "description": "【核心工具】触发桌宠安全拉起已在白名单中登记的本地应用程序",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_alias": {"type": "string", "description": "白名单中的应用程序别名（如'微信'、'VSCode'、'网易云音乐'）"}
            },
            "required": ["app_alias"]
        }
    },
    {
        "name": "desk_pet_trigger_agent",
        "description": "通过桌宠唤起 DeepSeek Harness (DSH) 智能体在后台静默执行代码或系统任务，自动同步桌宠角色人设与上下文",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task": {"type": "string", "description": "要交给智能体执行的工程、分析或创作任务"}
            },
            "required": ["task"]
        }
    }
]

# =========================================================================
# JSON-RPC 2.0 Stdio 处理循环
# =========================================================================

def handle_rpc_request(req: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    msg_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "touhou-desk-pet-mcp",
                    "version": "1.46.0"
                }
            }
        }
        
    elif method == "notifications/initialized":
        # 客户端初始化完成确认，不需要响应
        return None
        
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": MCP_TOOLS_MANIFEST
            }
        }
        
    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        handler = TOOLS_REGISTRY.get(tool_name)
        if not handler:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"未找到名为 '{tool_name}' 的工具"
                }
            }
            
        try:
            result_text = handler(arguments)
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": str(result_text)
                        }
                    ]
                }
            }
        except Exception as e:
            log(f"执行工具 '{tool_name}' 发生错误: {e}")
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "isError": True,
                    "content": [
                        {
                            "type": "text",
                            "text": f"执行工具异常: {str(e)}"
                        }
                    ]
                }
            }
            
    elif method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {}
        }
        
    else:
        # 未知方法
        if msg_id is not None:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found"
                }
            }
        return None

def run_stdio_server():
    """Stdio JSON-RPC 主循环"""
    log("东方桌宠 MCP Server 正在启动 (Stdio 模式)...")
    for line in sys.stdin:
        line_str = line.strip()
        if not line_str:
            continue
        try:
            req = json.loads(line_str)
            resp = handle_rpc_request(req)
            if resp is not None:
                sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
                sys.stdout.flush()
        except json.JSONDecodeError as e:
            log(f"解析 JSON-RPC 请求失败: {e}")
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error"}
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            log(f"RPC 循环遇到未知异常: {e}")

if __name__ == "__main__":
    run_stdio_server()
