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
    """触发底层系统内存与缓存清理，并返回统计信息"""
    import psutil
    import time
    
    if not os.path.exists(MEMREDUCT_EXE):
        print("[Optimizer] 优化程序尚未就绪，尝试安装...")
        if not install_memreduct():
            return {"success": False, "error": "优化组件下载失败，请检查网络。"}

    try:
        mem_before = psutil.virtual_memory()
        percent_before = mem_before.percent
        used_before = mem_before.used
        
        # 使用 -clean 参数静默执行内存清理，使用 subprocess.Popen 避免阻塞（因为 memreduct 会在后台挂起）
        subprocess.Popen([MEMREDUCT_EXE, "-clean"], 
                         creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        
        # 阻塞等待系统释放内存 (通常1~2秒内完成)
        time.sleep(2.5)
        
        mem_after = psutil.virtual_memory()
        percent_after = mem_after.percent
        used_after = mem_after.used
        
        freed_bytes = used_before - used_after
        if freed_bytes < 0: 
            freed_bytes = 0 # 避免系统波动导致的微小负数
            
        freed_mb = freed_bytes / (1024 * 1024)
        freed_str = f"{freed_mb:.1f} MB"
        if freed_mb >= 1000:
            freed_str = f"{(freed_mb / 1024):.2f} GB"
            
        return {
            "success": True,
            "percent_before": percent_before,
            "percent_after": percent_after,
            "freed_str": freed_str,
            "message": f"已执行内存清理，清理前占用 {percent_before}%，清理后 {percent_after}%，共释放 {freed_str} 内存。"
        }
    except Exception as e:
        print(f"[Optimizer Error] 执行清理失败: {e}")
        return {"success": False, "error": f"执行优化失败: {e}"}
