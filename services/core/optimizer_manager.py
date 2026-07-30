import os
import subprocess
import urllib.request
import threading
from core.config_manager import SERVICES_DIR

TOOLS_DIR = os.path.join(SERVICES_DIR, "tools")
MEMREDUCT_DIR = os.path.join(TOOLS_DIR, "memreduct")
MEMREDUCT_EXE = os.path.join(MEMREDUCT_DIR, "memreduct.exe")
SETUP_URL = "https://github.com/henrypp/memreduct/releases/download/v.3.4/memreduct-3.4-setup.exe"

_is_downloading = False

def install_memreduct():
    """后台下载并静默安装 Mem Reduct"""
    global _is_downloading
    if _is_downloading or os.path.exists(MEMREDUCT_EXE):
        return True

    _is_downloading = True
    try:
        os.makedirs(TOOLS_DIR, exist_ok=True)
        setup_path = os.path.join(TOOLS_DIR, "memreduct-setup.exe")
        
        print("[Optimizer] 正在下载 Mem Reduct 安装包...")
        urllib.request.urlretrieve(SETUP_URL, setup_path)
        
        print("[Optimizer] 下载完成，开始静默安装...")
        # 运行静默安装参数 /S /D=目录
        subprocess.run([setup_path, "/S", f"/D={MEMREDUCT_DIR}"], check=True)
        
        # 清理安装包
        if os.path.exists(setup_path):
            os.remove(setup_path)
            
        print("[Optimizer] Mem Reduct 安装成功！")
        return True
    except Exception as e:
        print(f"[Optimizer Error] 安装 Mem Reduct 失败: {e}")
        return False
    finally:
        _is_downloading = False

def check_and_prepare_optimizer():
    """检查是否安装了优化工具，没有则后台异步下载"""
    if not os.path.exists(MEMREDUCT_EXE):
        threading.Thread(target=install_memreduct, daemon=True).start()
        return False
    return True

def clean_memory():
    """触发底层系统内存与缓存清理"""
    if not os.path.exists(MEMREDUCT_EXE):
        print("[Optimizer] 优化程序尚未就绪，尝试安装...")
        if not install_memreduct():
            return False, "优化组件下载失败，请检查网络。"

    try:
        # 使用 -clean 参数静默执行内存清理
        subprocess.Popen([MEMREDUCT_EXE, "-clean"], 
                         creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        return True, "内存与系统缓存已深度清理释放。"
    except Exception as e:
        print(f"[Optimizer Error] 执行清理失败: {e}")
        return False, f"执行优化失败: {e}"
