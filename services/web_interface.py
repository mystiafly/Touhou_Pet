# web_interface.py - Web界面后端
from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import json
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
# 导入你的主程序功能
import sys
import re
import subprocess

sys.path.append('.')  # 确保可以导入当前目录的模块

# 直接导入你的现有函数（需要稍微调整你的主程序）
# 为了简化，我们复制核心逻辑到这里
from settings_system import settings_bp
# [新增] 导入时间系统
from time_system import get_time_greeting_prompt

CONFIG_FILE = "config.json"

def get_config():
    """读取本地配置，默认api_provider为gemini"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"api_provider": "gemini"}

def save_config(config_data):
    """保存本地配置"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存配置失败: {e}")

def get_llm_client_and_model():
    """
    根据配置动态获取大模型客户端和模型名称。
    支持 Gemini 和 DeepSeek V4 (Flash / Pro) 以及 DeepSeek V3 (Standard)。
    默认优先使用系统或环境中的 GEMINI_API_KEY。
    """
    from openai import OpenAI
    
    # 优先检测本地配置 config.json，然后再检测环境中的 API_PROVIDER
    config_data = get_config()
    provider = config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini")).lower()
    
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    # 1. 使用 Gemini (优先默认)
    if provider == "gemini" and gemini_key:
        return OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        ), "gemini-2.5-flash"
        
    # 2. 使用 DeepSeek V4 Pro
    if provider == "deepseek-v4-pro" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-v4-pro"
        
    # 3. 使用 DeepSeek V4 Flash
    if provider == "deepseek-v4-flash" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-v4-flash"
        
    # 4. 使用 DeepSeek V3 (deepseek-chat)
    if provider == "deepseek-chat" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    # 5. 自动兜底与向前兼容：如果 provider 设为旧的 "deepseek"
    if provider == "deepseek" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    # 6. 自动兜底 (无配置)
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
        
    raise ValueError("❌ 错误：在系统环境变量或 .env 中均未找到 GEMINI_API_KEY 或 DEEPSEEK_API_KEY！请配置至少一个。")

import threading
import time
from mem0 import Memory

# Initialize Mem0 Memory agent for Rumia (384-dim local embeddings + DeepSeek LLM)
mem0_config = {
    "llm": {
        "provider": "openai",
        "config": {
            "model": "deepseek-chat",
            "openai_base_url": "https://api.deepseek.com",
            "api_key": os.getenv("DEEPSEEK_API_KEY"),
            "temperature": 0.1,
            "max_tokens": 1000
        }
    },
    "custom_instructions": "请使用纯中文提取并记录关于用户的长短期事实与偏好。所有提炼的事实必须采用自然、简短的中文陈述句记录，严禁使用英文！例如：'用户最喜欢吃巧克力饼干'、'用户的生日是5月27日'。",
    "embedder": {
        "provider": "huggingface",
        "config": {
            "model": "multi-qa-MiniLM-L6-cos-v1"
        }
    },
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "collection_name": "rumia_memory",
            "path": os.path.join("daily_history", "qdrant_db"),
            "embedding_model_dims": 384
        }
    }
}

memory_agent = None
memory_agent_lock = threading.Lock()

def get_memory_agent():
    """Lazy thread-safe initialization of Mem0 Memory agent to prevent debug reloader file lock collisions."""
    global memory_agent
    if memory_agent is None:
        with memory_agent_lock:
            if memory_agent is None:
                try:
                    memory_agent = Memory.from_config(mem0_config)
                    print("[SUCCESS] Mem0 Memory agent initialized successfully in Flask Backend.")
                except Exception as me:
                    print(f"[WARNING] Mem0 initialization failed in Flask Backend: {me}")
    return memory_agent

app = Flask(__name__)

# [新增] 注册蓝图
# 所有 settings_bp 里的路由都会自动加上前缀，或者保持原样
app.register_blueprint(settings_bp)

# 配置
HISTORY_FILE = "dialog_history.json"
DAILY_HISTORY_DIR = "daily_history"
MAX_HISTORY_ROUNDS = 20000

