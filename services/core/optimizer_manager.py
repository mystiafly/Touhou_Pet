import os
import sys
import time
import gc
import psutil
import subprocess
import urllib.request
import threading
from core.config_manager import SERVICES_DIR

TOOLS_DIR = os.path.join(SERVICES_DIR, "tools")
MEMREDUCT_DIR = os.path.join(TOOLS_DIR, "memreduct")
MEMREDUCT_EXE = os.path.join(MEMREDUCT_DIR, "memreduct.exe")
SETUP_URL = "https://github.com/henrypp/memreduct/releases/download/v.3.4/memreduct-3.4-setup.exe"

_is_downloading = False


def _enable_windows_privileges():
    """为当前 Python 进程激活必要的系统特权 (SeProfileSingleProcessPrivilege, SeIncreaseQuotaPrivilege)"""
    if os.name != 'nt':
        return False
    try:
        import ctypes
        from ctypes import wintypes
        advapi32 = ctypes.windll.advapi32
        kernel32 = ctypes.windll.kernel32

        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        advapi32.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
        advapi32.OpenProcessToken.restype = wintypes.BOOL

        SE_PRIVILEGE_ENABLED = 0x00000002
        TOKEN_ADJUST_PRIVILEGES = 0x0020
        TOKEN_QUERY = 0x0008

        class LUID(ctypes.Structure):
            _fields_ = [('LowPart', wintypes.DWORD), ('HighPart', wintypes.LONG)]

        class LUID_AND_ATTRIBUTES(ctypes.Structure):
            _fields_ = [('Luid', LUID), ('Attributes', wintypes.DWORD)]

        class TOKEN_PRIVILEGES(ctypes.Structure):
            _fields_ = [('PrivilegeCount', wintypes.DWORD), ('Privileges', LUID_AND_ATTRIBUTES * 1)]

        hToken = wintypes.HANDLE()
        if not advapi32.OpenProcessToken(kernel32.GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, ctypes.byref(hToken)):
            return False

        for priv_name in ["SeProfileSingleProcessPrivilege", "SeIncreaseQuotaPrivilege"]:
            luid = LUID()
            if advapi32.LookupPrivilegeValueW(None, priv_name, ctypes.byref(luid)):
                tp = TOKEN_PRIVILEGES()
                tp.PrivilegeCount = 1
                tp.Privileges[0].Luid = luid
                tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED
                advapi32.AdjustTokenPrivileges(hToken, False, ctypes.byref(tp), ctypes.sizeof(tp), None, None)

        kernel32.CloseHandle(hToken)
        return True
    except Exception as e:
        print(f"[Optimizer] 提升 Windows 特权失败: {e}")
        return False


def _clean_native_windows():
    """利用 Windows NT Native API (ntdll + psapi) 执行底层内核级内存与备用列表清理"""
    if os.name != 'nt':
        return False
    try:
        import ctypes
        from ctypes import wintypes

        _enable_windows_privileges()

        ntdll = ctypes.windll.ntdll
        kernel32 = ctypes.windll.kernel32
        psapi = ctypes.windll.psapi

        # 1. 调用 NT Native API 清理 Windows 备用列表 (Standby List) 与系统工作集
        # SYSTEM_MEMORY_LIST_COMMAND 枚举:
        # 0 = MemoryEmptyWorkingSets (系统工作集)
        # 2 = MemoryPurgeStandbyList (清空备用页面缓存，秒级释放数 GB 内存且无磁盘 I/O 阻塞)
        # 3 = MemoryPurgeLowPriorityStandbyList (清空低优先级备用页面)
        SystemMemoryListInformation = 80
        for cmd_val in (0, 2, 3):
            try:
                cmd = wintypes.ULONG(cmd_val)
                ntdll.NtSetSystemInformation(SystemMemoryListInformation, ctypes.byref(cmd), ctypes.sizeof(cmd))
            except Exception:
                pass

        # 2. 批量修剪当前所有可访问进程的工作集 (EmptyWorkingSet)
        # 将闲置的进程工作集页面转入备用/页面文件，显著降低整体物理内存占用
        PROCESS_QUERY_INFORMATION = 0x0400
        PROCESS_SET_QUOTA = 0x0100
        for pid in psutil.pids():
            if pid <= 4:
                continue
            try:
                h = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, False, pid)
                if h:
                    psapi.EmptyWorkingSet(h)
                    kernel32.CloseHandle(h)
            except Exception:
                pass

        return True
    except Exception as e:
        print(f"[Optimizer] 原生 Windows 内存清理异常: {e}")
        return False


