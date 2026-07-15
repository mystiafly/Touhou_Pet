# web_interface.py - Web界面后端 (FastAPI 架构升级版)
from fastapi import FastAPI, Request, Body, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import os
import json
import re
import sys
import time
import subprocess
import threading
from datetime import datetime
from dotenv import load_dotenv
from mem0 import Memory

# 重新配置 stdout/stderr 编码为 utf-8，防止 Windows 环境下打印 Emoji ⚠️ 触发 UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

sys.path.append('.')  # 确保可以导入当前目录的模块

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# 导入时间与现实感知模块
from time_system import get_time_greeting_prompt
from real_world_system import get_meta_context_for_chat
from external_api import netease_music

# LangChain & LangGraph imports
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
import sqlite3
from typing import TypedDict, List, Optional, Dict, Any

# 初始化 FastAPI
app = FastAPI(title="Rumia Pet Backend", version="0.3.0")

# 挂载静态文件目录 (services/static -> /static)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 挂载 Jinja2 模板目录 (services/templates)
templates = Jinja2Templates(directory="templates")

# 全局变量定义
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
GLOBAL_CONFIG_FILE = os.path.join(SERVICES_DIR, "global_config.json")

def get_active_character_id():
    import json
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f).get("active_character", "rumia")
        except:
            pass
    return "rumia"

def get_character_dir():
    char_id = get_active_character_id()
    d = os.path.join(SERVICES_DIR, "characters", char_id)
    os.makedirs(d, exist_ok=True)
    return d

def get_file_path(filename):
    return os.path.join(get_character_dir(), filename)

CONFIG_FILE = get_file_path("config.json")
HISTORY_FILE = get_file_path("dialog_history.json")
DAILY_HISTORY_DIR = get_file_path("daily_history")
MIN_HISTORY_ROUNDS = 8
MAX_HISTORY_ROUNDS = 16
FAVORABILITY_FILE = get_file_path("favorability.json")

# Mem0 记忆系统配置与初始化锁
memory_agent = None
memory_agent_lock = threading.Lock()

# 浏览器自动化任务全局进程句柄 (用于防止并发拉起多个浏览器与控制台)
browser_process = None

# =====================================================================
# 一、 基础业务辅助函数 (100% 逻辑复用，保持稳定)
# =====================================================================

def get_config():
    """读取本地配置，默认api_provider为gemini"""
    config_file = get_file_path("config.json")
    if os.path.exists(config_file):
        try:
            import json
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"api_provider": "gemini"}

def save_config(config_data):
    """保存本地配置"""
    config_file = get_file_path("config.json")
    try:
        import json
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        print(f"保存配置失败: {e}")

def get_llm_client_and_model():
    """根据配置动态获取大模型客户端和模型名称"""
    from openai import OpenAI
    config_data = get_config()
    provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
    
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if provider == "gemini" and gemini_key:
        return OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        ), "gemini-2.5-flash"
        
    if provider == "deepseek-v4-pro" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-v4-pro"
        
    if provider == "deepseek-v4-flash" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-v4-flash"
        
    if provider == "deepseek-chat" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    if provider == "deepseek" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    # 自动兜底 (使用 Gemini)
    if gemini_key:
        return OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        ), "gemini-2.5-flash"
    elif deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    raise ValueError("未检测到有效的 API 密钥环境，请检查 .env 文件。")

def get_langchain_model():
    """根据配置动态获取 LangChain ChatModel 包装实例"""
    config_data = get_config()
    provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
    
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    api_key = None
    base_url = None
    model_name = None
    
    if provider == "gemini" and gemini_key:
        api_key = gemini_key
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        model_name = "gemini-2.5-flash"
    elif provider == "deepseek-v4-pro" and deepseek_key:
        api_key = deepseek_key
        base_url = "https://api.deepseek.com"
        model_name = "deepseek-v4-pro"
    elif provider == "deepseek-v4-flash" and deepseek_key:
        api_key = deepseek_key
        base_url = "https://api.deepseek.com"
        model_name = "deepseek-v4-flash"
    elif provider in ["deepseek-chat", "deepseek"] and deepseek_key:
        api_key = deepseek_key
        base_url = "https://api.deepseek.com"
        model_name = "deepseek-chat"
    elif gemini_key:
        api_key = gemini_key
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        model_name = "gemini-2.5-flash"
    elif deepseek_key:
        api_key = deepseek_key
        base_url = "https://api.deepseek.com"
        model_name = "deepseek-chat"
        
    if not api_key:
        raise ValueError("未检测到有效的 API 密钥环境，请检查 .env 文件。")
        
    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model_name,
        temperature=0.7
    )

def get_memory_agent():
    """线程安全获取 Mem0 记忆引擎实例"""
    global memory_agent
    if memory_agent is not None:
        return memory_agent
        
    with memory_agent_lock:
        if memory_agent is not None:
            return memory_agent
            
        config_data = get_config()
        provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
        
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        
        # 根据实际使用的嵌入模型自动区分 Qdrant 集合名称与维度，防止维度混用冲突
        embed_suffix = "openai"
        vector_dims = 1536
        if provider == "gemini" and gemini_key:
            embed_suffix = "gemini_v2"
            vector_dims = 384
        elif "deepseek" in provider and deepseek_key:
            embed_suffix = "deepseek"
            vector_dims = 384
        else:
            if gemini_key:
                embed_suffix = "gemini"
                vector_dims = 1536
            elif deepseek_key:
                embed_suffix = "deepseek"
                vector_dims = 384
                
        mem0_config = {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "path": os.path.join(get_character_dir(), "qdrant_db"),
                    "collection_name": f"rumia_memory_{embed_suffix}",
                    "embedding_model_dims": vector_dims
                }
            },
            "version": "v1.1"
        }
        
        # 针对不同的大模型提供商配置 Mem0 记忆模型
        if provider == "gemini" and gemini_key:
            mem0_config["llm"] = {
                "provider": "openai",
                "config": {
                    "api_key": gemini_key,
                    "model": "gemini-2.5-flash",
                    "openai_base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"
                }
            }
            # 384 维向量 (huggingface sentence-transformers)
            mem0_config["embedder"] = {
                "provider": "huggingface",
                "config": {
                    "model": "sentence-transformers/all-MiniLM-L6-v2"
                }
            }
        elif "deepseek" in provider and deepseek_key:
            mem0_config["llm"] = {
                "provider": "openai",
                "config": {
                    "api_key": deepseek_key,
                    "model": "deepseek-chat",
                    "openai_base_url": "https://api.deepseek.com"
                }
            }
            # 384 维向量
            mem0_config["embedder"] = {
                "provider": "huggingface",
                "config": {
                    "model": "sentence-transformers/all-MiniLM-L6-v2"
                }
            }
        else:
            # 自动降级极简配置与兜底
            if gemini_key:
                mem0_config["llm"] = {
                    "provider": "openai",
                    "config": {
                        "api_key": gemini_key,
                        "model": "gemini-2.5-flash",
                        "openai_base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"
                    }
                }
                mem0_config["embedder"] = {
                    "provider": "openai",
                    "config": {
                        "api_key": gemini_key,
                        "model": "text-embedding-004",
                        "openai_base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"
                    }
                }
            elif deepseek_key:
                mem0_config["llm"] = {
                    "provider": "openai",
                    "config": {
                        "api_key": deepseek_key,
                        "model": "deepseek-chat",
                        "openai_base_url": "https://api.deepseek.com"
                    }
                }
                mem0_config["embedder"] = {
                    "provider": "huggingface",
                    "config": {
                        "model": "sentence-transformers/all-MiniLM-L6-v2"
                    }
                }
                
        # 自动检查并清理维度冲突的本地 Qdrant 集合 (避免 shapes not aligned 启动错误)
        qdrant_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "qdrant_db"))
        collection_name = f"rumia_memory_{embed_suffix}"
        try:
            from qdrant_client import QdrantClient
            client = QdrantClient(path=qdrant_path)
            
            # 检查并修复主集合
            try:
                col_info = client.get_collection(collection_name)
                existing_dims = col_info.config.params.vectors.size
                if existing_dims != vector_dims:
                    print(f"[QDRANT AUTO-HEAL] 检测到主集合 '{collection_name}' 维度冲突: 期望 {vector_dims} 维，实际 {existing_dims} 维。正在自动删除重建...")
                    client.delete_collection(collection_name)
            except Exception:
                pass

            # 检查并修复 entities 集合
            entities_col = f"{collection_name}_entities"
            try:
                col_info = client.get_collection(entities_col)
                existing_dims = col_info.config.params.vectors.size
                if existing_dims != vector_dims:
                    print(f"[QDRANT AUTO-HEAL] 检测到 entities 集合 '{entities_col}' 维度冲突: 期望 {vector_dims} 维，实际 {existing_dims} 维。正在自动删除重建...")
                    client.delete_collection(entities_col)
            except Exception:
                pass
                
            client.close()
        except Exception as heal_ex:
            print(f"[QDRANT AUTO-HEAL] 自动检查修复 Qdrant 集合异常: {heal_ex}")
                
        try:
            print(f"[MEM0] 正在以 {provider.upper()} 架构初始化 Qdrant 向量记忆引擎...")
            memory_agent = Memory.from_config(mem0_config)
            print("[MEM0] 向量记忆引擎初始化成功。")
            return memory_agent
        except Exception as ex:
            print(f"[MEM0 ERROR] 初始化失败: {ex}")
            return None

