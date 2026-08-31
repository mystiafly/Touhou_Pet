import os
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import BackgroundTasks, APIRouter, Request, Body, HTTPException
from fastapi.responses import JSONResponse
from core.config_manager import get_config, save_config, get_active_character_id
from core.memory_manager import load_history, DAILY_HISTORY_DIR, get_memory_agent
from core.profile_manager import get_favorability
from core.memory_manager import DAILY_HISTORY_DIR, get_memory_agent
from workers.distillation import generate_pet_diary

router = APIRouter()
SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@router.get("/api/settings/logs")
def list_logs():
    """获取所有已保存对话和日记的日期列表"""
    try:
        if not os.path.exists(DAILY_HISTORY_DIR):
            return {"success": True, "dates": []}
            
        files = os.listdir(DAILY_HISTORY_DIR)
        dates = []
        for f in files:
            if f.startswith("chat_log_") and f.endswith(".txt"):
                date_str = f.replace("chat_log_", "").replace(".txt", "")
                dates.append(date_str)
                
        dates.sort(reverse=True)
        return {"success": True, "dates": dates}
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 8. 秘密日记具体内容接口
@router.get("/api/settings/logs/{date}")
def get_log_content(date: str):
    """获取特定日期的聊天记录与手写秘密日记 (对等路由)"""
    try:
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            return JSONResponse({"success": False, "error": "无效的日期格式"}, status_code=400)
            
        log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date}.txt")
        config = get_config()
        char_id = config.get("character_id", "rumia")
        diary_file = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{date}.txt")
        
        if not os.path.exists(log_file):
            return JSONResponse({"success": False, "error": "聊天记录文件不存在"}, status_code=404)
            
        with open(log_file, 'r', encoding='utf-8') as lf:
            log_content = lf.read()
            
        diary_content = ""
        if os.path.exists(diary_file):
            with open(diary_file, 'r', encoding='utf-8') as df:
                diary_content = df.read()
        else:
            print(f"[DIARY SYSTEM] 正在为 {date} 动态提炼并生成桌宠的日记...")
            diary_content, compressed_diary = generate_pet_diary(date, log_content)
            full_new_diary = diary_content + f"\n\n---\n【记忆压缩(用于核心检索)】：\n{compressed_diary}"
            try:
                with open(diary_file, 'w', encoding='utf-8') as df:
                    df.write(full_new_diary)
                diary_content = full_new_diary
            except Exception as df_ex:
                print(f"动态保存日记失败: {df_ex}")
                
        return {
            "success": True,
            "date": date,
            "chat_content": log_content,
            "diary_content": diary_content
        }
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 8.5. 重新提炼并重写秘密日记接口
@router.post("/api/settings/logs/{date}/rewrite")
def rewrite_log_diary(date: str):
    """重新打包并重写特定日期的角色日记"""
    try:
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            return JSONResponse({"success": False, "error": "无效的日期格式"}, status_code=400)
            
        log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date}.txt")
        config = get_config()
        char_id = config.get("character_id", "rumia")
        diary_file = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{date}.txt")
        
        if not os.path.exists(log_file):
            return JSONResponse({"success": False, "error": "聊天记录文件不存在，无法重写日记"}, status_code=404)
            
        with open(log_file, 'r', encoding='utf-8') as lf:
            log_content = lf.read()
            
        print(f"[DIARY SYSTEM] 正在为 {date} 重新提炼并重写桌宠的日记...")
        new_diary_content, compressed_diary = generate_pet_diary(date, log_content)
        
        full_new_diary = new_diary_content + f"\n\n---\n【记忆压缩(用于核心检索)】：\n{compressed_diary}"
        with open(diary_file, 'w', encoding='utf-8') as df:
            df.write(full_new_diary)
            
        return {
            "success": True,
            "date": date,
            "diary_content": full_new_diary
        }
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 9. 记忆网络关系图谱数据接口
@router.get("/api/settings/memory_graph")
def get_memory_graph():
    """获取目前长短期记忆网络拓扑结构 (全自动线程池托管)"""
    try:
        agent = get_memory_agent()
        if not agent:
            return JSONResponse({"success": False, "error": "记忆系统未初始化"}, status_code=500)
        
        memories_data = agent.get_all(filters={"user_id": "player_01"})
        memories_list = []
        if isinstance(memories_data, dict) and "results" in memories_data:
            memories_list = memories_data["results"]
        elif isinstance(memories_data, dict) and "memories" in memories_data:
            memories_list = memories_data["memories"]
        elif isinstance(memories_data, list):
            memories_list = memories_data
            
        nodes = []
        edges = []
        
        fact_nodes_map = {}
        valid_memory_ids = set()
        
        for item in memories_list:
            if not isinstance(item, dict):
                continue
            m_id = item.get("id")
            m_text = item.get("memory")
            m_meta = item.get("metadata", {})
            m_date = m_meta.get("date", "未知日期") if isinstance(m_meta, dict) else "未知日期"
            
            if not m_id or not m_text:
                continue
                
            valid_memory_ids.add(m_id)
            
            fact_node = {
                "id": m_id,
                "label": m_text[:25] + "..." if len(m_text) > 25 else m_text,
                "title": f"记忆日期: {m_date}\n详细内容: {m_text}",
                "color": {
                    "background": "rgba(255, 121, 198, 0.85)",
                    "border": "#ff79c6",
                    "highlight": {
                        "background": "rgba(255, 121, 198, 0.95)",
                        "border": "#ff79c6"
                    },
                    "hover": {
                        "background": "rgba(255, 121, 198, 0.95)",
                        "border": "#ff79c6"
                    }
                },
                "font": {"color": "#ffffff", "size": 12},
                "shape": "box",
                "margin": 10,
                "shadow": {"enabled": True, "color": "rgba(255, 121, 198, 0.3)", "size": 8}
            }
            nodes.append(fact_node)
            fact_nodes_map[m_id] = fact_node

        entity_nodes_map = {}
        linked_entities_list = []
        try:
            if hasattr(agent, "entity_store") and agent.entity_store:
                entities_data = agent.entity_store.get_all()
                if isinstance(entities_data, list):
                    linked_entities_list = entities_data
                elif isinstance(entities_data, dict) and "results" in entities_data:
                    linked_entities_list = entities_data["results"]
        except Exception as ee:
            print(f"[MEMORY GRAPH] Failed to fetch raw entity store: {ee}")
            
        for entity in linked_entities_list:
            if not isinstance(entity, dict):
                continue
            e_name = entity.get("value") or entity.get("entity")
            linked_ids = entity.get("linked_memory_ids", [])
            
            if not e_name or not isinstance(linked_ids, list):
                continue
                
            has_valid_link = any(mid in valid_memory_ids for mid in linked_ids)
            if not has_valid_link:
                continue
                
            entity_node_id = f"entity_{e_name}"
            
            if entity_node_id not in entity_nodes_map:
                entity_nodes_map[entity_node_id] = {
                    "id": entity_node_id,
                    "label": e_name,
                    "title": f"实体概念: {e_name}\n关联记忆数: {len(linked_ids)}",
                    "color": {
                        "background": "rgba(139, 233, 253, 0.35)",
                        "border": "#8be9fd",
                        "highlight": {
                            "background": "rgba(139, 233, 253, 0.5)",
                            "border": "#50fa7b"
                        },
                        "hover": {
                            "background": "rgba(139, 233, 253, 0.45)",
                            "border": "#50fa7b"
                        }
                    },
                    "font": {"color": "#c4f2fe", "size": 11},
                    "shape": "dot",
                    "size": 10,
                    "shadow": {"enabled": True, "color": "rgba(139, 233, 253, 0.2)", "size": 5}
                }
                nodes.append(entity_nodes_map[entity_node_id])
                
            for m_id in linked_ids:
                if m_id in valid_memory_ids:
                    edges.append({
                        "from": entity_node_id,
                        "to": m_id,
                        "color": {
                            "color": "rgba(98, 114, 164, 0.4)",
                            "highlight": "rgba(139, 233, 253, 0.8)",
                            "hover": "rgba(139, 233, 253, 0.8)"
                        },
                        "width": 1.5,
                        "smooth": {"type": "curvedCW", "roundness": 0.2}
                    })
                    
        return {
            "success": True,
            "nodes": nodes,
            "edges": edges,
            "facts_count": len(valid_memory_ids),
            "entities_count": len(entity_nodes_map)
        }
    except Exception as ex:
        print(f"[API ERROR] Failed to fetch memory graph: {ex}")
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 9.5 删除特定记忆节点接口
@router.delete("/api/settings/memory_node/{memory_id}")
def delete_memory_node(memory_id: str):
    """从 Qdrant 人格海向量库中擦除特定记忆节点"""
    try:
        agent = get_memory_agent()
        if not agent:
            return JSONResponse({"success": False, "error": "记忆系统未初始化"}, status_code=500)
            
        if hasattr(agent, "delete"):
            agent.delete(memory_id)
            return {"success": True, "message": "已成功从人格海中擦除该条回忆节点！"}
        return JSONResponse({"success": False, "error": "记忆底层未实现删除方法"}, status_code=500)
    except Exception as ex:
        print(f"[API ERROR] Failed to delete memory node: {ex}")
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 10. 手动触发记忆蒸馏接口
@router.post("/api/settings/memory_distill_now")
def manual_distill_now(payload: dict = Body(default={})):
    """手动整理今日和未整理的回忆并生成今日手写日记"""
    try:
        agent = get_memory_agent()
        if not agent:
            return JSONResponse({"success": False, "error": "记忆系统未初始化"}, status_code=500)
            
        seed_test = payload.get("seed_test", False)
        
        if seed_test:
            test_fact = "用户最喜欢吃巧克力饼干和红茶，今天过生日。"
            print(f"[MANUAL DISTILL] Seeding test memory: {test_fact}")
            agent.add(
                test_fact,
                user_id="player_01",
                metadata={"date": datetime.now().strftime("%Y-%m-%d"), "test": True},
                infer=False
            )
            return {"success": True, "message": "成功注入一条关于巧克力饼干和红茶生日的测试回忆！"}
            
        config_data = get_config()
        char_id = config_data.get("character_id", "rumia")
        char_name = config_data.get("character_name", "桌宠")
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        log_file_path = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
        
        if not os.path.exists(log_file_path):
            return JSONResponse({"success": False, "error": f"今天还没有聊天记录哦，快去和{char_name}聊聊天吧！"})
            
        with open(log_file_path, 'r', encoding='utf-8') as lf:
            log_content = lf.read().strip()
            
        if not log_content:
            return JSONResponse({"success": False, "error": "今日聊天记录为空！"})
            
        diary_file_path = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{today_str}.txt")
        print(f"[MANUAL DISTILL] Generating today's diary for {char_name} ({today_str})...")
        today_diary, compressed_diary = generate_pet_diary(today_str, log_content)
        try:
            with open(diary_file_path, 'w', encoding='utf-8') as df:
                df.write(today_diary)
        except Exception as df_ex:
            print(f"手动整理时保存日记失败: {df_ex}")

        print(f"[MANUAL DISTILL] Distilling today's chat logs ({today_str})...")
        agent.add(
            today_diary,
            user_id="player_01",
            metadata={"date": today_str},
            infer=False
        )
        
        distilled_dates = config_data.get("distilled_dates", [])
        if today_str not in distilled_dates:
            distilled_dates.append(today_str)
            config_data["distilled_dates"] = distilled_dates
            save_config(config_data)
            
        return {"success": True, "message": f"{char_name}非常认真地整理了今天的回忆，并且为您写下了一篇秘密日记哦！"}
    except Exception as ex:
        print(f"[API ERROR] Manual distill failed: {ex}")
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 11. 退出游戏接口

