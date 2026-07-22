import os
import re
import sys
import subprocess
import threading
from typing import Dict, Any
from core.config_manager import get_config, get_active_character_id, get_custom_engines
from core.profile_manager import update_user_profile_key
from graph.state import AgentState

browser_process = None

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
    services_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    project_dir = os.path.dirname(services_dir)
    workspace_dir = os.path.dirname(project_dir)
    
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
    import json
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

def execute_vision_task_node(state: AgentState) -> Dict[str, Any]:
    """工具节点：屏幕视觉识别"""
    vision_task = state.get("vision_task")
    if not vision_task:
        return {"vision_result": None}

    print("\n" + "="*20 + " [VISION NODE MONITOR] " + "="*20)
    print(f"[MONITOR] 收到大模型发起的屏幕识图任务...")

    try:
        from PIL import ImageGrab
        import base64
        from io import BytesIO
        import requests
        import json

        # 截取全屏 (支持多显示器)
        img = ImageGrab.grab(all_screens=True)
        # 压缩图像大小以适应 API
        img.thumbnail((1024, 1024))
        
        buffered = BytesIO()
        # 转换为 RGB (去掉 alpha 通道，以兼容 jpeg)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(buffered, format="JPEG", quality=80)
        img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        config_data = get_config()
        vision_engine = config_data.get("vision_engine", "gemini")
        
        import time
        prompt = f"这是当前电脑屏幕的截图（当前时间: {time.strftime('%Y-%m-%d %H:%M:%S')}）。请仔细观察并简要描述屏幕上正在显示的内容、活跃的窗口，以及用户可能正在进行什么工作。如果多次看到类似的画面，请尽可能捕捉新的细节或变化。不要超过150字。"

        description = ""

        if vision_engine == "gemini":
            gemini_key = os.getenv("GEMINI_API_KEY")
            if not gemini_key:
                return {"vision_result": "未配置 GEMINI_API_KEY，无法使用默认的 Gemini 视觉引擎。"}
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inlineData": {"mimeType": "image/jpeg", "data": img_b64}}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.7
                }
            }
            resp = requests.post(url, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                description = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            else:
                return {"vision_result": f"Gemini API 请求失败: HTTP {resp.status_code}"}
        else:
            # 自定义引擎处理 (兼容 OpenAI 格式的 Vision API)
            if vision_engine.startswith("custom_"):
                custom_engines = get_custom_engines()
                engine_conf = next((e for e in custom_engines if e["id"] == vision_engine), None)
            else:
                engine_conf = None

            if not engine_conf:
                return {"vision_result": f"找不到所选的视觉引擎配置: {vision_engine}"}
                
            base_url = engine_conf["base_url"].rstrip("/")
            api_key = engine_conf.get("api_key", "")
            model_name = engine_conf["model_name"]
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                        ]
                    }
                ],
                "max_tokens": 300,
                "temperature": 0.7
            }
            
            # 使用 /chat/completions 兼容端点
            endpoint = f"{base_url}/chat/completions"
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                description = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            else:
                return {"vision_result": f"视觉 API 请求失败: HTTP {resp.status_code}, {resp.text}"}

        if not description:
            return {"vision_result": "未能从视觉模型获取到有效描述。"}

        print(f"[MONITOR] 屏幕识别成功: {description[:100]}...")
        return {"vision_result": f"屏幕画面分析结果：\n{description}"}

    except Exception as e:
        err_msg = f"执行屏幕截取或请求 API 时出错: {str(e)}"
        print(f"[MONITOR] {err_msg}")
        return {"vision_result": err_msg}
