import os
import json
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from core.config_manager import get_active_character_id, get_config
from core.profile_manager import get_favorability
from core.scenario_manager import (
    load_scenario,
    save_scenario,
    load_scenario_state,
    save_scenario_state,
    get_favorability_floor,
    reset_scenario_node,
    reset_all_scenarios,
    evaluate_scenario_decision
)

router = APIRouter(prefix="/api/scenario", tags=["Scenario"])

@router.get("/data")
def get_scenario_data(char_id: str = None):
    """获取当前或指定角色的剧本配置、运行状态与好感度信息"""
    active_char = char_id or get_active_character_id()
    config = get_config()
    char_name = config.get("character_name", active_char)

    scenario = load_scenario(active_char)
    state = load_scenario_state(active_char)
    fav = get_favorability()
    floor = get_favorability_floor(active_char)

    return JSONResponse({
        "success": True,
        "character_id": active_char,
        "character_name": char_name,
        "favorability": fav,
        "favorability_floor": floor,
        "nodes": scenario.get("nodes", []),
        "state": state
    })

@router.post("/save")
def save_scenario_nodes(payload: dict = Body(...)):
    """保存角色的剧本节点列表"""
    char_id = payload.get("character_id") or get_active_character_id()
    nodes = payload.get("nodes", [])

    ok = save_scenario(char_id, {"nodes": nodes})
    if ok:
        return JSONResponse({"success": True, "message": "剧本配置已保存"})
    return JSONResponse({"success": False, "error": "保存剧本配置失败"}, status_code=500)

@router.post("/reset_node")
def reset_node_endpoint(payload: dict = Body(...)):
    """重置单个剧情节点"""
    char_id = payload.get("character_id") or get_active_character_id()
    node_id = payload.get("node_id")
    if not node_id:
        return JSONResponse({"success": False, "error": "缺少 node_id"}, status_code=400)

    ok = reset_scenario_node(char_id, node_id)
    return JSONResponse({"success": ok, "message": f"节点 {node_id} 进度已重置"})

@router.post("/reset_all")
def reset_all_endpoint(payload: dict = Body(...)):
    """重置角色的全部剧情进度"""
    char_id = payload.get("character_id") or get_active_character_id()
    ok = reset_all_scenarios(char_id)
    return JSONResponse({"success": ok, "message": "全部剧情进度已重置"})

@router.post("/trigger_test")
def trigger_test_endpoint(payload: dict = Body(...)):
    """强制手动激活某个剧情节点以供测试"""
    char_id = payload.get("character_id") or get_active_character_id()
    node_id = payload.get("node_id")
    if not node_id:
        return JSONResponse({"success": False, "error": "缺少 node_id"}, status_code=400)

    state = load_scenario_state(char_id)
    state["active_node_id"] = node_id
    state["is_paused"] = True
    state["turn_count"] = 0
    state["dialogue_buffer"] = []
    ok = save_scenario_state(char_id, state)
    return JSONResponse({"success": ok, "message": f"已成功强制激活节点 {node_id}，好感度已冻结"})

@router.post("/evaluate_now")
def evaluate_now_endpoint(payload: dict = Body(...)):
    """手动调用大模型裁决器执行即时测试判定"""
    char_id = payload.get("character_id") or get_active_character_id()
    res = evaluate_scenario_decision(char_id)
    return JSONResponse({"success": True, "result": res})