@router.get("/api/settings/preview_prompt")
def preview_prompt():
    """模拟运行一次查询，并返回即将送给大模型的上下文 Prompt (Dry Run)"""
    from graph.nodes import recall_memories_node, build_pre_messages, build_main_messages, build_post_messages
    
    test_message = "你好"
    
    # 构造假的状态
    state = {
        "user_message": test_message,
        "is_self_talk": False,
        "history": load_history(),
        "favorability": get_favorability(),
        "recalled_memories": "",
        "custom_presets": "",
        "pre_llm_reply": "",
        "tool_feedback_context": "",
        "main_llm_reply": "你好呀！",
        "post_llm_reply": "",
        "raw_reply": "",
        "emotion": "normal",
        "score": 10,
        "clean_content": "",
        "browser_task": None,
        "browser_result": None,
        "launcher_task": None,
        "launcher_result": None,
        "search_task": None,
        "search_result": None,
        "request_type": "chat"
    }
    
    # 执行记忆回调
    mem_result = recall_memories_node(state)
    state.update(mem_result)
    
    # (预设加载现在已合并至 build_main_messages 内部调用)
    
    def format_msgs(active_messages):
        result_data = []
        total = len(active_messages)
        for i, msg in enumerate(active_messages):
            role_type = "system" if msg.type == "system" else "human" if msg.type == "human" else "assistant"
            role_name = "【系统指令 System】" if msg.type == "system" else "【用户输入 Human】" if msg.type == "human" else "【AI回复 Assistant】"
            
            is_history = (i > 0 and i < total - 1)
            result_data.append({
                "role_type": role_type,
                "role_name": role_name,
                "content": msg.content,
                "is_history": is_history
            })
        return result_data
        
    pre_msgs = build_pre_messages(state)
    main_msgs = build_main_messages(state)
    post_msgs = build_post_messages(state)
    
    return {
        "success": True, 
        "pre_messages": format_msgs(pre_msgs),
        "main_messages": format_msgs(main_msgs),
        "post_messages": format_msgs(post_msgs)
    }


# 12. 预设管理接口