@app.route('/pet')
def pet_mode():
    """渲染桌宠专用界面"""
    return render_template('pet.html')


# [新增] 好感度文件路径
FAVORABILITY_FILE = "favorability.json"

def get_favorability():
    """读取好感度，默认60"""
    if os.path.exists(FAVORABILITY_FILE):
        try:
            with open(FAVORABILITY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('score', 60)
        except:
            pass
    return 60

def update_favorability(change):
    """更新好感度"""
    current = get_favorability()
    new_score = current + change
    # 限制范围 0-100 (可选)
    new_score = max(0, min(100, new_score))

    try:
        with open(FAVORABILITY_FILE, 'w', encoding='utf-8') as f:
            json.dump({"score": new_score}, f)
    except Exception as e:
        print(f"保存好感度失败: {e}")

    return new_score

# ========== 复制你的历史管理函数 ==========
def load_history():
    """从文件加载对话历史，如果文件不存在则初始化新的历史。"""
    current_fav = get_favorability()
    system_prompt = (
        f"你是东方Project中的露米娅，一个喜欢在黑暗中恶作剧的食人妖怪。你目前对用户的好感度是 {current_fav}/100。\n"
        "【重要指令】\n"
        "1. 心情：从 [normal], [angry], [shy], [crying] 中选择。\n"
        "2. 感情评分：对用户的这句话打分（0-20）。10分是基准，>10表示开心/喜欢，<=10表示生气/无聊/讨厌。\n"
        "3. 浏览器操作：如果用户的话语中表达了让你通过浏览器代为执行某项操作、上网搜索网页、查找信息、访问页面或截图等明确意图（例如说：“帮我开浏览器查下天气”、“去网上搜一下最近的科技新闻”、“帮我打开百度搜索XXX”、“帮我找一下GitHub上的XXX仓库并告诉我多少Stars”等），请在你的回复内容的最末尾加上 `[BROWSER_TASK: <具体操作的简洁描述指令>]` 标记（用英文方括号）。例如：`[normal][12]好啊，我这就去开浏览器帮你搜一下！[BROWSER_TASK: 在百度上搜索今天的天气并在结果中找天气详情]`。如果用户没有表达任何需要上网/开浏览器做任务的意图，绝对不能包含 `[BROWSER_TASK: ...]` 标记。\n"
        "回答格式必须严格遵循：'[心情][评分]对话内容'（如有浏览器意图则在最末尾附加 [BROWSER_TASK: ...]）。\n"
        "例如：'[normal][12]嘿嘿，是那样吗？' 或 '[angry][5]都要怪你啦！' 或 '[shy][18]其、其实我也不是那么饿...'\n"
        "除了对话内容外，不要输出任何其他解释。"
    )

    # 1. 尝试读取文件
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                hist = json.load(f)
                if hist and hist[0]["role"] == "system":
                    hist[0]["content"] = system_prompt
                return hist
        except (json.JSONDecodeError, IOError) as e:
            print(f"警告：读取历史文件失败，将创建新历史。错误：{e}")

    # 2. 如果文件不存在，或者读取失败，就会运行到这里
    return [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

def save_history(messages):
    """将对话历史保存到文件，并按天归档备份。"""
    try:
        # 1. 保存活动的对话历史，供运行期读取
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)
            
        # 2. 每日 JSON 备份归档（按 YYYY-MM-DD 存储）
        if not os.path.exists(DAILY_HISTORY_DIR):
            os.makedirs(DAILY_HISTORY_DIR)
            
        today_str = datetime.now().strftime("%Y-%m-%d")
        daily_json = os.path.join(DAILY_HISTORY_DIR, f"dialog_history_{today_str}.json")
        with open(daily_json, 'w', encoding='utf-8') as df:
            json.dump(messages, df, ensure_ascii=False, indent=2)
    except IOError as e:
        print(f"警告：保存历史文件失败。错误：{e}")

def trim_history(messages, max_rounds):
    """修剪历史，只保留最近N轮对话（保留系统消息）。"""
    if len(messages) <= 1:
        return messages
    system_message = messages[0]
    dialogue = messages[1:]
    if len(dialogue) > max_rounds * 2:
        dialogue = dialogue[-(max_rounds * 2):]
    return [system_message] + dialogue

# ========== API路由 ==========
@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/history', methods=['GET'])
def get_history():
    """获取对话历史"""
    messages = load_history()
    # 过滤掉系统消息，只返回对话内容
    dialogue = []
    for i, msg in enumerate(messages[1:], 1):  # 跳过系统消息
        role_map = {"user": "你", "assistant": "露米娅"}
        dialogue.append({
            "id": i,
            "role": role_map.get(msg["role"], msg["role"]),
            "content": msg["content"],
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })
    return jsonify({"history": dialogue})

@app.route('/api/chat', methods=['POST'])
def chat():
    """处理用户消息"""
    data = request.json
    user_message = data.get('message', '').strip()
    if not user_message: return jsonify({"error": "消息不能为空"}), 400

    messages = load_history()
    messages.append({"role": "user", "content": user_message})

    try:
        client, model_name = get_llm_client_and_model()

        # Retrieve relevant memories from Mem0
        recalled_memories = ""
        agent = get_memory_agent()
        if agent:
            try:
                results = agent.search(user_message, filters={"user_id": "player_01"}, limit=3)
                results_list = results.get("results", []) if isinstance(results, dict) else (results if isinstance(results, list) else [])
                print(f"[MEMORY RECALL] Query: '{user_message}' - Found {len(results_list)} memories.")
                if results_list:
                    recalled_memories = "\n".join([f"- {r['memory']}" for r in results_list if isinstance(r, dict) and 'memory' in r])
                    print(f"[MEMORY RECALL] Successfully retrieved: {recalled_memories}")
            except Exception as me:
                print(f"[MEMORY RECALL] Search failed: {me}")

        # Prepare active messages list for LLM call without mutating the saved dialog history
        active_messages = [msg.copy() for msg in messages]
        
        # 获取当前好感度
        current_fav = get_favorability()

        # 构建 P0 最高优先级系统提醒（追加在消息队列最末尾，即用户消息之后）
        priority_reminder = (
            f"[SYSTEM REMINDER - P0 HIGHEST PRIORITY]\n"
            f"【最高优先级提醒与行为约束】\n"
        )
        if recalled_memories:
            priority_reminder += (
                f"1. 唤醒的长期记忆（关于用户的偏好与经历）：\n"
                f"{recalled_memories}\n"
                f"（请在回复中自然、适度地运用这些记忆来展示与用户的熟悉感，绝对不能被动或死板地背诵，也不要向用户揭穿这是系统灌输的记忆。）\n"
            )
        priority_reminder += (
            f"2. 当前你（露米娅）对用户的好感度为: {current_fav}/100。\n"
            f"3. 角色约束：请严格扮演露米娅（一个性格傲娇、古灵精怪、喜欢在黑暗中恶作剧的食人妖怪），用中文口吻回答。\n"
            f"4. 格式约束：你的回复必须且只能遵循 '[心情][评分]对话内容' 格式要求（如含有明确浏览器自动化意图则在最末尾附加 `[BROWSER_TASK: ...]`）。"
        )
        
        active_messages.append({"role": "system", "content": priority_reminder})

        # Print all messages sent to the AI in the console in real-time
        print("\n" + "="*40 + " [AI REQUEST] " + "="*40)
        print(f"Model: {model_name}")
        for idx, msg in enumerate(active_messages, 1):
            print(f"--- Message #{idx} ({msg['role'].upper()}) ---")
            print(msg['content'])
        print("="*94 + "\n")

        response = client.chat.completions.create(
            model=model_name, messages=active_messages, stream=False
        )

        raw_reply = response.choices[0].message.content

        # Print returned raw content in the console in real-time
        print("\n" + "="*40 + " [AI RESPONSE] " + "="*40)
        print(raw_reply)
        print("="*95 + "\n")

        # [修改] 接收三个返回值
        emotion, score, clean_content = parse_reply(raw_reply)

        # 检测用户意图，是否有浏览器操作任务
        browser_task = None
        task_match = re.search(r'\[BROWSER_TASK:\s*(.*?)\]', raw_reply, re.IGNORECASE)
        if task_match:
            browser_task = task_match.group(1).strip()
            # 从返回给前端的 clean_content 中剔除浏览器任务标签，不在聊天气泡中显示
            clean_content = re.sub(r'\[BROWSER_TASK:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()
            
            print(f"[BROWSER INTEGRATION] 检测到浏览器操作意图: {browser_task}")
            try:
                services_dir = os.path.dirname(os.path.abspath(__file__))
                rumia_dir = os.path.dirname(services_dir)
                workspace_dir = os.path.dirname(rumia_dir)
                browser_use_dir = os.path.join(workspace_dir, 'browser-use')
                
                venv_python = os.path.join(browser_use_dir, '.venv', 'Scripts', 'python.exe')
                demo_py = os.path.join(browser_use_dir, 'demo.py')
                
                if os.path.exists(venv_python) and os.path.exists(demo_py):
                    # 启动后台非阻塞 Python 进程来运行 browser-use，同时完全独立运行 (DETACHED_PROCESS)
                    subprocess.Popen(
                        [venv_python, 'demo.py', browser_task],
                        cwd=browser_use_dir,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=0x00000008 if os.name == 'nt' else 0
                    )
                    print(f"[BROWSER INTEGRATION] 成功在后台拉起浏览器自动化进程！")
                else:
                    print(f"[BROWSER INTEGRATION] 警告: 未找到 browser-use 路径。python={venv_python}, demo={demo_py}")
            except Exception as ex:
                print(f"[BROWSER INTEGRATION] 启动浏览器自动化进程失败: {ex}")

        # === [修改开始] 新的好感度逻辑 ===
        change = 0
        if score > 15:
            change = 1       # 超开心才加分
        elif score < 5:
            change = -1      # 很生气才减分
        else:
            change = 0       # 中间区间 (5-15) 不变
        # === [修改结束] ===

        current_fav = update_favorability(change)

        # 保存原始回复（保留意图标记，使上下文记忆更精准）
        messages.append({"role": "assistant", "content": raw_reply})
        messages = trim_history(messages, MAX_HISTORY_ROUNDS)
        save_history(messages)

        # 写入每日人机对话可读日志 (.txt 归档)
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            time_str = datetime.now().strftime("%H:%M:%S")
            log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
            
            with open(log_file, 'a', encoding='utf-8') as lf:
                lf.write(f"[{time_str}] 你: {user_message}\n")
                lf.write(f"[{time_str}] 露米娅({emotion}): {clean_content}\n")
                if browser_task:
                    lf.write(f"           [触发网页操作: {browser_task}]\n")
                lf.write("\n")
        except Exception as log_ex:
            print(f"写入每日聊天日志失败: {log_ex}")

        return jsonify({
            "success": True,
            "reply": clean_content,
            "emotion": emotion,
            "favorability": current_fav, # 返回给前端
            "fav_change": change,        # 告诉前端变了多少
            "history_count": len(messages) - 1
        })

    except Exception as e:
        print(f"API Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/clear', methods=['POST'])
def clear_history_api():
    """清空对话历史"""
    messages = load_history()
    # 只保留系统消息
    messages = [messages[0]] if messages else []
    save_history(messages)
    return jsonify({"success": True, "message": "对话历史已清空"})

@app.route('/api/settings/config', methods=['GET', 'POST'])
def handle_config():
    """获取 or 更新系统配置"""
    if request.method == 'POST':
        data = request.json or {}
        provider = data.get('api_provider', 'gemini')
        
        # 验证 provider 值
        if provider not in ['gemini', 'deepseek', 'deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4-pro']:
            return jsonify({"success": False, "error": "无效的引擎选择"}), 400
            
        config_data = get_config()
        config_data['api_provider'] = provider
        save_config(config_data)
        
        return jsonify({"success": True, "api_provider": provider})
    else:
        config_data = get_config()
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        return jsonify({
            "success": True,
            "api_provider": config_data.get('api_provider', 'gemini'),
            "has_gemini": bool(gemini_key),
            "has_deepseek": bool(deepseek_key)
        })

# 静态文件路由
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# === 在 web_interface.py 中添加这个新路由 ===

# === 在 web_interface.py 中修改这个路由 ===

@app.route('/api/rumia_speak', methods=['POST'])
def rumia_speak():
    """触发露米娅主动说话 (支持打招呼和情绪递进)"""

    data = request.json or {}
    # 获取请求类型，默认为 'auto' (自动/发呆)，也可以是 'greeting' (打招呼)
    request_type = data.get('type', 'auto')
    count = data.get('count', 1)

    print(f"---------> 收到主动说话请求: 类型={request_type}, 次数={count} <---------")

    messages = load_history()

    # === 核心逻辑：定制 System Prompt ===
    prompt_content = ""

    if request_type == 'greeting':
        # [新增] 启动时的打招呼逻辑
        prompt_content = get_time_greeting_prompt()

        # 可以在后面追加通用的打招呼约束，防止她胡言乱语
        prompt_content += " 要求：话语简短（15字以内），体现露米娅的性格，不要和历史记录重复。"
    else:
        # 原有的发呆/情绪递进逻辑
        if count < 3:
            prompt_content = "（现在是一段沉默的时间。请主动向我搭话。注意不要和之前说过的话重复。）"
        elif count == 3:
            prompt_content = "（我很久没理你了。你生气了。抱怨我不理你，或者威胁要吞噬我。注意不要和之前说过的话重复。）"
        elif count < 6:
            prompt_content = "（我依然没有理你。你非常委屈。请表达被忽视的感受。注意不要和之前说过的话重复。）"
        else:
            prompt_content = "（用户完全不理你。你决定去睡觉。请表示你要去休息了。注意不要和之前说过的话重复。）"

    current_fav = get_favorability()

    # 包装为 P0 最高优先级的主动对话/自言自语系统任务提示
    priority_speak_prompt = (
        f"[SYSTEM TASK - P0 HIGHEST PRIORITY]\n"
        f"⚠️ 重要临时任务指示（最高优先级）：\n"
        f"【当前场景：主动发起对话（非对话接话）】\n"
        f"具体说话要求：{prompt_content}\n\n"
        f"【核心行为指南】：\n"
        f"- 你的这句话是**在沉默了一段时间后，主动、独立发起**的（或者是开机时的第一句主动打招呼），**绝对不是**针对上一句对话的“直接接话”或“回复”！\n"
        f"- 如果上一句已经是你（露米娅）说的话，请直接开启一个新的话题、发起新的问候、或者自言自语表达被冷落的情绪，绝对不要去假装回答上一句自己说的话，更不要假装用户已经说了话。\n"
        f"- 必须严格符合你当前对用户的好感度评分限制（当前好感度为 {current_fav}/100），且只能且必须遵循 '[心情][评分]对话内容' 格式输出。"
    )

    current_context = messages + [{
        "role": "system",
        "content": priority_speak_prompt
    }]

    try:
        client, model_name = get_llm_client_and_model()

        # Print all messages sent to the AI in the console in real-time
        print("\n" + "="*40 + " [AI SPEAK REQUEST] " + "="*40)
        print(f"Model: {model_name}")
        for idx, msg in enumerate(current_context, 1):
            print(f"--- Message #{idx} ({msg['role'].upper()}) ---")
            print(msg['content'])
        print("="*100 + "\n")

        response = client.chat.completions.create(
            model=model_name,
            messages=current_context,
            stream=False
        )

        raw_reply = response.choices[0].message.content

        # Print returned raw content in the console in real-time
        print("\n" + "="*40 + " [AI SPEAK RESPONSE] " + "="*40)
        print(raw_reply)
        print("="*101 + "\n")

        # [修正] 解析心情
        emotion, score, clean_content = parse_reply(raw_reply)

        # 剔除主动自言自语中可能残留的浏览器任务标记，防止展示在聊天气泡中
        if re.search(r'\[BROWSER_TASK:\s*.*?\]', raw_reply, re.IGNORECASE):
            clean_content = re.sub(r'\[BROWSER_TASK:\s*.*?\]', '', clean_content, flags=re.IGNORECASE).strip()

        # === [修改开始] 新的好感度逻辑 ===
        change = 0
        # 如果你之前加了 'greeting' 判断，记得保留 if request_type != 'greeting': 的缩进
        if score > 15:
            change = 1
        elif score < 5:
            change = -1
        else:
            change = 0
        # === [修改结束] ===

        current_fav = update_favorability(change)

        should_save = True

        if messages and messages[-1]["role"] == "assistant":
            last_content = messages[-1]["content"]
            # 如果新回复的内容包含在上一条里，或者跟上一条高度相似，就不保存
            # 使用 clean_content (纯文本) 进行比较更准确
            if clean_content in last_content or len(clean_content) < 2:
                print(f"检测到重复/无效消息，跳过保存: {clean_content}")
                should_save = False

        if should_save:
            messages.append({"role": "assistant", "content": raw_reply})
            messages = trim_history(messages, MAX_HISTORY_ROUNDS)
            save_history(messages)
            
            # 写入每日自言自语可读日志 (.txt 归档)
            try:
                today_str = datetime.now().strftime("%Y-%m-%d")
                time_str = datetime.now().strftime("%H:%M:%S")
                log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
                
                with open(log_file, 'a', encoding='utf-8') as lf:
                    lf.write(f"[{time_str}] 露米娅({emotion}) (主动): {clean_content}\n\n")
            except Exception as log_ex:
                print(f"写入每日自言自语日志失败: {log_ex}")
        # === [修改结束] ===

        return jsonify({
            "success": True,
            "reply": clean_content,
            "emotion": emotion,
            "favorability": current_fav,
            "fav_change": change,
            "history_count": len(messages) - 1
        })

    except Exception as e:
        print(f"主动说话失败: {e}")
        return jsonify({"error": str(e)}), 500

def parse_reply(text):
    """
    解析格式：[mood][score]content
    返回: (emotion, score, clean_content)
    """
    if not text or not isinstance(text, str):
        return "normal", 10, ""
        
    # 1. 提取心情
    tags = re.findall(r'\[(normal|angry|shy|crying)\]', text)
    emotion = "normal"
    if tags:
        emotion = tags[-1]

    # 2. [新增] 提取分数 (匹配 [数字])
    score_match = re.search(r'\[(\d+)\]', text)
    score = 10 # 默认 10 分 (不加不减)
    if score_match:
        try:
            score = int(score_match.group(1))
        except:
            pass

    # 3. 清洗文本 (把心情和分数标签都删掉)
    clean_content = re.sub(r'\[(normal|angry|shy|crying)\]', '', text)
    clean_content = re.sub(r'\[\d+\]', '', clean_content).strip()

    return emotion, score, clean_content


@app.route('/api/settings/logs', methods=['GET'])
def list_logs():
    """列出所有已保存的每日对话日期"""
    try:
        if not os.path.exists(DAILY_HISTORY_DIR):
            return jsonify({"success": True, "dates": []})
            
        # 扫描 daily_history 目录下的所有 chat_log_YYYY-MM-DD.txt 文件
        files = os.listdir(DAILY_HISTORY_DIR)
        dates = []
        for f in files:
            if f.startswith("chat_log_") and f.endswith(".txt"):
                # 提取日期 YYYY-MM-DD
                date_str = f.replace("chat_log_", "").replace(".txt", "")
                dates.append(date_str)
                
        # 排序，让最新的日期排在前面
        dates.sort(reverse=True)
        return jsonify({"success": True, "dates": dates})
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

@app.route('/api/settings/logs/<date>', methods=['GET'])
def get_log_content(date):
    """获取特定日期的聊天记录文本内容"""
    try:
        # 安全性校验：防止路径穿越攻击，只允许 YYYY-MM-DD 格式的日期
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            return jsonify({"success": False, "error": "无效的日期格式"}), 400
            
        log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date}.txt")
        if not os.path.exists(log_file):
            return jsonify({"success": False, "error": "聊天记录文件不存在"}), 404
            
        with open(log_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        return jsonify({"success": True, "date": date, "content": content})
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500


@app.route('/api/settings/memory_graph', methods=['GET'])
def get_memory_graph():
    """获取目前长短期记忆图谱数据"""
    try:
        agent = get_memory_agent()
        if not agent:
            return jsonify({"success": False, "error": "记忆系统未初始化"}), 500
        
        # 1. 读取所有的记忆 (Facts)
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
        # 记录所有的 memory_id 方便做连线校验
        valid_memory_ids = set()
        
        for item in memories_list:
            if not isinstance(item, dict):
                continue
            m_id = item.get("id")
            m_text = item.get("memory")
            if not m_id or not m_text:
                continue
            valid_memory_ids.add(m_id)
            # 缩短节点显示文本，避免图太拥挤
            label = m_text if len(m_text) <= 25 else m_text[:23] + "..."
            nodes.append({
                "id": m_id,
                "label": label,
                "full_text": m_text,
                "type": "fact",
                "color": {
                    "background": "rgba(255, 141, 161, 0.25)",
                    "border": "#ff8da1",
                    "highlight": {
                        "background": "rgba(255, 141, 161, 0.45)",
                        "border": "#ff6b84"
                    }
                },
                "font": {"color": "#ffc1cc", "size": 12},
                "shape": "dot",
                "size": 16,
                "shadow": {"enabled": True, "color": "rgba(255, 141, 161, 0.3)", "size": 8}
            })
            fact_nodes_map[m_id] = m_text
            
        # 2. 读取所有的实体 (Entities)
        entities_list = []
        try:
            entities_data = agent.entity_store.list(filters={"user_id": "player_01"}, top_k=200)
            if isinstance(entities_data, tuple) and len(entities_data) > 0:
                entities_list = entities_data[0]
            elif isinstance(entities_data, list):
                entities_list = entities_data
        except Exception as ee:
            print(f"[MEMORY GRAPH] Failed to list entities (might be empty/not initialized yet): {ee}")
            
        entity_nodes_map = {}
        for record in entities_list:
            if not hasattr(record, "payload") or not record.payload:
                continue
            payload = record.payload
            entity_text = payload.get("data")
            entity_type = payload.get("entity_type", "noun")
            linked_ids = payload.get("linked_memory_ids", [])
            
            if not entity_text:
                continue
                
            # 一个实体只添加一次节点
            entity_node_id = f"entity_{entity_text}"
            if entity_node_id not in entity_nodes_map:
                entity_nodes_map[entity_node_id] = {
                    "id": entity_node_id,
                    "label": entity_text,
                    "type": "entity",
                    "entity_type": entity_type,
                    "color": {
                        "background": "rgba(139, 233, 253, 0.25)",
                        "border": "#8be9fd",
                        "highlight": {
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
                
            # 建立连线 (Entity -> Fact)
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
                    
        return jsonify({
            "success": True,
            "nodes": nodes,
            "edges": edges,
            "facts_count": len(valid_memory_ids),
            "entities_count": len(entity_nodes_map)
        })
    except Exception as ex:
        print(f"[API ERROR] Failed to fetch memory graph: {ex}")
        return jsonify({"success": False, "error": str(ex)}), 500


@app.route('/api/settings/memory_distill_now', methods=['POST'])
def manual_distill_now():
    """手动整理今日和未整理的回忆"""
    try:
        agent = get_memory_agent()
        if not agent:
            return jsonify({"success": False, "error": "记忆系统未初始化"}), 500
            
        data = request.json or {}
        seed_test = data.get("seed_test", False)
        
        if seed_test:
            # 添加一条测试记忆，方便测试
            test_fact = "用户最喜欢吃巧克力饼干和红茶，今天过生日。"
            print(f"[MANUAL DISTILL] Seeding test memory: {test_fact}")
            agent.add(
                test_fact,
                user_id="player_01",
                metadata={"date": datetime.now().strftime("%Y-%m-%d"), "test": True}
            )
            return jsonify({"success": True, "message": "成功注入一条关于巧克力饼干和红茶生日的测试回忆！"})
            
        # 否则，整理今天还没整理的聊天记录 (chat_log_YYYY-MM-DD.txt)
        today_str = datetime.now().strftime("%Y-%m-%d")
        log_file_path = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{today_str}.txt")
        
        if not os.path.exists(log_file_path):
            return jsonify({"success": False, "error": "今天还没有聊天记录哦，快去和露米娅聊聊天吧！"})
            
        with open(log_file_path, 'r', encoding='utf-8') as lf:
            log_content = lf.read().strip()
            
        if not log_content:
            return jsonify({"success": False, "error": "今日聊天记录为空！"})
            
        print(f"[MANUAL DISTILL] Distilling today's chat logs ({today_str})...")
        agent.add(
            f"Here is the dialogue history between user and Rumia on date {today_str}:\n{log_content}",
            user_id="player_01",
            metadata={"date": today_str}
        )
        
        # 将今天记录为已蒸馏
        config_data = get_config()
        distilled_dates = config_data.get("distilled_dates", [])
        if today_str not in distilled_dates:
            distilled_dates.append(today_str)
            config_data["distilled_dates"] = distilled_dates
            save_config(config_data)
            
        return jsonify({"success": True, "message": "露米娅非常认真地整理了今天的回忆！大脑已经扩充！"})
    except Exception as ex:
        print(f"[API ERROR] Manual distill failed: {ex}")
        return jsonify({"success": False, "error": str(ex)}), 500


def daily_distillation_worker():
    """Background worker to check and distill yesterday's and previous days' chat logs."""
    print("[MEMORY DISTILLER] Background distillation worker started.")
    time.sleep(3)  # Wait for Flask to boot up and initialize completely
    
    agent = get_memory_agent()
    if not agent:
        print("[MEMORY DISTILLER] Worker stopped because Memory agent is not initialized.")
        return
    
    try:
        config_data = get_config()
        distilled_dates = config_data.get("distilled_dates", [])
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        if not os.path.exists(DAILY_HISTORY_DIR):
            print("[MEMORY DISTILLER] daily_history directory does not exist yet.")
            return
            
        # 1. Scan for log files
        log_files = os.listdir(DAILY_HISTORY_DIR)
        target_dates = []
        for f in log_files:
            if f.startswith("chat_log_") and f.endswith(".txt"):
                date_str = f.replace("chat_log_", "").replace(".txt", "")
                # Ensure it is in YYYY-MM-DD format
                if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                    # Only process dates strictly before today
                    if date_str < today_str and date_str not in distilled_dates:
                        target_dates.append(date_str)
                        
        if not target_dates:
            print("[MEMORY DISTILLER] All previous chat logs are already distilled. Nothing to do!")
            return
            
        # Sort chronologically (oldest first)
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
                        f"Here is the dialogue history between user and Rumia on date {date_str}:\n{log_content}",
                        user_id="player_01",
                        metadata={"date": date_str}
                    )
                    print(f"[MEMORY DISTILLER] Distillation completed successfully for {date_str}!")
                else:
                    print(f"[MEMORY DISTILLER] Log for {date_str} is empty. Skipping.")
                    
                # Add to distilled list and persist configuration
                distilled_dates.append(date_str)
                config_data["distilled_dates"] = distilled_dates
                save_config(config_data)
                
            except Exception as ex:
                print(f"[MEMORY DISTILLER] Error distilling log for {date_str}: {ex}")
                break
    except Exception as e:
        print(f"[MEMORY DISTILLER] General worker error: {e}")


if __name__ == '__main__':
    print("启动露米娅Web聊天界面...")
    print("访问地址: http://127.0.0.1:5000")
    # Start the memory distiller thread ONLY in the active Flask worker process
    # to prevent double-initialization and file locking under Flask's debug reloader.
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        print("[MEMORY DISTILLER] Starting worker thread in main Flask process.")
        threading.Thread(target=daily_distillation_worker, daemon=True).start()
    else:
        print("[MEMORY DISTILLER] Skipping worker thread in reloader parent process.")
        
    app.run(debug=True, host='127.0.0.1', port=5000)
