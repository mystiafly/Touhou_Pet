import os
import json
import threading
from datetime import datetime
from mem0 import Memory
from core.config_manager import get_config, get_character_dir, get_file_path, get_active_character_id
from core.profile_manager import get_favorability

memory_agent = None
memory_agent_lock = threading.Lock()

DAILY_HISTORY_DIR = get_file_path("daily_history")
MIN_HISTORY_ROUNDS = 8
MAX_HISTORY_ROUNDS = 16

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
                vector_dims = 384
            elif deepseek_key:
                embed_suffix = "deepseek"
                vector_dims = 384
                
        mem0_config = {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "path": os.path.join(get_character_dir(), "qdrant_db"),
                    "collection_name": f"{get_active_character_id()}_memory_{embed_suffix}",
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
                    "provider": "huggingface",
                    "config": {
                        "model": "sentence-transformers/all-MiniLM-L6-v2"
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
        qdrant_path = os.path.join(get_character_dir(), "qdrant_db")
        collection_name = f"{get_active_character_id()}_memory_{embed_suffix}"
        try:
            from qdrant_client import QdrantClient
            client = QdrantClient(path=qdrant_path)
            
            # 检查并修复主集合
            try:
                col_info = client.get_collection(collection_name)
                vectors_config = col_info.config.params.vectors
                existing_dims = None
                
                # Qdrant vectors config can be an object or a dict of objects
                if hasattr(vectors_config, 'size'):
                    existing_dims = vectors_config.size
                elif isinstance(vectors_config, dict) and len(vectors_config) > 0:
                    # Get the size of the first named vector
                    first_val = list(vectors_config.values())[0]
                    if hasattr(first_val, 'size'):
                        existing_dims = first_val.size
                
                if existing_dims is None or existing_dims != vector_dims:
                    print(f"[QDRANT AUTO-HEAL] 检测到主集合 '{collection_name}' 维度冲突: 期望 {vector_dims} 维，实际 {existing_dims} 维。正在自动删除重建...")
                    client.delete_collection(collection_name)
            except Exception as e:
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
