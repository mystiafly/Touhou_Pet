import os
import re
import subprocess
from typing import Optional
from graph.nodes import post_llm_node, update_history_node

def safe_recycle_delete(path: str) -> bool:
    """严格遵循回收站安全删除策略：将文件/目录送至 Windows 回收站"""
    if not os.path.exists(path):
        return True
    abs_path = os.path.abspath(path)
    # 优先使用 .NET FileSystem.DeleteDirectory / DeleteFile
    try:
        if os.path.isdir(abs_path):
            ps_script = f"Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('{abs_path}', 'OnlyErrorDialogs', 'SendToRecycleBin')"
        else:
            ps_script = f"Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{abs_path}', 'OnlyErrorDialogs', 'SendToRecycleBin')"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True, timeout=10)
        if not os.path.exists(abs_path):
            return True
    except Exception:
        pass
    
    # 备选 send2trash
    try:
        from send2trash import send2trash
        send2trash(abs_path)
        if not os.path.exists(abs_path):
            return True
    except Exception:
        pass

    return not os.path.exists(abs_path)

def ensure_live2d_pose_configured(model_json_path: str):
    """安全保留占位：不再自动篡改用户的 Live2D model3.json 或强加互斥 pose3.json，确保第三方及所有模型图层完整渲染"""
    pass

def find_live2d_model_file(directory: str) -> Optional[str]:
    """递归查找目录下的 .model3.json 或 .model.json 相对路径"""
    for root, dirs, files in os.walk(directory):
        for f in files:
            if f.lower().endswith('.model3.json') or f.lower().endswith('.model.json'):
                abs_path = os.path.join(root, f)
                rel_path = os.path.relpath(abs_path, directory)
                return rel_path.replace('\\', '/')
    return None

def clean_history_text(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r'<(?:think|character_thought|thought)>.*?</(?:think|character_thought|thought)>', '', text, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'\[[A-Z0-9_]+(?::.*?)?\]', '', cleaned)
    cleaned = re.sub(r'\(用户刚刚触碰了物理动作[，,]?\s*你的下意识反应是[：:]?\s*(.*?)\)', r'(\1)', cleaned)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    return '\n'.join(lines)

def run_post_and_history(state: dict):
    log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "bg_task_log.txt")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"\n--- BG Task Started ---\n")
        f.write(f"User Message: {state.get('user_message')}\n")
        f.write(f"Main LLM Reply: {state.get('main_llm_reply')}\n")
    try:
        post_delta = post_llm_node(state)
        state.update(post_delta)
        update_history_node(state)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"BG Task Success. Post Delta: {post_delta}\n")
    except Exception as e:
        import traceback
        err_str = traceback.format_exc()
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"BG Task Error: {e}\n{err_str}\n")
        print(f"后台任务 (post_llm & update_history) 执行异常: {e}")

def format_tool_prefix(final_state: dict) -> str:
    tool_labels = []
    if final_state.get("process_task"):
        tool_labels.append("前台进程探测")
    if final_state.get("vision_task"):
        tool_labels.append("屏幕画面解析")
    if final_state.get("search_task"):
        kw = final_state.get("search_task")
        tool_labels.append(f"网络搜索: {kw}" if kw else "网络搜索")
    if final_state.get("browser_task"):
        target = final_state.get("browser_task")
        tool_labels.append(f"网页浏览: {target}" if target else "网页浏览")
    if final_state.get("launcher_task"):
        app = final_state.get("launcher_task")
        tool_labels.append(f"启动应用: {app}" if app else "启动应用")
    if final_state.get("clean_memory_task"):
        tool_labels.append("内存清理优化")
    if final_state.get("weather_task"):
        w_city = final_state.get("weather_task")
        if w_city and w_city.lower() != "auto":
            tool_labels.append(f"实时天气查询: {w_city}")
        else:
            tool_labels.append("实时天气查询")
    if final_state.get("selected_memory"):
        tool_labels.append("调取深层日记")

    if not tool_labels:
        return ""
    
    return f"[🔧 触发工具: {' | '.join(tool_labels)}]\n"
