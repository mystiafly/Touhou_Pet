import ctypes
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

def get_active_programs() -> str:
    """
    抓取当前系统中可见的活跃窗口标题及其进程名，用于向桌宠提供“用户在忙什么”的上下文。
    返回一段拼接好的自然语言字符串描述。
    """
    EnumWindows = ctypes.windll.user32.EnumWindows
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int))
    GetWindowText = ctypes.windll.user32.GetWindowTextW
    GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
    IsWindowVisible = ctypes.windll.user32.IsWindowVisible
    GetWindowThreadProcessId = ctypes.windll.user32.GetWindowThreadProcessId

    active_apps = []
    seen_titles = set()

    def foreach_window(hwnd, lParam):
        if IsWindowVisible(hwnd):
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
