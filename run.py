import subprocess
import os
import sys
import time
import signal

def main():
    # 获取当前脚本所在的根目录路径
    root_dir = os.path.dirname(os.path.abspath(__file__))
    services_dir = os.path.join(root_dir, 'services')

    print(f"--- 露米娅启动程序 ---")
    print(f"根目录: {root_dir}")

    # ==========================================
    # 1. 启动大脑 (FastAPI 后端)
    # ==========================================
    print("\n[1/2] 正在唤醒大脑 (FastAPI Backend)...")

    # 在 services 目录下运行 FastAPI (uvicorn) 后端
    # 确保能正确找到 dialog_history.json
    log_path = os.path.join(services_dir, 'backend.log')
    log_file = open(log_path, 'w', encoding='utf-8')
    flask_process = subprocess.Popen(
        [sys.executable, 'web_interface.py'],
        cwd=services_dir,
        stdout=log_file,
        stderr=log_file
    )

    # 给后端充足的时间初始化与加载本地嵌入特征权重 (自适应调整为 8 秒，保障极其流畅的启动)
    time.sleep(8)

    # ==========================================
    # 2. 启动身体 (Electron 前端)
    # ==========================================
    print("[2/2] 正在构建身体 (Electron Frontend)...")

    # Windows 下 npm 命令实际上是 npm.cmd
    npm_cmd = 'npm.cmd' if os.name == 'nt' else 'npm'

    # 运行 npm start
    electron_process = subprocess.Popen(
        [npm_cmd, 'start'],
        cwd=root_dir,
        shell=False
    )

    print("\n>>> 露米娅已召唤成功！ <<<")
    print("提示：关闭桌宠窗口，或者关闭此黑框，都会结束程序。")

    # ==========================================
    # 3. 守护进程 (等待关闭)
    # ==========================================
    try:
        # 阻塞主程序，直到 Electron 窗口被关闭
        electron_process.wait()
    except KeyboardInterrupt:
        print("\n检测到中断...")
    finally:
        # 当 Electron 关闭后，自动杀死 FastAPI 后端
        print("正在让露米娅休息 (清理后台进程)...")

        # 尝试优雅关闭
        flask_process.terminate()

        # 确保它真的死了 (强制杀死进程树，防止端口占用)
        if os.name == 'nt':
            # Windows 强力命令
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(flask_process.pid)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            flask_process.kill()

        log_file.close()
        print("晚安，露米娅。")

if __name__ == '__main__':
    main()