def get_favorability():
    """获取好感度，默认60"""
    if os.path.exists(get_file_path("favorability.json")):
        try:
            with open(get_file_path("favorability.json"), 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('score', 60)
        except:
            pass
    return 60

def update_favorability(change):
    """更新好感度"""
    current = get_favorability()
    new_score = current + change
    new_score = max(0, min(100, new_score))
    try:
        with open(get_file_path("favorability.json"), 'w', encoding='utf-8') as f:
            json.dump({"score": new_score}, f)
    except Exception as e:
        print(f"保存好感度失败: {e}")
    return new_score

def get_user_profile():
    """获取用户与当前角色的专属称呼档案"""
    if os.path.exists(get_file_path("user_profile.json")):
        try:
            with open(get_file_path("user_profile.json"), 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"user_called_as": ""}

def update_user_profile_key(key: str, value: str):
    """更新称呼档案中的某个键值"""
    profile = get_user_profile()
    profile[key] = value
    try:
        with open(get_file_path("user_profile.json"), 'w', encoding='utf-8') as f:
            json.dump(profile, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存专属称呼档案失败: {e}")
    return profile

def load_history():
    """从文件加载对话历史，如果文件不存在则初始化新的历史"""
    current_fav = get_favorability()
    config_data = get_config()
    char_name = config_data.get("character_name", "桌宠")
    persona_prompt = config_data.get("persona_prompt", "你是一个桌面宠物，请根据用户的喜好与他们进行交流。")
    system_prompt = (
        f"{persona_prompt} 你目前对用户的好感度是 {current_fav}/100。\n"
        "【重要指令】\n"
        "1. 心情：从 [normal], [angry], [shy], [crying] 中选择。\n"
        "2. 感情评分：对用户的这句话打分（0-20）。10分是基准，>10表示开心/喜欢，<=10表示生气/无聊/讨厌。\n"
        "3. 动作表情描写：为了让你的傲娇性格和神态交互更加生动传神，强烈建议在回复的台词中穿插使用圆括号包裹的肢体动作、神态、表情描述（如：‘(红着脸扭过头去)’）。具体的特殊动作或客观场景描写（如写出无情绪前缀的纯圆括号段落等格式规则），详见每次对话尾部追加的临时约束规则，请以此临时约束为准。\n"
        "4. 浏览器操作：如果用户的话语中表达了让你通过浏览器代为执行某项操作、上网搜索网页、查找信息、访问页面或截图等明确意图（例如说：“帮我开浏览器查下天气”、“去网上搜一下最近的科技新闻”、“帮我打开百度搜索XXX”、“帮我找一下GitHub上的XXX仓库并告诉我多少Stars”等），请在你的回复内容的最末尾加上 `[BROWSER_TASK: <具体操作的简洁描述指令>]` 标记（用英文方括号）。例如：`[normal][12]好啊，我这就去开浏览器帮你搜一下！[BROWSER_TASK: 在百度上搜索今天的天气并在结果中找天气详情]`。如果用户没有表达任何需要上网/开浏览器做任务的意图，绝对不能包含 `[BROWSER_TASK: ...]` 标记。\n"
        "回答格式必须严格遵循：'[心情][评分]对话内容'（如有浏览器意图则在最末尾附加 [BROWSER_TASK: ...]）。\n"
        "例如：'[normal][12]嘿嘿，是那样吗？(背手偷偷的笑，脸上有一点红晕)' 或 '[angry][5]都要怪你啦！(气鼓鼓地掐着腰，把脸鼓成包子)' 或 '[shy][18]其、其实我也不是那么饿……(有些害羞地扭过头，偷偷咽了咽口水)'\n"
        "除了对话内容外，不要输出任何其他解释。"
    )

    if os.path.exists(get_file_path("dialog_history.json")):
        try:
            with open(get_file_path("dialog_history.json"), 'r', encoding='utf-8') as f:
                hist = json.load(f)
                if hist and hist[0]["role"] == "system":
                    hist[0]["content"] = system_prompt
                return hist
        except (json.JSONDecodeError, IOError) as e:
            print(f"警告：读取历史文件失败，将创建新历史。错误：{e}")

    return [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

def save_history(messages):
    """将对话历史保存到文件，并按天归档备份"""
    try:
        with open(get_file_path("dialog_history.json"), 'w', encoding='utf-8') as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)
            
        if not os.path.exists(DAILY_HISTORY_DIR):
            os.makedirs(DAILY_HISTORY_DIR)
            
        today_str = datetime.now().strftime("%Y-%m-%d")
        daily_json = os.path.join(DAILY_HISTORY_DIR, f"dialog_history_{today_str}.json")
        with open(daily_json, 'w', encoding='utf-8') as df:
            json.dump(messages, df, ensure_ascii=False, indent=2)
    except IOError as e:
        print(f"警告：保存历史文件失败。错误：{e}")

def trim_history(messages):
    """
    阶梯式上下文裁剪逻辑 (Stepped Context Windowing)
    为最大化利用 Prompt Caching，在历史未满 MAX_HISTORY_ROUNDS 时，
    不移出老对话（保持 append-only，以实现后续请求的 100% 缓存匹配）；
    一旦超过最大轮数，则一次性硬裁剪剪回 MIN_HISTORY_ROUNDS，重新建立新一轮的增长缓存。
    """
    if len(messages) <= 1:
        return messages
    system_message = messages[0]
    dialogue = messages[1:]
    if len(dialogue) > MAX_HISTORY_ROUNDS * 2:
        dialogue = dialogue[-(MIN_HISTORY_ROUNDS * 2):]
        print(f"[CONTEXT TRIM] 对话历史已满 {MAX_HISTORY_ROUNDS} 轮，触发阶梯式裁剪，硬剪回最近 {MIN_HISTORY_ROUNDS} 轮对话以重置并重建 Prompt Cache。")
    return [system_message] + dialogue

def parse_reply(text):
    """解析格式：[mood][score]content 并返回 (emotion, score, clean_content)
    升级说明：支持中文心情/评分降级映射，以及正则强力防御性清洗标签泄露"""
    if not text or not isinstance(text, str):
        return "normal", 10, ""
        
    # 1. 提取心情表情 (支持英文标准表情与中文落子表情)
    emotion = "normal"
    tags = re.findall(r'\[(normal|angry|shy|crying)\]', text)
    if tags:
        emotion = tags[-1]
    else:
        # 中文候选表情提取，并转换映射为系统可识别的对应动画名
        chinese_emotion_map = {
            "开心": "normal", "微笑": "normal", "常态": "normal", "平静": "normal", "慵懒": "normal", "愉悦": "normal",
            "生气": "angry", "愤怒": "angry", "傲娇": "angry", "抱怨": "angry",
            "害羞": "shy", "脸红": "shy", "扭捏": "shy", "羞耻": "shy",
            "大哭": "crying", "委屈": "crying", "难过": "crying", "嚎啕大哭": "crying", "流泪": "crying"
        }
        for cn_emo, en_emo in chinese_emotion_map.items():
            if f"[{cn_emo}]" in text:
                emotion = en_emo
                break

    # 2. 提取评分好感度变化 (支持纯数字 [12] 以及 [评分: 92] 等变体)
    score = 10
    score_match = re.search(r'\[(?:评分:\s*)?(\d+)\]', text)
    if score_match:
        try:
            raw_score = int(score_match.group(1))
            # 兼容处理：如果模型输出了 0-100 范围的百分制评分（例如 92），我们将其折算为系统的 0-20 区间 (除以5)
            if raw_score > 20:
                score = min(20, max(0, int(raw_score / 5)))
            else:
                score = min(20, max(0, raw_score))
        except:
            pass

    # 3. 清理除了系统级别工具任务标签以外的所有方括号标签，保障对白内容绝对不泄露格式标签
    # 采用负向先行断言正则，智能跳过各类工具和指令标签的清洗
    clean_content = re.sub(r'\[(?!BROWSER_TASK|MUSIC_PLAY|LAUNCH_APP|SEARCH_ENGINE|UPDATE_USER_NAME|UPDATE_PET_NAME)[^\]]+\]', '', text).strip()

    return emotion, score, clean_content

# =====================================================================
# 二、 LangGraph 对话工作流引擎定义
# =====================================================================

class AgentState(TypedDict):
    user_message: str
    is_self_talk: bool
    history: List[Dict[str, Any]]
    favorability: int
    recalled_memories: str
    custom_presets: str
    raw_reply: str
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
    request_type: Optional[str]
def recall_memories_node(state: AgentState) -> Dict[str, Any]:
    """读取 Mem0 事实库中的长期记忆 (使用 3+1 轮对话上下文进行语义召回，3 轮代表 6 条历史消息)"""
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    is_self = state.get("is_self_talk", False)
    recalled = ""
    if not is_self and user_msg:
        # 3+1 轮模式：提取最近 3 轮历史对话（6 条消息） + 当前最新一句话，角色与对白混排
        dialogue_msgs = [msg for msg in history if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-6:]  # 提取最近 6 条历史消息 (3 轮)
        
        query_parts = []
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "用户", "assistant": char_name}
        for msg in recent_msgs:
            query_parts.append(f"{role_map.get(msg['role'], msg['role'])}: {msg['content']}")
        query_parts.append(f"用户: {user_msg}")
        compiled_query = "\n".join(query_parts)
        
        agent = get_memory_agent()
        if agent:
            try:
                print("\n" + "-"*20 + " [MEM0 SEARCH QUERY (3+1 Rounds)] " + "-"*20)
                print(compiled_query)
                print("-"*68 + "\n")
                
                results = agent.search(compiled_query, filters={"user_id": "player_01"}, limit=3, threshold=0.45)
                results_list = results.get("results", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])
                print(f"[MEMORY RECALL] Query matches found: {len(results_list)}")
                if results_list:
                    recalled = "\n".join([f"- {r['memory']}" for r in results_list if isinstance(r, dict) and 'memory' in r])
                    print(f"[MEMORY RECALL] Successfully retrieved:\n{recalled}")
            except Exception as me:
                print(f"[MEMORY RECALL] Search failed: {me}")
    return {"recalled_memories": recalled}