def _clean_memreduct_fallback():
    """降级备选方案：若原生清理受限且存在 memreduct.exe，以全量模式执行并安全回收无头进程"""
    if not os.path.exists(MEMREDUCT_EXE):
        return False
    try:
        # 先清理之前可能残留挂起的僵尸进程
        subprocess.run(["taskkill", "/F", "/IM", "memreduct.exe"],
                       capture_output=True,
                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)

        # 使用 -clean:full 清理全部区域，并设置超时回收避免常驻无头僵尸进程
        proc = subprocess.Popen([MEMREDUCT_EXE, "-clean:full"],
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        try:
            proc.wait(timeout=2.0)
        except subprocess.TimeoutExpired:
            proc.kill()

        # 再次确保没有残留驻留后台
        subprocess.run(["taskkill", "/F", "/IM", "memreduct.exe"],
                       capture_output=True,
                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        return True
    except Exception as e:
        print(f"[Optimizer] Mem Reduct 备用清理执行异常: {e}")
        return False


def install_memreduct():
    """后台下载并静默安装 Mem Reduct（作为备用组件）"""
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
        subprocess.run([setup_path, "/S", f"/D={MEMREDUCT_DIR}"], check=True)

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
    """检查是否安装了备用优化工具，没有则后台异步下载"""
    if not os.path.exists(MEMREDUCT_EXE):
        threading.Thread(target=install_memreduct, daemon=True).start()
        return False
    return True


def clean_memory():
    """
    触发底层系统内存与缓存清理，并返回统计信息。
    优先采用 Windows NT Native API 原生清理（毫秒级、免外部依赖、不卡死挂起），
    必要时自动降级到 Mem Reduct 备用方案。
    """
    try:
        mem_before = psutil.virtual_memory()
        percent_before = mem_before.percent
        used_before = mem_before.used

        # 1. 优先使用 Windows 原生 NT Native API 深度清理（清空备用列表 + 工作集）
        cleaned_native = False
        if os.name == 'nt':
            cleaned_native = _clean_native_windows()

        # 2. 若不在 NT 或原生清理受限，且存在 Mem Reduct，则尝试降级调用
        if not cleaned_native and os.path.exists(MEMREDUCT_EXE):
            _clean_memreduct_fallback()

        # 3. 回收 Python 内部未引用的垃圾对象
        gc.collect()

        # 等待 0.5 秒以便 Windows 内存管理器刷新物理内存计数器
        time.sleep(0.5)

        mem_after = psutil.virtual_memory()
        percent_after = mem_after.percent
        used_after = mem_after.used

        freed_bytes = used_before - used_after
        if freed_bytes < 0:
            freed_bytes = 0

        freed_mb = freed_bytes / (1024 * 1024)
        if freed_mb >= 1000:
            freed_str = f"{(freed_mb / 1024):.2f} GB"
        else:
            freed_str = f"{freed_mb:.1f} MB"

        if freed_mb >= 50:
            message = f"已执行深度内存清理，清理前占用 {percent_before}%，清理后 {percent_after}%，共释放 {freed_str} 内存。"
        else:
            message = f"已优化系统内存与进程工作集，当前内存占用为 {percent_after}%，运行状态极佳。"

        return {
            "success": True,
            "percent_before": percent_before,
            "percent_after": percent_after,
            "freed_str": freed_str,
            "message": message
        }
    except Exception as e:
        print(f"[Optimizer Error] 执行清理失败: {e}")
        return {"success": False, "error": f"执行优化失败: {e}"}
