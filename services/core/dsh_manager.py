import os
import re
import sys
import time
import shutil
import webbrowser
import subprocess
from typing import Dict, Any, Optional

from core.config_manager import get_config, get_custom_engines, SERVICES_DIR

ROOT_DIR = os.path.dirname(SERVICES_DIR)

# 全局进程句柄托管
_daemon_process: Optional[subprocess.Popen] = None
_web_process: Optional[subprocess.Popen] = None
_web_port: int = 54321

def get_dsh_executable() -> Optional[str]:
    """探测系统中 dsh CLI 可执行文件路径"""
    cmd = shutil.which("dsh")
    if cmd:
        return cmd
    if os.name == "nt":
        # 尝试常见 Windows npm 全局路径
        for ext in [".cmd", ".exe", ".ps1"]:
            cmd_ext = shutil.which(f"dsh{ext}")
            if cmd_ext:
                return cmd_ext
    return None

def strip_ansi_codes(text: str) -> str:
    """去除终端 ANSI 颜色转义字符"""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def resolve_dsh_env() -> Dict[str, str]:
    """根据大贤者全局设定动态解析并装配 DSH 运行时环境变量与模型凭据"""
    env = os.environ.copy()
    config = get_config()
    
    provider = config.get("dsh_api_provider", "inherit")
    if provider == "inherit":
        provider = config.get("api_provider", "deepseek")
        
    api_key = ""
    base_url = ""
    model_name = ""
    
    if provider.startswith("custom_"):
        customs = get_custom_engines()
        matched = next((c for c in customs if c.get("id") == provider), None)
        if matched:
            api_key = matched.get("api_key", "")
            base_url = matched.get("base_url", "")
            model_name = matched.get("model_name", "")
    elif provider == "deepseek":
        api_key = config.get("engine_api_key") or os.getenv("DEEPSEEK_API_KEY", "")
        base_url = config.get("engine_base_url") or "https://api.deepseek.com"
        model_name = config.get("engine_model_name") or "deepseek-chat"
    elif provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY", "")
        base_url = os.getenv("OPENAI_BASE_URL", "")
        model_name = "gpt-4o"
    else:
        # 兜底从主引擎获取
        api_key = config.get("engine_api_key") or os.getenv("DEEPSEEK_API_KEY", "")
        base_url = config.get("engine_base_url") or ""
        model_name = config.get("engine_model_name") or ""
        
    if api_key:
        env["DEEPSEEK_API_KEY"] = api_key
        env["OPENAI_API_KEY"] = api_key
    if base_url:
        env["DEEPSEEK_BASE_URL"] = base_url
        env["OPENAI_BASE_URL"] = base_url
    if model_name:
        env["DEEPSEEK_MODEL"] = model_name

    preset = config.get("dsh_preset", "standard")
    env["DSH_DEFAULT_PRESET"] = preset
    env["DSH_PERMISSION_MODE"] = config.get("dsh_permission_mode", "danger-full-access")
    env["DSH_WORKSPACE_ROOT"] = ROOT_DIR
    
    return env