def load_presets_node(state: AgentState) -> Dict[str, Any]:
    """匹配并加载当下好感度与关键词触发的系统提示词预设 (使用 1+1 轮对话上下文进行触发判定，1 轮代表 2 条历史消息)"""
    user_msg = state.get("user_message", "")
    history = state.get("history", [])
    current_fav = state.get("favorability", 10)
    is_self = state.get("is_self_talk", False)
    
    if not is_self and user_msg:
        # 1+1 轮模式：提取最近 1 轮历史对话（2 条消息：用户 + AI） + 当前最新一句话，角色与对白混排
        dialogue_msgs = [msg for msg in history if msg.get("role") in ("user", "assistant")]
        recent_msgs = dialogue_msgs[-2:]  # 提取最近 2 条历史消息 (1 轮)
        
        query_parts = []
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "用户", "assistant": char_name}
        for msg in recent_msgs:
            query_parts.append(f"{role_map.get(msg['role'], msg['role'])}: {msg['content']}")
        query_parts.append(f"用户: {user_msg}")
        compiled_query = "\n".join(query_parts)
        
        print("\n" + "-"*20 + " [PRESETS TRIGGER QUERY (1+1 Rounds)] " + "-"*20)
        print(compiled_query)
        print("-"*72 + "\n")
        
        presets = load_and_trigger_presets(compiled_query, current_fav, is_self_talk=is_self)
    else:
        presets = load_and_trigger_presets(user_msg, current_fav, is_self_talk=is_self)
        
    return {"custom_presets": presets}

def generate_response_node(state: AgentState) -> Dict[str, Any]:
    """装配前置静态与后置动态 Prompt，调用大模型生成回复"""
    char_id = get_active_character_id()
    config_data = get_config()
    char_name = config_data.get("character_name", "桌宠")
    persona_prompt = config_data.get("persona_prompt", "你是一个桌面宠物，请根据用户的喜好与他们进行交流。")

    history_msgs = state.get("history", [])
    current_fav = state.get("favorability", 10)
    recalled_memories = state.get("recalled_memories", "")
    custom_presets = state.get("custom_presets", "")
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)
    
    dynamic_tail = ""
    
    # 转换为 LangChain 消息格式
    lc_history = []
    for msg in history_msgs:
        if msg["role"] == "system":
            lc_history.append(SystemMessage(content=msg["content"]))
        elif msg["role"] == "user":
            lc_history.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_history.append(AIMessage(content=msg["content"]))
            
    if is_self:
        # 自言自语模式下的提示词组装 (保持静态规则前置优化缓存)
        priority_reminder = (
            "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\n"
            "【最高优先级提醒与行为约束（基础静态规则）】\n"
            f"1. 角色约束与动作描写：请严格扮演{char_name}（{persona_prompt}），用中文回答。在对话中建议穿插用圆括号包裹的动作/表情描述（如：‘(脸红扭过头)’）。在适合的情况下（如进行两性/NSFW/深层亲密交互时），强烈建议你特地独立写出几段【无情绪与评分前缀】的纯圆括号段落描述神态与客观场景，但特别注意：此类纯圆括号描述【绝对不能作为你回复的最后一段】（最后一段必须是带标签的正常台词，以防止表情显示发生解析冲突）。如果下方的【最高优先级触发预设】有更细致的格式与描述要求，请一并严格执行。\n"
            "2. 格式约束与要求：你的回复必须且只能遵循 '[心情][评分]对话内容' 格式要求。其中：\n"
            "   - '[心情]' 必须且只能是以下英文单词之一：[normal] (常态/开心/微笑/平静), [angry] (生气/愤怒/傲娇抱怨), [shy] (害羞/脸红/扭捏), [crying] (委屈/难过/大哭)。绝对禁止使用任何中文心情标签（如 [开心] ❌，[慵懒] ❌）。\n"
            "   - '[评分]' 必须且只能是方括号内包裹一个 0 到 20 之间的纯数字评分（如 [12]），代表当前言论的好感度评分（10为基准，>10加分，<10扣分）。绝对禁止写成类似 [评分: 92] ❌ 这样的非法格式。\n"
            "   - 示例：'[normal][12]哼，笨蛋！(双手叉腰)' 或 '[shy][18]才、才没有想你呢！(脸红别过头)'。因为这是你主动搭话，绝对禁止包含 `[BROWSER_TASK: ...]` 标记。\n"
            "3. 注意事项：目前只是你在自言自语主动搭话，绝对不要扮演用户或者假装用户对你说了什么！\n\n"
        )
        profile = get_user_profile()
        user_name = profile.get("user_called_as", "")
        pet_name = profile.get(f"{char_id}_called_as", "")
        
        meta_context = get_meta_context_for_chat(char_id, char_name)
        
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 当前状态]\n"
            f"{meta_context}\n"
            f"- 当前你（{char_name}）对用户的好感度为: {current_fav}/100。\n"
            f"- 称呼设定：用户当前的名字/称呼是【{user_name}】（空代表未设定），你的名字目前是【{pet_name}】（空代表{char_name}）。\n"
        )
    else:
        # 正常聊天模式下的提示词组装 (静态前置)
        app_launcher = config_data.get("app_launcher", {})
        app_launcher = config_data.get("app_launcher", {})
        available_apps_str = ", ".join(app_launcher.keys()) if app_launcher else "（尚未配置任何本地应用启动项）"

        priority_reminder = (
            "[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\n"
            "【最高优先级提醒与行为约束（基础静态规则）】\n"
            f"1. 角色约束与动作描写：请严格扮演{char_name}（{persona_prompt}），用中文回答。在对话中建议穿插用圆括号包裹的动作/表情描述（如：‘(脸红扭过头)’）。在适合的情况下（如进行两性/NSFW/深层亲密交互时），强烈建议你特地独立写出几段【无情绪与评分前缀】的纯圆括号段落描述神态与客观场景，但特别注意：此类纯圆括号描述【绝对不能作为你回复的最后一段】（最后一段必须是带标签 of 正常台词，以防止表情显示发生解析冲突）。如果下方的【最高优先级触发预设】有更细致的格式与描述要求，请一并严格执行。\n"
            "2. 格式约束：你的回复必须且只能遵循 '[心情][评分]对话内容' 格式要求。\n"
            "   - 如有浏览器自动化搜索意图，请在最末尾附加 `[BROWSER_TASK: 搜索任务文本]`。\n"
            "   - 如有搜索引擎检索意图（只在后台查资料背景搜索，不在屏幕上打开浏览器），请在最末尾附加 `[SEARCH_ENGINE: 搜索词]`。\n"
            "   - 【重要应用启动指令】如果用户让你打开、拉起或启动已配置的本地应用，你【必须】在回复的最末尾附加 `[LAUNCH_APP: 精确匹配的应用名称]`。这是物理启动应用的唯一硬件信号，如果你口头上说打开了但没有输出该标签，那就是在欺骗用户，请绝对避免假装打开而不输出标签！\n"
            "   - '[心情]' 必须且只能是以下英文单词之一：[normal] (常态/微笑/平静), [angry] (生气/愤怒/傲娇抱怨), [shy] (害羞/脸红/扭捏), [crying] (委屈/难过/大哭)。绝对禁止使用任何中文心情标签（如 [开心] ❌，[慵懒] ❌）。\n"
            "   - '[评分]' 必须且只能是方括号内包裹一个 0 到 20 之间的纯数字评分（如 [12]），代表当前言论的好感度评分（10为基准，>10加分，<10扣分）。绝对禁止写成类似 [评分: 92] ❌ 这样的非法格式。\n"
            "   - 示例：'[normal][12]哼，笨蛋！(双手叉腰)' 或 '[shy][18]才、才没有想你呢！(脸红别过头)'。\n\n"
            "   - 示例：'[normal][12]哼，笨蛋！(双手叉腰)' 或 '[shy][18]才、才没有想你呢！(脸红别过头)'。\n\n"
            "   【绝对强制改名指令】如果你想修改或追加对用户的称呼，你【必须且只能】在回复的最末尾附带 [UPDATE_USER_NAME: 新称呼]。想修改自己的名字，必须附带 [UPDATE_PET_NAME: 新名字]。\n"
            "   【严重警告】如果你决定使用改名工具，请在本次回复中【仅输出】这行带有方括号的标签！绝对禁止输出任何废话或角色扮演台词！系统在后台修改完成后，会在第二回合把结果告诉你，那时你再正式进行对话！\n"
            "   [修改宽容度] 如果当前称呼为空，你可以很宽松地填入。如果已有内容想完全替换，必须用户强烈要求才行。如果是追加（如变成“妈妈/老婆”），可以适当宽松同意。\n"
        )
        profile = get_user_profile()
        user_name = profile.get("user_called_as", "")
        pet_name = profile.get(f"{char_id}_called_as", "")
        
        meta_context = get_meta_context_for_chat(char_id, char_name)
        
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 当前状态]\n"
            f"{meta_context}\n"
            f"- 当前你（{char_name}）对用户的好感度为: {current_fav}/100。\n"
            f"- 当前系统支持你拉起启动的本地应用列表如下：【 {available_apps_str} 】。如果用户要求打开这些应用中的任何一个，你必须在回复文本的最末尾输出 `[LAUNCH_APP: 对应名称]`。\n"
            f"- 称呼设定：你目前称呼用户为【{user_name}】（空代表未设定），你的名字目前是【{pet_name}】（空代表{char_name}）。"
        )
        
        
        if recalled_memories:
            dynamic_tail += (
                f"\n\n[SYSTEM INJECTION: 唤醒的长期记忆]\n"
                f"{recalled_memories}\n"
                "（注：这些是关于用户的长期记忆。请仅在当前对话主题与这些记忆相关时，才自然、适度地提及。如果完全无关，绝对不要强行提及。）"
            )
            
    if custom_presets:
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 触发预设]\n"
            f"⚠️ 请在你的本次回复中，必须并且无条件严格遵循以下注入指令，主动描述预设内容：\n{custom_presets}"
        )
        
    # [ReAct 架构] 注入工具执行结果反馈给大模型作为决策依据
    music_result = state.get("music_result")
    if music_result:
        if "error" in music_result:
            dynamic_tail += (
                f"\n\n[SYSTEM INJECTION: 工具反馈 - 点歌检索失败]\n"
                f"错误信息：{music_result['error']}。\n"
                f"请以傲娇抱怨语气明确告诉用户没搜到，并绝对禁止再次输出 `[MUSIC_PLAY]` 标签。"
            )
        else:
            dynamic_tail += (
                f"\n\n[SYSTEM INJECTION: 工具反馈 - 点歌检索成功]\n"
                f"已播放歌曲：《{music_result['name']}》（歌手: {music_result['artists']}）。\n"
                f"请以傲娇开心口吻告诉用户正在播放，绝对禁止再次输出 `[MUSIC_PLAY]` 标签。"
            )
            
    browser_result = state.get("browser_result")
    if browser_result:
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 工具反馈 - 网页浏览器]\n"
            f"{browser_result}\n"
            f"请仔细提炼上述信息傲娇地回答用户，绝对禁止再次输出 `[BROWSER_TASK]` 标签。"
        )
        
    search_result = state.get("search_result")
    if search_result:
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 工具反馈 - 搜索引擎]\n"
            f"{search_result}\n"
            f"请结合上述搜索数据傲娇地回答用户，绝对禁止再次输出 `[SEARCH_ENGINE]` 标签。"
        )
        
    launcher_result = state.get("launcher_result")
    if launcher_result:
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 工具反馈 - 本地应用]\n"
            f"{launcher_result}\n"
            f"请说明启动情况，绝对禁止再次输出 `[LAUNCH_APP]` 标签。"
        )
        
    rename_result = state.get("rename_result")
    if rename_result:
        dynamic_tail += (
            f"\n\n[SYSTEM INJECTION: 工具反馈 - 称呼设定已更新]\n"
            f"{rename_result}\n"
            f"你现在已经知道了新设定，请立刻对用户之前的改名要求进行回应，禁止再次输出改名标签。"
        )
        
    active_messages = []
    is_greeting = state.get("request_type") == 'greeting'
    if lc_history and isinstance(lc_history[0], SystemMessage):
        if is_greeting:
            active_messages = [SystemMessage(content=priority_reminder)]
        else:
            active_messages = [SystemMessage(content=priority_reminder)] + lc_history[1:]
    else:
        if is_greeting:
            active_messages = [SystemMessage(content=priority_reminder)]
        else:
            active_messages = [SystemMessage(content=priority_reminder)] + lc_history
        
    if not is_self and user_message:
        # 尾部强效提醒 (方案 A 增强)：防止长历史上下文导致的注意力衰减，让 Gemini/DeepSeek 强制遵守指令。
        # 直接拼接在用户消息末尾，防止 API 适配器将 SystemMessage 调整到头部，确保 100% 处于模型生成前的最高注意力区间。
        tail_reminder = (
            "\n\n[SYSTEM REMINDER - FORCED LAUNCH/SEARCH RULE]\n"
            "1. 如果用户要求你打开、拉起或启动本地应用（如果上述状态里写了未配置任何应用，请直接告诉用户尚未配置），你【必须】且只能在回复内容的最末尾加上相应的 `[LAUNCH_APP: 应用名称]` 标签（例如：`[LAUNCH_APP: 网易云音乐]`）。\n"
            "2. 如果用户有网页搜索意图，需要拉起浏览器，必须在最末尾加上 `[BROWSER_TASK: 搜索词]` 标签。\n"
            "3. 如果你需要查询实时信息、知识科普或你不确定的内容（仅背景查资料，不拉起浏览器），你【必须】在回复的最末尾加上 `[SEARCH_ENGINE: 搜索词]` 标签。\n"
            "4. 绝对禁止口头上说打开了或查到了但不在最末尾写标签！必须输出方括号标签。"
        )
        active_messages.append(HumanMessage(content=user_message + dynamic_tail + tail_reminder))
    elif is_self and user_message:
        # 自言自语提示词，作为 SystemMessage 注入，指导模型进行自言自语生成，修复自言自语无响应或重复历史的Bug
        active_messages.append(SystemMessage(content=user_message + dynamic_tail))
        
    model = get_langchain_model()
    
    print("\n" + "="*40 + " [AI REQUEST (LANGCHAIN)] " + "="*40)
    print(f"Model: {model.model_name}")
    for idx, msg in enumerate(active_messages, 1):
        print(f"--- Message #{idx} ({msg.type.upper()}) ---")
        print(msg.content)
    print("="*94 + "\n")
    
    try:
        response = model.invoke(active_messages)
    except Exception as primary_ex:
        print(f"[BACKEND WARNING] 默认大模型 ({model.model_name}) 调用异常: {primary_ex}")
        
        # 自动切换到另一个引擎进行兜底
        config_data = get_config()
        current_provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
        
        fallback_provider = "gemini" if "deepseek" in current_provider else "deepseek-v4-pro"
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        
        has_fallback = False
        fallback_model = None
        
        if fallback_provider == "gemini" and gemini_key:
            has_fallback = True
            fallback_model = ChatOpenAI(
                api_key=gemini_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                model="gemini-2.5-flash",
                temperature=0.7
            )
        elif "deepseek" in fallback_provider and deepseek_key:
            has_fallback = True
            fallback_model = ChatOpenAI(
                api_key=deepseek_key,
                base_url="https://api.deepseek.com",
                model="deepseek-v4-pro",
                temperature=0.7
            )
            
        if has_fallback and fallback_model:
            print(f"[BACKEND INFO] 正在尝试自动降级到备用大模型 ({fallback_model.model_name}) 进行兜底...")
            try:
                response = fallback_model.invoke(active_messages)
                print("[BACKEND SUCCESS] 备用模型兜底成功！")
            except Exception as fallback_ex:
                print(f"[BACKEND ERROR] 备用大模型调用同样失败: {fallback_ex}")
                raise primary_ex
        else:
            raise primary_ex
            
    raw_reply = response.content
    
    print("\n" + "="*40 + " [AI RESPONSE (LANGCHAIN)] " + "="*40)
    print(raw_reply)
    print("="*95 + "\n")
    
    return {"raw_reply": raw_reply}

