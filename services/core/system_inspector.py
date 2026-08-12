import ctypes
from ctypes import wintypes
import psutil

# 常用无意义的系统后台或桌面组件进程名单，不应对外暴露
IGNORED_PROCESSES = {
    "applicationframehost.exe",
    "systemsettings.exe",
    "textinputhost.exe",
    "explorer.exe",
    "searchapp.exe",
    "startmenuexperiencehost.exe",
    "shellexperiencehost.exe",
    "lockapp.exe",
    "widgets.exe",
    "taskmgr.exe"
}

DWMWA_CLOAKED = 14

def is_window_cloaked(hwnd) -> bool:
    """检查窗口在 Windows 10/11 中是否处于被掩盖/挂起/后台休眠状态 (Cloaked)"""
    try:
        cloaked = wintypes.DWORD()
        res = ctypes.windll.dwmapi.DwmGetWindowAttribute(
            hwnd, DWMWA_CLOAKED, ctypes.byref(cloaked), ctypes.sizeof(cloaked)
        )
        if res == 0:
            return cloaked.value != 0
    except Exception:
        pass
    return False

def get_active_programs() -> str:
    """
    抓取当前系统中真正物理可见且前台活跃的窗口标题及其进程名，用于向桌宠提供“用户在忙什么”的上下文。
    精准剔除后台挂起、最小化、Cloaked (掩盖) 的 Edge/Chrome 历史标签残留窗口。
    """
    EnumWindows = ctypes.windll.user32.EnumWindows
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))
    GetWindowText = ctypes.windll.user32.GetWindowTextW
    GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
    IsWindowVisible = ctypes.windll.user32.IsWindowVisible
    IsIconic = ctypes.windll.user32.IsIconic
    GetWindowThreadProcessId = ctypes.windll.user32.GetWindowThreadProcessId
    GetWindowLongW = ctypes.windll.user32.GetWindowLongW
    GWL_EXSTYLE = -20
    WS_EX_TOOLWINDOW = 0x00000080

    active_apps = []
    seen_titles = set()

    def foreach_window(hwnd, lParam):
        # 1. 必须物理可见且未处于最小化状态
        if IsWindowVisible(hwnd) and not IsIconic(hwnd):
            # 2. 必须非 Cloaked 挂起掩盖状态 (精准过滤 Edge/Chrome 挂起背景标签页与 UWP 虚幻窗口)
            if is_window_cloaked(hwnd):
                return True

            # 3. 过滤 ToolWindow 浮动工具窗
            ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE)
            if ex_style & WS_EX_TOOLWINDOW:
                return True

            length = GetWindowTextLength(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buff, length + 1)
                title = buff.value.strip()
                
                # 过滤掉一些过短或是空名称的无效窗口
                if not title or len(title) < 2 or title in seen_titles:
                    return True
                
                pid = ctypes.c_ulong()
                GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                try:
                    p = psutil.Process(pid.value)
                    name = p.name().lower()
                    
                    if name not in IGNORED_PROCESSES:
                        active_apps.append(f"【{name}】: {title}")
                        seen_titles.add(title)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
        return True
        
    EnumWindows(EnumWindowsProc(foreach_window), 0)
    
    if not active_apps:
        return "用户当前没有打开任何明显的前台窗口，可能在对着桌面发呆。"
        
    result_str = "用户当前正在运行的主要程序和窗口如下：\n"
    result_str += "\n".join(f"- {app}" for app in active_apps[:10])  # 最多取前10个避免过长
    return result_str

class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.DWORD),
        ('rcMonitor', wintypes.RECT),
        ('rcWork', wintypes.RECT),
        ('dwFlags', wintypes.DWORD),
    ]

def is_fullscreen_game_active() -> bool:
    """
    检查当前系统是否有 3D/全屏独占/无边框全屏游戏处于前台焦点状态。
    排除了桌面、任务栏、资源管理器、UWP 系统界面以及桌宠自身进程。
    """
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return False

        # 1. 检查类名，剔除桌面与任务栏组件
        buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, buf, 256)
        cls = buf.value
        if cls in ("Progman", "WorkerW", "Shell_TrayWnd", "ImmersiveLauncher", "MultitaskingViewFrame", "Windows.UI.Core.CoreWindow"):
            return False

        # 2. 检查进程名，剔除资源管理器与桌宠自身
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        try:
            p = psutil.Process(pid.value)
            p_name = p.name().lower()
            if p_name in IGNORED_PROCESSES or "electron" in p_name or "rumia" in p_name or "python" in p_name:
                return False
        except Exception:
            pass

        # 3. 获取前台窗口坐标与所在显示器分辨率
        rect = wintypes.RECT()
        if user32.GetWindowRect(hwnd, ctypes.byref(rect)) == 0:
            return False

        hMonitor = user32.MonitorFromWindow(hwnd, 2)  # MONITOR_DEFAULTTONEAREST = 2
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        if user32.GetMonitorInfoW(hMonitor, ctypes.byref(mi)) == 0:
            return False

        m = mi.rcMonitor
        # 如果前台窗口四边覆盖全屏 (允许 ±5 像素误差，兼容无边框全屏与多显示器)
        is_fs = (
            rect.left <= m.left + 5 and
            rect.top <= m.top + 5 and
            rect.right >= m.right - 5 and
            rect.bottom >= m.bottom - 5
        )
        return is_fs
    except Exception:
        return False

if __name__ == "__main__":
    print(get_active_programs())
    print("Is Fullscreen Game Active:", is_fullscreen_game_active())

