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

if __name__ == "__main__":
    print(get_active_programs())