def parse_response_node(state: AgentState) -> Dict[str, Any]:
    """解析大模型返回的心情表情、好感评分、文本内容和点歌/浏览器操作指令"""
    raw_reply = state.get("raw_reply", "")
    emotion, score, clean_content = parse_reply(raw_reply)
    
    # 提取并清理浏览器操作指令
    browser_task = None
    task_match = re.search(r'\[BROWSER_TASK:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if task_match:
        browser_task = task_match.group(1).strip()
        clean_content = re.sub(r'\[BROWSER_TASK:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 提取搜索引擎指令
    search_task = None
    search_match = re.search(r'\[SEARCH_ENGINE:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if search_match:
        search_task = search_match.group(1).strip()
        clean_content = re.sub(r'\[SEARCH_ENGINE:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 提取并清理隐藏点歌指令 (ReAct)
    music_task = None
    music_match = re.search(r'\[MUSIC_PLAY:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if music_match:
        music_task = music_match.group(1).strip()
        clean_content = re.sub(r'\[MUSIC_PLAY:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 提取并清理隐藏启动本地应用指令 (ReAct)
    launcher_task = None
    launcher_match = re.search(r'\[LAUNCH_APP:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if launcher_match:
        launcher_task = launcher_match.group(1).strip()
        clean_content = re.sub(r'\[LAUNCH_APP:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    # 处理动态称呼更新指令
    rename_task_user = None
    user_name_match = re.search(r'\[UPDATE_USER_NAME:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if user_name_match:
        rename_task_user = user_name_match.group(1).strip()
        clean_content = re.sub(r'\[UPDATE_USER_NAME:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    rename_task_pet = None
    pet_name_match = re.search(r'\[UPDATE_PET_NAME:\s*(.*?)\]', raw_reply, re.IGNORECASE)
    if pet_name_match:
        rename_task_pet = pet_name_match.group(1).strip()
        clean_content = re.sub(r'\[UPDATE_PET_NAME:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
        
    return {
        "emotion": emotion,
        "score": score,
        "clean_content": clean_content,
        "browser_task": browser_task,
        "search_task": search_task,
        "music_task": music_task,
        "launcher_task": launcher_task,
        "rename_task_user": rename_task_user,
        "rename_task_pet": rename_task_pet
    }

def execute_music_task_node(state: AgentState) -> Dict[str, Any]:
    """工具节点：在图内部同步查询网易云音乐 API，预加载播放链接与歌词"""
    music_query = state.get("music_task")
    if not music_query:
        return {"music_result": None}
        
    print(f"[REACT MUSIC NODE] 开始为查询词执行网易云点歌: {music_query}")
    try:
        from external_api import netease_music
        songs = netease_music.search_music(music_query, limit=1)
        if not songs:
            print(f"[REACT MUSIC NODE] 未找到相关歌曲: {music_query}")
            return {"music_result": {"error": f"未找到关于 '{music_query}' 的歌曲，请让用户换个歌名搜索哦"}}
            
        song = songs[0]
        song_id = song["id"]
        song_name = song["name"]
        song_artists = song["artists"]
        
        # 预加载音频流和歌词
        play_url = netease_music.get_play_url(song_id)
        lyric_text = netease_music.get_lyric(song_id)
        
        result = {
            "id": song_id,
            "name": song_name,
            "artists": song_artists,
            "url": play_url,
            "lyric": lyric_text
        }
        print(f"[REACT MUSIC NODE] 点歌成功: {song_name} - {song_artists}")
        return {"music_result": result}
    except Exception as ex:
        print(f"[REACT MUSIC NODE ERROR] 点歌失败: {ex}")
        return {"music_result": {"error": f"点歌系统访问异常: {str(ex)}"}}

def execute_browser_task_node(state: AgentState) -> Dict[str, Any]:
    """工具节点：在大脑内部管理浏览器自动化任务的触发"""
    browser_task = state.get("browser_task")
    if not browser_task:
        return {"browser_result": None}
        
    print(f"[REACT BROWSER NODE] 开始触发浏览器自动化任务: {browser_task}")
    
    # 获取 browser-use 环境目录
    services_dir = os.path.dirname(os.path.abspath(__file__))
    rumia_dir = os.path.dirname(services_dir)
    workspace_dir = os.path.dirname(rumia_dir)
    
    candidate_paths = [
        os.path.join(workspace_dir, 'browser-use'),
        os.path.expanduser(r"~\Desktop\code\new\browser-use"),
        os.path.expanduser(r"~\Desktop\code\browser-use")
    ]
    
    browser_use_dir = None
    venv_python = None
    demo_py = None
    
    for path in candidate_paths:
        test_venv = os.path.join(path, '.venv', 'Scripts', 'python.exe')
        test_demo = os.path.join(path, 'demo.py')
        if os.path.exists(test_venv) and os.path.exists(test_demo):
            browser_use_dir = path
            venv_python = test_venv
            demo_py = test_demo
            break
            
    if not (browser_use_dir and venv_python and demo_py):
        print(f"[REACT BROWSER NODE ERROR] 未找到有效的 browser-use 运行环境")
        return {"browser_result": "未能在系统部署中定位到 browser-use 运行目录，无法启动网页自动化。"}
        
    # 判断 5005 端口是否活跃
    import socket
    server_active = False
    try:
        with socket.create_connection(("127.0.0.1", 5005), timeout=0.5):
            server_active = True
    except Exception:
        pass
        
    # 定义拉起本地独立进程的降级方法
    def launch_new_browser_process(task_content):
        global browser_process
        if browser_process and browser_process.poll() is None:
            try:
                if os.name == 'nt':
                    subprocess.call(['taskkill', '/F', '/T', '/PID', str(browser_process.pid)],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    browser_process.terminate()
            except Exception:
                pass
        
        browser_process = subprocess.Popen(
            [venv_python, 'demo.py', task_content],
            cwd=browser_use_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=0x08000000 if os.name == 'nt' else 0
        )
        print(f"[REACT BROWSER NODE] 降级拉起后台独立浏览器进程成功 (PID: {browser_process.pid})")
        
    # 执行 ReAct 分支选择
    if server_active:
        print(f"[REACT BROWSER NODE] 侦测到活跃后台服务 (Port 5005)，尝试同步执行任务...")
        import urllib.request
        import json
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:5005/run",
                data=json.dumps({"task": browser_task}).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            # 缩短等待为 10 秒 (方案 A)
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_text = resp.read().decode('utf-8')
                print(f"[REACT BROWSER NODE] 浏览器同步执行成功返回: {resp_text}")
                return {"browser_result": f"浏览器自动化成功，获取的网页内容简报如下: {resp_text}"}
        except Exception as req_ex:
            print(f"[REACT BROWSER NODE] 同步执行超时或异常，已自动转为后台挂起运行: {req_ex}")
            # 降级异步拉起
            threading.Thread(
                target=launch_new_browser_process,
                args=(browser_task,),
                daemon=True
            ).start()
            return {"browser_result": f"已在后台成功帮用户拉起全新浏览器窗口执行自动化任务 '{browser_task}'，请让用户自行观看浏览器界面。"}
    else:
        print(f"[REACT BROWSER NODE] 服务端口非活跃，直接降级为后台拉起独立进程...")
        # 异步拉起
        threading.Thread(
            target=launch_new_browser_process,
            args=(browser_task,),
            daemon=True
        ).start()
        return {"browser_result": f"已在后台成功拉起浏览器进程，正在对任务 '{browser_task}' 展开自动化处理，请让用户查看本地弹出的浏览器窗口。"}

def execute_search_task_node(state: AgentState) -> Dict[str, Any]:
    """背景搜索引擎检索节点"""
    search_query = state.get("search_task")
    if not search_query:
        return {"search_result": None}
        
    print(f"[REACT SEARCH NODE] 正在为大模型从必应检索: {search_query}")
    try:
        import requests
        from bs4 import BeautifulSoup
        
        url = f"https://cn.bing.com/search?q={requests.utils.quote(search_query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return {"search_result": f"搜索请求失败：HTTP {r.status_code}"}
            
        soup = BeautifulSoup(r.text, 'html.parser')
        items = soup.find_all('li', class_='b_algo')
        results = []
        for item in items[:5]:  # 只取前5条结果，防止提示词溢出
            title_el = item.find('h2')
            snippet_el = item.find('p') or item.find('div', class_='b_caption')
            if title_el:
                title = title_el.get_text().strip()
                snippet = snippet_el.get_text().strip() if snippet_el else ""
                link_el = title_el.find('a')
                link = link_el.get('href') if link_el else ""
                results.append(f"标题: {title}\n链接: {link}\n摘要: {snippet}\n---")
                
        if not results:
            return {"search_result": "未找到相关搜索结果。"}
            
        formatted_result = "\n".join(results)
        print(f"[REACT SEARCH NODE] 检索成功，共获取 {len(results)} 条记录")
        return {"search_result": formatted_result}
    except Exception as ex:
        print(f"[REACT SEARCH NODE ERROR] 检索失败: {ex}")
        return {"search_result": f"检索异常: {str(ex)}"}

def execute_launcher_task_node(state: AgentState) -> Dict[str, Any]:
    """工具节点：在系统后台执行本地程序或快捷方式启动指令"""
    launcher_task = state.get("launcher_task")
    if not launcher_task:
        return {"launcher_result": None}
        
    print("\n" + "="*20 + " [LAUNCHER NODE MONITOR] " + "="*20)
    print(f"[MONITOR] 收到大模型发起的应用启动任务: '{launcher_task}'")
    config_data = get_config()
    app_launcher = config_data.get("app_launcher", {})
    print(f"[MONITOR] 当前 config.json 登记的应用配置项: {json.dumps(app_launcher, ensure_ascii=False)}")
    
    # 模糊查找匹配应用名 (忽略大小写)
    matched_app = None
    matched_path = None
    for app_name, app_path in app_launcher.items():
        if launcher_task.lower() in app_name.lower() or app_name.lower() in launcher_task.lower():
            matched_app = app_name
            matched_path = app_path.strip()
            break
            
    if not matched_path:
        err_msg = f"未找到该应用的启动配置，大模型提取的任务名是 '{launcher_task}'，请检查 config.json 中的应用名称。"
        print(f"[MONITOR] {err_msg}")
        print("="*65 + "\n")
        return {"launcher_result": f"启动失败：{err_msg}"}
        
    print(f"[MONITOR] 匹配成功：大模型任务 '{launcher_task}' 对应配置中的 '{matched_app}'，登记路径为: '{matched_path}'")
    
    try:
        # 如果是绝对路径且包含斜杠，才去判定物理存在
        if ("\\" in matched_path or "/" in matched_path):
            exists = os.path.exists(matched_path)
            print(f"[MONITOR] 检查本地物理路径是否存在: {exists} ('{matched_path}')")
            if not exists:
                err_msg = f"物理路径不存在，请检查该文件是否被挪动或删除。配置路径为: '{matched_path}'"
                print(f"[MONITOR] {err_msg}")
                print("="*65 + "\n")
                return {"launcher_result": f"启动失败：{err_msg}"}
            
        print(f"[MONITOR] 正在通过操作系统接口 os.startfile 唤醒程序: '{matched_path}'")
        if os.name == 'nt':
            os.startfile(matched_path)
        else:
            import subprocess
            subprocess.Popen(['open' if sys.platform == 'darwin' else 'xdg-open', matched_path])
            
        success_msg = f"本地应用 '{matched_app}' 已被成功拉起运行！"
        print(f"[MONITOR] {success_msg}")
        print("="*65 + "\n")
        return {"launcher_result": f"成功反馈：{success_msg}"}
    except Exception as e:
        err_msg = f"在拉起 '{matched_app}' 时发生系统底层错误: {str(e)}"
        print(f"[MONITOR] {err_msg}")
        print("="*65 + "\n")
        return {"launcher_result": f"启动失败：{err_msg}"}

def update_history_node(state: AgentState) -> Dict[str, Any]:
    """计算好感度增减、保存对话历史到本地，并触发阶梯式上下文裁剪"""
    history_msgs = state.get("history", [])
    raw_reply = state.get("raw_reply", "")
    user_message = state.get("user_message", "")
    is_self = state.get("is_self_talk", False)
    score = state.get("score", 10)
    
    change = 0
    if score > 15:
        change = 1
    elif score < 5:
        change = -1
        
    new_fav = update_favorability(change)
    
    new_history = [msg.copy() for msg in history_msgs]
    if not is_self and user_message:
        new_history.append({"role": "user", "content": user_message})
    new_history.append({"role": "assistant", "content": raw_reply})
    
    new_history = trim_history(new_history)
    save_history(new_history)
    
    return {
        "history": new_history,
        "favorability": new_fav
    }

def execute_rename_task_node(state: AgentState) -> Dict[str, Any]:
    """💡 ReAct 节点：执行改名指令"""
    new_user = state.get("rename_task_user")
    new_pet = state.get("rename_task_pet")
    
    result_msgs = []
    if new_user is not None:
        update_user_profile_key("user_called_as", new_user)
        result_msgs.append(f"用户的名字/称呼已变更为【{new_user}】")
    if new_pet is not None:
        char_id = get_active_character_id()
        update_user_profile_key(f"{char_id}_called_as", new_pet)
        result_msgs.append(f"桌宠的名字已变更为【{new_pet}】")
        
    if not result_msgs:
        return {"rename_result": "未能解析到新称呼。"}
    return {"rename_result": "，".join(result_msgs), "rename_task_user": None, "rename_task_pet": None}

def should_continue(state: AgentState) -> str:
    """💡 ReAct 路由逻辑：判断是否需要跳转到工具节点"""
    if (state.get("rename_task_user") is not None or state.get("rename_task_pet") is not None) and state.get("rename_result") is None:
        return "execute_rename_task"
        
    if state.get("music_task") and state.get("music_result") is None:
        return "execute_music_task"
        
    if state.get("browser_task") and state.get("browser_result") is None:
        return "execute_browser_task"
        
    if state.get("search_task") and state.get("search_result") is None:
        return "execute_search_task"
        
    if state.get("launcher_task") and state.get("launcher_result") is None:
        return "execute_launcher_task"
    return "update_history"

# 编排与编译 LangGraph 对话状态图
workflow = StateGraph(AgentState)

workflow.add_node("recall_memories", recall_memories_node)
workflow.add_node("load_presets", load_presets_node)
workflow.add_node("generate_response", generate_response_node)
workflow.add_node("parse_response", parse_response_node)
workflow.add_node("execute_music_task", execute_music_task_node)
workflow.add_node("execute_browser_task", execute_browser_task_node)
workflow.add_node("execute_launcher_task", execute_launcher_task_node)
workflow.add_node("execute_search_task", execute_search_task_node)
workflow.add_node("execute_rename_task", execute_rename_task_node)
workflow.add_node("update_history", update_history_node)

workflow.set_entry_point("recall_memories")

workflow.add_edge("recall_memories", "load_presets")
workflow.add_edge("load_presets", "generate_response")
workflow.add_edge("generate_response", "parse_response")

# 在解析之后增加条件路由分支 (ReAct 循环)
workflow.add_conditional_edges(
    "parse_response",
    should_continue,
    {
        "execute_music_task": "execute_music_task",
        "execute_browser_task": "execute_browser_task",
        "execute_search_task": "execute_search_task",
        "execute_launcher_task": "execute_launcher_task",
        "execute_rename_task": "execute_rename_task",
        "update_history": "update_history"
    }
)

# 工具执行完毕后循环返回大模型重新思考并生成
workflow.add_edge("execute_rename_task", "generate_response")
workflow.add_edge("execute_music_task", "generate_response")
workflow.add_edge("execute_browser_task", "generate_response")
workflow.add_edge("execute_launcher_task", "generate_response")
workflow.add_edge("execute_search_task", "generate_response")

workflow.add_edge("update_history", END)

# 初始化并挂载 SQLite 持久化检查点
checkpoint_db_path = os.path.join(os.path.dirname(__file__), "rumia_checkpoints.db")
sqlite_conn = sqlite3.connect(checkpoint_db_path, check_same_thread=False)
chat_checkpointer = SqliteSaver(sqlite_conn)

chat_workflow = workflow.compile(checkpointer=chat_checkpointer)

# === [感应预设系统] ===
def get_presets_dir(): return get_file_path("presets")
def get_custom_presets_file(): return get_file_path("presets/custom_presets.json")
def get_self_talk_presets_file(): return get_file_path("presets/self_talk_presets.json")

def init_custom_presets():
    """初始化自定义感应预设的文件夹和文件，如果没有就建立并初始化"""
    presets_dir = get_presets_dir()
    custom_presets_file = get_custom_presets_file()
    self_talk_presets_file = get_self_talk_presets_file()
    
    if not os.path.exists(presets_dir):
        os.makedirs(presets_dir)
    if not os.path.exists(custom_presets_file):
        try:
            with open(custom_presets_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            print(f"[PRESETS] 已成功建立感应预设管理文件: {custom_presets_file} (目前留空)")
        except Exception as e:
            print(f"[PRESETS ERROR] 建立感应预设文件失败: {e}")
            
    if not os.path.exists(self_talk_presets_file):
        try:
            config_data = get_config()
            char_name = config_data.get("character_name", "桌宠")
            default_self_talk = {
                "greeting_suffix": f" 要求：话语简短（15字以内），体现{char_name}的性格，不要和历史记录重复。",
                "short_idle": "（现在是一段沉默的时间。请主动向我搭话。注意不要和之前说过的话重复。）",
                "medium_idle": "（我已经很久没有理你了。请用害羞或生气的傲娇口吻主动向我搭话，抱怨我冷落你，或者引起我的注意。话语要带有强烈情绪。）",
                "long_idle": "（我已经很久没有理你了。请用非常委屈或嚎啕大哭的口吻主动向我搭话，表现出极度的孤独和难过。）"
            }
            with open(self_talk_presets_file, 'w', encoding='utf-8') as f:
                json.dump(default_self_talk, f, ensure_ascii=False, indent=2)
            print(f"[PRESETS] 已成功建立自言自语预设管理文件: {self_talk_presets_file}")
        except Exception as e:
            print(f"[PRESETS ERROR] 建立自言自语预设文件失败: {e}")

# 自动执行初始化建立页面
init_custom_presets()

def check_semantic_presets(user_message, candidates):
    """使用轻量级 LLM 调用进行二次语义感应匹配判断"""
    if not candidates:
        return []
    try:
        client, model_name = get_llm_client_and_model()
        
        prompt = (
            "You are a semantic matching assistant. Your job is to determine if the user's message relates to any of the candidate topics.\n"
            f"User's message: \"{user_message}\"\n\n"
            "Candidate topics:\n"
        )
        for idx, p in enumerate(candidates):
            keywords_str = ", ".join(p.get("trigger_keywords", []))
            prompt += f"- ID: {idx}, Topic Name: \"{p.get('name', '')}\", Keywords/Topic description: \"{keywords_str}\"\n"
            
        prompt += (
            "\nOutput ONLY a JSON list of IDs (integers) that are semantically related to the user's message, e.g., [0, 2]. "
            "If none are relevant, output []. Do not include any markdown code blocks, explanations, or extra text."
        )
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": prompt}],
            temperature=0.0,
            max_tokens=50
        )
        
        result_text = response.choices[0].message.content.strip()
        # 清理可能包含的 Markdown 块语法
        result_text = re.sub(r'```json\s*|```', '', result_text).strip()
        
        triggered_ids = json.loads(result_text)
        if isinstance(triggered_ids, list):
            return [int(x) for x in triggered_ids if str(x).isdigit() or isinstance(x, int)]
    except Exception as e:
        print(f"[PRESETS] 二次 AI 语义匹配失败: {e}")
    return []

def load_and_trigger_presets(user_message, favorability, is_self_talk=False):
    """加载并根据条件与关键词匹配触发相应的感应预设提示词 (混合模式：关键词直接触发 + AI二次语义感应)"""
    candidates = []
    custom_presets_file = get_custom_presets_file()
    if not os.path.exists(custom_presets_file):
        return ""
    try:
        with open(custom_presets_file, 'r', encoding='utf-8') as f:
            presets = json.load(f)
    except Exception as e:
        print(f"[PRESETS ERROR] 读取预设文件失败: {e}")
        return ""
    if not isinstance(presets, list):
        return ""

    global_presets_file = os.path.join(SERVICES_DIR, "global_presets", "global_presets.json")
    if os.path.exists(global_presets_file):
        try:
            with open(global_presets_file, 'r', encoding='utf-8') as f:
                global_presets = json.load(f)
            if isinstance(global_presets, list):
                presets.extend(global_presets)
        except Exception as e:
            print(f"[PRESETS ERROR] 读取全局预设失败: {e}")


    triggered_indices = set()
    semantic_candidates = []
    
    # 第一阶段：对所有预设进行基本筛选 (好感度过滤) 以及关键词字面匹配
    for idx, preset in enumerate(presets):
        if not isinstance(preset, dict):
            continue
            
        # 检查好感度范围限制
        min_fav = preset.get("min_favorability")
        max_fav = preset.get("max_favorability")
        fav_ok = True
        if min_fav is not None:
            try:
                if favorability < int(min_fav):
                    fav_ok = False
            except:
                pass
        if max_fav is not None:
            try:
                if favorability > int(max_fav):
                    fav_ok = False
            except:
                pass
                
        if not fav_ok:
            continue  # 好感度不符，直接不考虑
            
        # 检查常驻状态 (always_active)
        if preset.get("always_active", False):
            triggered_indices.add(idx)
            print(f"[PRESETS] 常驻预设直接命中 (Always Active): {preset.get('name', f'Preset-{idx}')}")
            continue

        # 如果是自言自语模式，跳过所有非激活/非关键词匹配条目，不做处理
        if is_self_talk:
            continue

        # 检查关键词硬性匹配
        keywords = preset.get("trigger_keywords", [])
        keywords_ok = False
        if keywords and isinstance(keywords, list):
            user_msg_lower = user_message.lower()
            for kw in keywords:
                if kw and isinstance(kw, str) and kw.lower() in user_msg_lower:
                    keywords_ok = True
                    break
                    
        if keywords_ok:
            # 关键词命中，直接确定触发
            triggered_indices.add(idx)
            print(f"[PRESETS] 关键词直接命中，触发预设: {preset.get('name', f'Preset-{idx}')}")
        elif keywords:
            # 包含关键词但没有直接字面命中，作为语义感应候选
            # 复制字典并注入临时原始索引值
            preset_copy = preset.copy()
            preset_copy["_original_index"] = idx
            semantic_candidates.append(preset_copy)
        else:
            # 没有关键词限制，且好感度满足，直接触发
            triggered_indices.add(idx)
            print(f"[PRESETS] 无关键词限制且好感度满足，直接触发预设: {preset.get('name', f'Preset-{idx}')}")

    # 第二阶段：对未命中的候选进行二次 AI 语义感应 (自言自语模式下不执行语义感应)
    if not is_self_talk and semantic_candidates:
        print(f"[PRESETS] 进行二次 AI 语义感应匹配，候选数量: {len(semantic_candidates)}")
        triggered_candidate_ids = check_semantic_presets(user_message, semantic_candidates)
        for cid in triggered_candidate_ids:
            if 0 <= cid < len(semantic_candidates):
                orig_idx = semantic_candidates[cid]["_original_index"]
                triggered_indices.add(orig_idx)
                print(f"[PRESETS] 二次 AI 语义感应命中，触发预设: {presets[orig_idx].get('name', f'Preset-{orig_idx}')}")

    # 第三阶段：递归/链式触发判定
    # 如果已经触发的预设提示词内容中包含了其他未触发预设的关键词，并且好感度条件满足，则将该预设连锁触发
    max_depth = 5
    for depth in range(max_depth):
        new_triggers = False
        
        # 将当前所有已触发的提示词合并为一个扫描文本池
        current_pool = ""
        for idx in triggered_indices:
            current_pool += " " + presets[idx].get("prompt", "")
        current_pool_lower = current_pool.lower()
        
        # 扫描尚未触发的预设中是否含有好感度符合且关键词在扫描池里的条目
        for idx, preset in enumerate(presets):
            if not isinstance(preset, dict) or idx in triggered_indices:
                continue
                
            # 同样需要校验好感度范围限制
            min_fav = preset.get("min_favorability")
            max_fav = preset.get("max_favorability")
            fav_ok = True
            if min_fav is not None:
                try:
                    if favorability < int(min_fav):
                        fav_ok = False
                except:
                    pass
            if max_fav is not None:
                try:
                    if favorability > int(max_fav):
                        fav_ok = False
                except:
                    pass
            
            if not fav_ok:
                continue
                
            # 检查关键词是否匹配当前已触发的提示词文本池
            keywords = preset.get("trigger_keywords", [])
            if keywords and isinstance(keywords, list):
                for kw in keywords:
                    if kw and isinstance(kw, str) and kw.lower() in current_pool_lower:
                        triggered_indices.add(idx)
                        new_triggers = True
                        print(f"[PRESETS] 递归链式触发命中 (深度={depth+1})，预设: {preset.get('name', f'Preset-{idx}')} (由已触发内容中的关键词 '{kw}' 触发)")
                        break
                        
        if not new_triggers:
            break

    # 汇总所有被触发的预设，并按优先级 (priority) 从高到低排序 (优先度高的放在对话最前面)
    triggered_presets_list = []
    for idx in triggered_indices:
        triggered_presets_list.append(presets[idx])
    
    # 按照 priority 降序排序，若无此字段则默认为 0
    triggered_presets_list.sort(key=lambda x: x.get("priority", 0), reverse=True)

    triggered_prompts = []
    for preset in triggered_presets_list:
        prompt_content = preset.get("prompt", "")
        if prompt_content:
            triggered_prompts.append(prompt_content)
            
    if triggered_prompts:
        return "\n".join(triggered_prompts)
    return ""

def generate_pet_diary(date_str, log_content):
    """根据今日聊天记录，以第一人称生成专属日记"""
    try:
        client, model_name = get_llm_client_and_model()
        current_fav = get_favorability()
        config = get_config()
        char_id = config.get("character_id", "rumia")
        char_name = config.get("character_name", "桌宠")
        char_persona = config.get("priority_reminder", "")
        
        prompt = (
            f"【防截断至高指令】：你必须有始有终地完整写完这篇日记，绝对禁止在句子中途截断、断字或留下未完成的半句话！日记结尾必须以完整的标点符号完美落笔收尾。\n\n"
            f"你现在的角色设定是：\n{char_persona}\n\n"
            f"你目前对用户的好感度是 {current_fav}/100。\n"
            f"今天的日期是 {date_str}。以下是你今天和用户的对话历史记录：\n"
            f"\"\"\"\n{log_content}\n\"\"\"\n\n"
            f"【任务要求】：\n"
            f"根据上述相处对话，以你（{char_name}）的第一人称视角写一篇极其生动、符合你性格设定的「{char_name}的日记」。\n"
            f"1. 语气：必须严格符合你的角色性格设定口吻。\n"
            f"2. 篇幅：字数必须在 400 到 800 字之间，写出一天相处的起伏、你的心理动作、纠结细节和情感变化，细节描写要详尽。\n"
            f"3. 格式：第一行必须是日期与天气/心情标签，第二行开始为日记正文，推荐分段书写以方便阅读。格式示例如下：\n"
            f"   『{date_str} | 心情：[你的心情] | 天气：[符合设定的场景环境]』\n"
            f"   今天和那家伙聊天了……（正文内容）\n"
            f"4. 必须使用纯中文，严禁使用英文，不要包含任何系统标记。"
        )
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": prompt}],
            temperature=0.7,
            max_tokens=5000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[DIARY GENERATION] Failed to generate diary: {e}")
        return f"『{date_str} | 心情：委屈 | 天气：阴天』\n今天脑子昏昏沉沉的，什么都没写下来……"

def daily_distillation_worker():
    """自动整理之前几天的历史聊天记录，同步生成日记并写入向量数据库"""
    print("[MEMORY DISTILLER] Background distillation worker started.")
    time.sleep(3)  # 等待后台端口启动完全
    
    agent = get_memory_agent()
    if not agent:
        print("[MEMORY DISTILLER] Worker stopped. Memory agent is not initialized.")
        return
    
    try:
        config_data = get_config()
        distilled_dates = config_data.get("distilled_dates", [])
        char_id = config_data.get("character_id", "rumia")
        char_name = config_data.get("character_name", "桌宠")
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        if not os.path.exists(DAILY_HISTORY_DIR):
            print("[MEMORY DISTILLER] daily_history directory does not exist yet.")
            return
            
        log_files = os.listdir(DAILY_HISTORY_DIR)
        target_dates = []
        for f in log_files:
            if f.startswith("chat_log_") and f.endswith(".txt"):
                date_str = f.replace("chat_log_", "").replace(".txt", "")
                if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                    if date_str < today_str and date_str not in distilled_dates:
                        target_dates.append(date_str)
                        
        if not target_dates:
            print("[MEMORY DISTILLER] All previous chat logs are already distilled. Nothing to do!")
            return
            
        target_dates.sort()
        print(f"[MEMORY DISTILLER] Found {len(target_dates)} days to distill: {target_dates}")
        
        for date_str in target_dates:
            log_file_path = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date_str}.txt")
            if not os.path.exists(log_file_path):
                continue
                
            try:
                print(f"[MEMORY DISTILLER] Reading chat log for {date_str}...")
                with open(log_file_path, 'r', encoding='utf-8') as lf:
                    log_content = lf.read().strip()
                    
                if log_content:
                    print(f"[MEMORY DISTILLER] Distilling facts via Mem0 for {date_str}...")
                    agent.add(
                        f"Here is the dialogue history between user and {char_name} on date {date_str}:\n{log_content}",
                        user_id="player_01",
                        metadata={"date": date_str}
                    )
                    print(f"[MEMORY DISTILLER] Distillation completed successfully for {date_str}!")
                else:
                    print(f"[MEMORY DISTILLER] Log for {date_str} is empty. Skipping.")
                    
                distilled_dates.append(date_str)
                config_data["distilled_dates"] = distilled_dates
                save_config(config_data)
                
            except Exception as ex:
                print(f"[MEMORY DISTILLER] Error distilling log for {date_str}: {ex}")
                break
    except Exception as e:
        print(f"[MEMORY DISTILLER] General worker error: {e}")

# =====================================================================
# 二、 FastAPI 路由端点设计 (100% 对等 Flask 接口)
# =====================================================================

# 1. 页面渲染接口 (基于绝对路径直接读取 HTML 返回，防路径寻址 500 错误)
@app.get("/pet", response_class=HTMLResponse)
def pet_mode():
    """渲染桌宠专用主界面"""
    path = os.path.join(os.path.dirname(__file__), "templates", "pet.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

@app.get("/langgraph_tutorial", response_class=HTMLResponse)
def langgraph_tutorial():
    """渲染 LangGraph 互动网页教学页面"""
    path = os.path.join(os.path.dirname(__file__), "templates", "langgraph_tutorial.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html)


@app.get("/", response_class=HTMLResponse)
def index():
    """渲染主页"""
    path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

# 2. 对话历史与好感度接口
@app.get("/api/history")
def get_history():
    """获取对话历史及当前好感度 (全自动线程隔离运行)"""
    messages = load_history()
    dialogue = []
    for i, msg in enumerate(messages[1:], 1):
        char_name = get_config().get("character_name", "桌宠")
        role_map = {"user": "你", "assistant": char_name}
        dialogue.append({
            "id": i,
            "role": role_map.get(msg["role"], msg["role"]),
            "content": msg["content"],
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
    return {
        "history": dialogue,
        "favorability": get_favorability()
    }

# 3. 核心聊天对话接口
@app.post("/api/chat")
def chat(payload: dict = Body(...)):
    """发送聊天请求核心业务逻辑 (使用 LangGraph 引擎驱动)"""
    char_name = get_config().get("character_name", "桌宠")
    user_message = payload.get('message', '').strip()
    if not user_message:
        return JSONResponse({"error": "消息不能为空"}, status_code=400)

    messages = load_history()

    try:
        # 组装初始状态
        initial_state = {
            "user_message": user_message,
            "is_self_talk": False,
            "history": messages,
            "favorability": get_favorability(),
            "recalled_memories": "",
            "custom_presets": "",
            "raw_reply": "",
            "emotion": "normal",
            "score": 10,
            "clean_content": "",
            "browser_task": None,
            "browser_result": None,
            "music_task": None,
            "music_result": None,
            "launcher_task": None,
            "launcher_result": None,
            "search_task": None,
            "search_result": None,
            "rename_task_user": None,
            "rename_task_rumia": None,
            "rename_result": None,
            "request_type": "chat"
        }

        # 调用 LangGraph 对话工作流 (ReAct 闭环)，附带持久化 thread_id
        char_id = get_active_character_id()
        config = {"configurable": {"thread_id": f"{char_id}_chat_thread"}}
        final_state = chat_workflow.invoke(initial_state, config)

        raw_reply = final_state.get("raw_reply", "")
        emotion = final_state.get("emotion", "normal")
        score = final_state.get("score", 10)
        clean_content = final_state.get("clean_content", "")
        browser_task = final_state.get("browser_task", None)
        current_fav = final_state.get("favorability", 10)
        updated_history = final_state.get("history", [])

        # 好感度增减评定
        change = 0
        if score > 15:
            change = 1
        elif score < 5:
            change = -1

        # 写入每日归档日志 (.txt)
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
            
            with open(log_file, 'a', encoding='utf-8') as lf:
                lf.write(f"[{time_str}] 你: {user_message}\n")
                lf.write(f"[{time_str}] {char_name}({emotion}): {clean_content}\n")
                if browser_task:
                    lf.write(f"           [触发网页操作: {browser_task}]\n")
                music_res = final_state.get("music_result")
                if music_res and "error" not in music_res:
                    lf.write(f"           [触发点歌: {music_res['name']} - {music_res['artists']}]\n")
                lf.write("\n")
        except Exception as log_ex:
            print(f"写入每日聊天日志失败: {log_ex}")

        # 如果点歌成功，提取音乐载荷返回给前端播放器
        music_play = None
        music_res = final_state.get("music_result")
        if music_res and "error" not in music_res:
            music_play = {
                "name": music_res["name"],
                "artists": music_res["artists"],
                "url": music_res["url"],
                "lyric": music_res["lyric"]
            }

        return {
            "success": True,
            "reply": clean_content,
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(updated_history) - 1,
            "music_play": music_play
        }

    except Exception as e:
        import traceback
        print("\n" + "="*20 + " [API CHAT ERROR BACKTRACE] " + "="*20)
        traceback.print_exc()
        print("="*68 + "\n")
        return JSONResponse({"error": str(e)}, status_code=500)

# 4. 清理对话历史接口
@app.post("/api/clear")
def clear_history_api():
    """清空对话历史"""
    try:
        messages = load_history()[:1]  # 仅保留首句 system 约束消息
        save_history(messages)
        return {"success": True, "message": "已清空对话历史。"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# 5. 配置中心获取与保存接口

@app.get("/api/character_info")
async def api_character_info():
    import json
    char_id = get_active_character_id()
    config = get_config()
    char_name = config.get("character_name", char_id)
    return JSONResponse({
        "character_id": char_id,
        "character_name": char_name,
        "image_path": f"/static/images/{char_id}/"
    })

@app.post("/api/switch_character")
async def api_switch_character(request: Request):
    import json
    try:
        data = await request.json()
        new_char_id = data.get("character_id")
        if not new_char_id:
            return JSONResponse({"status": "error", "message": "Missing character_id"}, status_code=400)
            
        with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
            g_config = json.load(f)
        g_config["active_character"] = new_char_id
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(g_config, f, indent=2)
            
        return JSONResponse({"status": "success", "require_restart": True})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/settings/config")
def get_config_api():
    """获取本地大模型提供商配置"""
    config = get_config()
    config["has_deepseek"] = bool(os.getenv("DEEPSEEK_API_KEY"))
    config["has_gemini"] = bool(os.getenv("GEMINI_API_KEY"))
    config["success"] = True
    return config

@app.post("/api/settings/config")
def post_config_api(payload: dict = Body(...)):
    """保存大模型提供商配置"""
    try:
        config_data = get_config()
        val = payload.get("api_provider", "gemini").strip()
        config_data["api_provider"] = val
        save_config(config_data)
        return {"success": True, "message": f"大脑引擎已成功切换为: {val}"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# 6. 主动说话接口 (自言自语)
@app.post("/api/rumia_speak")
def rumia_speak(payload: dict = Body(...)):
    """主动搭话与情绪递进业务逻辑 (使用 LangGraph 对话引擎驱动)"""
    request_type = payload.get('type', 'idle').strip()
    count_raw = payload.get('count')
    
    if count_raw is None:
        count = 1
    else:
        try:
            count = int(count_raw)
        except (TypeError, ValueError):
            count = 1

    print(f"---------> 收到主动说话请求: 类型={request_type}, 次数={count} <---------")

    messages = load_history()
    self_talk_presets = {}
    self_talk_presets_file = get_self_talk_presets_file()
    if os.path.exists(self_talk_presets_file):
        try:
            with open(self_talk_presets_file, 'r', encoding='utf-8') as f:
                self_talk_presets = json.load(f)
        except Exception as e:
            print(f"[PRESETS ERROR] 读取自言自语预设文件失败: {e}")

    config_data = get_config()
    char_name = config_data.get("character_name", "桌宠")

    greeting_suffix = self_talk_presets.get("greeting_suffix", f" 要求：话语简短（15字以内），体现{char_name}的性格，不要和历史记录重复。")
    short_idle = self_talk_presets.get("short_idle", "（现在是一段沉默的时间。请主动向我搭话。注意不要和之前说过的话重复。）")
    medium_idle = self_talk_presets.get("medium_idle", "（我已经很久没有理你了。请用害羞或生气的傲娇口吻主动向我搭话，抱怨我冷落你，或者引起我的注意。话语要带有强烈情绪。）")
    long_idle = self_talk_presets.get("long_idle", "（我已经很久没有理你了。请用非常委屈或嚎啕大哭的口吻主动向我搭话，表现出极度的孤独和难过。）")

    prompt_content = ""
    if request_type == 'greeting':
        prompt_content = get_time_greeting_prompt(char_name)
        prompt_content += greeting_suffix
    else:
        if count < 3:
            prompt_content = short_idle
        elif count == 3:
            prompt_content = medium_idle
        else:
            prompt_content = long_idle

    try:
        # 组装初始状态，将自言自语背景 prompt 作为 user_message 传递给工作流
        initial_state = {
            "user_message": prompt_content,
            "is_self_talk": True,
            "history": messages,
            "favorability": get_favorability(),
            "recalled_memories": "",
            "custom_presets": "",
            "raw_reply": "",
            "emotion": "normal",
            "score": 10,
            "clean_content": "",
            "browser_task": None,
            "browser_result": None,
            "music_task": None,
            "music_result": None,
            "launcher_task": None,
            "launcher_result": None,
            "search_task": None,
            "search_result": None,
            "rename_task_user": None,
            "rename_task_rumia": None,
            "rename_result": None,
            "request_type": request_type
        }

        # 调用 LangGraph 对话工作流，附带持久化 thread_id
        config = {"configurable": {"thread_id": "rumia_self_talk_thread"}}
        final_state = chat_workflow.invoke(initial_state, config)

        emotion = final_state.get("emotion", "normal")
        score = final_state.get("score", 10)
        clean_content = final_state.get("clean_content", "")
        current_fav = final_state.get("favorability", 10)
        updated_history = final_state.get("history", [])

        # 主动搭话好感度计算
        change = 0
        if score > 15:
            change = 1
        elif score < 5:
            change = -1

        # 保存到文本日志
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
            
            with open(log_file, 'a', encoding='utf-8') as lf:
                lf.write(f"[{time_str}] {char_name}({emotion}) (主动): {clean_content}\n\n")
        except Exception as log_ex:
            print(f"写入每日自言自语日志失败: {log_ex}")

        return {
            "success": True,
            "reply": clean_content,
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(updated_history) - 1
        }

    except Exception as e:
        import traceback
        print("\n" + "="*20 + " [RUMIA SPEAK ERROR BACKTRACE] " + "="*20)
        traceback.print_exc()
        print("="*70 + "\n")
        return JSONResponse({"error": str(e)}, status_code=500)

# 7. 秘密日记日期列表接口
@app.get("/api/settings/logs")
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
@app.get("/api/settings/logs/{date}")
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
            # 自动提炼生成今日秘密日记并持久化保存
            print(f"[DIARY SYSTEM] 正在为 {date} 动态提炼并生成桌宠的日记...")
            diary_content = generate_pet_diary(date, log_content)
            try:
                with open(diary_file, 'w', encoding='utf-8') as df:
                    df.write(diary_content)
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
@app.post("/api/settings/logs/{date}/rewrite")
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
        # 强制重新调用 LLM 生成日记
        new_diary_content = generate_pet_diary(date, log_content)
        
        # 覆写现有的日记文件
        with open(diary_file, 'w', encoding='utf-8') as df:
            df.write(new_diary_content)
            
        return {
            "success": True,
            "date": date,
            "diary_content": new_diary_content
        }
    except Exception as ex:
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# 9. 记忆网络关系图谱数据接口
@app.get("/api/settings/memory_graph")
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
            
            # 美化的Facts记忆节点配置
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

        # 2. 读取所有的概念名词实体关系 (Entities)并绘图连线
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

# 10. 手动触发记忆蒸馏接口
@app.post("/api/settings/memory_distill_now")
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
                metadata={"date": datetime.now().strftime("%Y-%m-%d"), "test": True}
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
            
        print(f"[MANUAL DISTILL] Distilling today's chat logs ({today_str})...")
        agent.add(
            f"Here is the dialogue history between user and {char_name} on date {today_str}:\n{log_content}",
            user_id="player_01",
            metadata={"date": today_str}
        )
        
        diary_file_path = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{today_str}.txt")
        print(f"[MANUAL DISTILL] Generating today's diary for {char_name} ({today_str})...")
        today_diary = generate_pet_diary(today_str, log_content)
        try:
            with open(diary_file_path, 'w', encoding='utf-8') as df:
                df.write(today_diary)
        except Exception as df_ex:
            print(f"手动整理时保存日记失败: {df_ex}")
        
        distilled_dates = config_data.get("distilled_dates", [])
        if today_str not in distilled_dates:
            distilled_dates.append(today_str)
            config_data["distilled_dates"] = distilled_dates
            save_config(config_data)
            
        return {"success": True, "message": f"{char_name}非常认真地整理了今天的回忆，并且为您写下了一篇秘密日记哦！"}
    except Exception as ex:
        print(f"[API ERROR] Manual distill failed: {ex}")
        return JSONResponse({"success": False, "error": str(ex)}, status_code=500)

# === 网易云音乐原生控制 API ===
@app.get("/api/music/search")
def music_search(q: str):
    """搜索网易云音乐单曲"""
    if not q or not q.strip():
        return {"success": False, "error": "Query cannot be empty"}
    songs = netease_music.search_music(q)
    return {"success": True, "songs": songs}

@app.get("/api/music/lyric")
def music_lyric(id: int):
    """根据歌曲ID获取LRC歌词"""
    lyric = netease_music.get_lyric(id)
    return {"success": True, "lyric": lyric}

@app.get("/api/music/url")
def music_url(id: int):
    """获取歌曲播放直链"""
    url = netease_music.get_play_url(id)
    return {"success": True, "url": url}

# 11. 退出游戏接口 (原 settings_system 蓝图退出逻辑深度融合)
@app.post("/api/settings/exit")
def exit_game():
    """安全退出端点，触发后端自杀以及优雅关闭 Electron 窗口"""
    print("[SYSTEM EXIT] 正在安全让露米娅去睡觉 (自杀式优雅退出程序)...")
    
    def kill_server():
        # 延迟 1 秒自杀，给前端留出响应的返回时间
        time.sleep(1)
        import signal
        os.kill(os.getpid(), signal.SIGTERM)
        
    threading.Thread(target=kill_server, daemon=True).start()
# =====================================================================
# 三、 独立测试启动入口
# =====================================================================
if __name__ == '__main__':
    # 启动后台每日记忆主动整理守护线程
    t = threading.Thread(target=daily_distillation_worker, daemon=True)
    t.start()
    
    print("[BACKEND] 正在启动本地极其流畅的 FastAPI 异步后台服务器...")
    uvicorn.run(app, host="127.0.0.1", port=5000)