def check_dsh_environment() -> Dict[str, Any]:
    """检查 DSH 整体运行环境就绪度"""
    dsh_exe = get_dsh_executable()
    is_installed = dsh_exe is not None
    version_str = ""
    
    if is_installed:
        try:
            res = subprocess.run(
                [dsh_exe, "--version"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=True,
                timeout=5
            )
            version_str = res.stdout.strip()
        except Exception:
            version_str = "已安装 (版本获取超时)"
            
    env = resolve_dsh_env()
    has_key = bool(env.get("DEEPSEEK_API_KEY") or env.get("OPENAI_API_KEY"))
    
    global _daemon_process, _web_process
    daemon_running = _daemon_process is not None and _daemon_process.poll() is None
    web_running = _web_process is not None and _web_process.poll() is None
    
    config = get_config()
    return {
        "is_installed": is_installed,
        "dsh_path": dsh_exe or "",
        "dsh_version": version_str,
        "has_api_key": has_key,
        "daemon_running": daemon_running,
        "web_running": web_running,
        "web_port": _web_port,
        "settings": {
            "enable_dsh_agent": config.get("enable_dsh_agent", False),
            "dsh_run_mode": config.get("dsh_run_mode", "on_demand"),
            "dsh_preset": config.get("dsh_preset", "standard"),
            "dsh_api_provider": config.get("dsh_api_provider", "inherit"),
            "dsh_timeout": config.get("dsh_timeout", 90)
        }
    }

def start_daemon() -> bool:
    """【常态启动 / 同生共死模式】后台静默启动 DSH 守护进程待命"""
    global _daemon_process
    if _daemon_process is not None and _daemon_process.poll() is None:
        return True
        
    dsh_exe = get_dsh_executable()
    if not dsh_exe:
        print("[DSH DAEMON] 启动守护进程失败: 未找到 dsh 可执行文件")
        return False
        
    env = resolve_dsh_env()
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW
        
    try:
        # 常态守护进程：静默就绪待命
        _daemon_process = subprocess.Popen(
            [dsh_exe, "--profile", "headless"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=ROOT_DIR,
            env=env,
            shell=True,
            creationflags=flags
        )
        print(f"[DSH DAEMON] 常态待命守护进程已就绪 (PID: {_daemon_process.pid})，与桌宠服务同生共死")
        return True
    except Exception as e:
        print(f"[DSH DAEMON] 唤醒常态守护进程异常: {e}")
        return False

def stop_daemon():
    """优雅停止并回收常态守护进程"""
    global _daemon_process
    if _daemon_process is not None:
        print(f"[DSH DAEMON] 正在停止 DSH 守护进程 (PID: {_daemon_process.pid})...")
        try:
            _daemon_process.terminate()
            _daemon_process.wait(timeout=3)
        except Exception:
            try:
                _daemon_process.kill()
            except Exception:
                pass
        _daemon_process = None
        print("[DSH DAEMON] DSH 守护进程已安全释放")

def launch_dsh_web_ui(port: int = 54321) -> Dict[str, Any]:
    """手动启动 DSH 官方 Web 工作台 (供用户改插件/调参数)并在浏览器打开"""
    global _web_process, _web_port
    _web_port = port
    
    if _web_process is not None and _web_process.poll() is None:
        webbrowser.open(f"http://127.0.0.1:{port}")
        return {"status": "success", "message": f"DSH 网页工作台已在运行中，已重新在浏览器打开 http://127.0.0.1:{port}", "url": f"http://127.0.0.1:{port}"}
        
    dsh_exe = get_dsh_executable()
    if not dsh_exe:
        return {"status": "error", "message": "系统中未检测到 dsh CLI，请先确认全局安装了 @deepseek-ai/dsh"}
        
    env = resolve_dsh_env()
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW
        
    try:
        _web_process = subprocess.Popen(
            [dsh_exe, "web", "--port", str(port), "--host", "127.0.0.1"],
            cwd=ROOT_DIR,
            env=env,
            shell=True,
            creationflags=flags
        )
        # 等待 1.5 秒确保端口监听建立后打开默认浏览器
        time.sleep(1.5)
        webbrowser.open(f"http://127.0.0.1:{port}")
        return {"status": "success", "message": f"DSH 网页工作台已成功启动 (端口 {port})，已在默认浏览器打开！", "url": f"http://127.0.0.1:{port}"}
    except Exception as e:
        return {"status": "error", "message": f"启动 DSH 网页端失败: {str(e)}"}

def stop_dsh_web_ui() -> Dict[str, Any]:
    """手动停止 DSH 官方 Web 工作台"""
    global _web_process
    if _web_process is None or _web_process.poll() is not None:
        _web_process = None
        return {"status": "success", "message": "DSH 网页工作台当前未在运行"}
        
    try:
        _web_process.terminate()
        _web_process.wait(timeout=3)
    except Exception:
        try:
            _web_process.kill()
        except Exception:
            pass
    _web_process = None
    return {"status": "success", "message": "DSH 网页工作台已停止"}

def execute_task(task_text: str, timeout: int = None) -> Dict[str, Any]:
    """
    静默无头执行 DSH 任务 (支持标准模式 Standard Mode)
    在后台完全静默执行，无任何窗口或网页弹窗
    """
    dsh_exe = get_dsh_executable()
    if not dsh_exe:
        return {
            "success": False,
            "output": "【DSH 执行器调用失败】系统中未检测到 dsh CLI，请在终端执行 `npm install -g @deepseek-ai/dsh` 完成初始化。"
        }
        
    config = get_config()
    if timeout is None:
        timeout = int(config.get("dsh_timeout", 90))
        
    env = resolve_dsh_env()
    if not (env.get("DEEPSEEK_API_KEY") or env.get("OPENAI_API_KEY")):
        return {
            "success": False,
            "output": "【DSH 执行器调用失败】未检测到有效的大模型 API 凭据，请在大脑引擎中配置 DeepSeek 或自定义中转引擎，并在 Agent 设置中绑定该 API。"
        }
        
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW
        
    clean_task = task_text.strip()
    if not clean_task:
        return {
            "success": True,
            "output": "（眨眨眼）DSH 智能体执行器已待命就绪！请告诉我您想让我分析、审查或执行的具体工程指令。"
        }

    print(f"\n[DSH AGENT MONITOR] 收到智能体执行任务: '{clean_task}' (超时限额: {timeout}s)")
    
    cmd = [dsh_exe, "--profile", "headless", clean_task]
    start_t = time.time()
    
    try:
        res = subprocess.run(
            cmd,
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=True,
            timeout=timeout,
            env=env,
            creationflags=flags
        )
        duration = round(time.time() - start_t, 2)
        stdout_clean = strip_ansi_codes(res.stdout or "").strip()
        stderr_clean = strip_ansi_codes(res.stderr or "").strip()
        
        if res.returncode == 0:
            print(f"[DSH AGENT MONITOR] 任务执行成功！耗时: {duration}s")
            return {
                "success": True,
                "output": stdout_clean or "DSH 智能体执行完毕，未生成附加文本输出。",
                "duration": duration
            }
        else:
            print(f"[DSH AGENT MONITOR] 任务退出异常 (code {res.returncode}): {stderr_clean[:200]}")
            # 如果 stdout 有有效产物，依然优先返回 stdout
            result_text = stdout_clean or stderr_clean or f"执行器返回异常退出码 {res.returncode}"
            return {
                "success": False,
                "output": f"DSH 执行过程遇到异常 (耗时 {duration}s): {result_text}",
                "duration": duration
            }
    except subprocess.TimeoutExpired:
        duration = round(time.time() - start_t, 2)
        print(f"[DSH AGENT MONITOR] 执行超时熔断 (限额: {timeout}s)！")
        return {
            "success": False,
            "output": f"DSH 智能体执行已超时熔断（超过设定的 {timeout} 秒限额）。任务可能过于繁重，建议在控制台增加超时时长或拆分任务目标。",
            "duration": duration
        }
    except Exception as e:
        duration = round(time.time() - start_t, 2)
        print(f"[DSH AGENT MONITOR] 底层系统调度错误: {e}")
        return {
            "success": False,
            "output": f"DSH 执行调度异常: {str(e)}",
            "duration": duration
        }
