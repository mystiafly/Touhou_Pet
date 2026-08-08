import subprocess
import os
import sys

# 默认设置 HuggingFace 镜像，防止国内下载模型超时失败
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

import time
import signal
import urllib.request
import zipfile
import shutil

def get_npm_command(root_dir):
    """获取 npm 命令路径。如果系统没装 Node.js，则自动下载便携版。"""
    if os.name != 'nt':
        return 'npm'

    try:
        # 尝试检查系统全局 npm
        subprocess.check_output(['npm.cmd', '-v'], stderr=subprocess.STDOUT)
        return 'npm.cmd'
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    
    # 系统未找到，使用便携版
    node_version = "v20.11.1"
    arch = "win-x64"
    portable_node_dir = os.path.join(root_dir, '.node_env')
    npm_path = os.path.join(portable_node_dir, f"node-{node_version}-{arch}", "npm.cmd")
    
    if os.path.exists(npm_path):
        return npm_path
        
    print(f"\n[SYSTEM] 未检测到系统 Node.js。正在自动为您下载便携版 Node.js ({node_version})，这可能需要一两分钟...")
    os.makedirs(portable_node_dir, exist_ok=True)
    zip_url = f"https://nodejs.org/dist/{node_version}/node-{node_version}-{arch}.zip"
    zip_path = os.path.join(portable_node_dir, "node.zip")
    
    def report_progress(block_num, block_size, total_size):
        if total_size > 0:
            percent = min(100, int(block_num * block_size * 100 / total_size))
            sys.stdout.write(f"\r下载进度: {percent}%")
            sys.stdout.flush()
            
    try:
        urllib.request.urlretrieve(zip_url, zip_path, reporthook=report_progress)
        print("\n[SYSTEM] 下载完成，正在解压...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(portable_node_dir)
        os.remove(zip_path)
        print("[SYSTEM] 便携版 Node.js 准备完毕！")
        return npm_path
    except Exception as e:
        print(f"\n[ERROR] 自动下载 Node.js 失败: {e}")
        return 'npm.cmd'  # 回退到默认，后续流程会正常捕获并报错退出

def main():
    # 获取当前脚本所在的根目录路径
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 自动检查并重定向到虚拟环境 Python (防止用户双击 run.py 或使用全局 Python 导致依赖缺失崩溃)
    venv_python = os.path.join(root_dir, '.venv', 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(root_dir, '.venv', 'bin', 'python')
    if os.path.exists(venv_python) and os.path.abspath(sys.executable) != os.path.abspath(venv_python):
        print(f"[SYSTEM] 检测到本地虚拟环境，已自动重定向并使用虚拟环境 Python 重新启动...")
        subprocess.Popen([venv_python] + sys.argv, cwd=root_dir)
        sys.exit(0)
        
    services_dir = os.path.join(root_dir, 'services')

    print(f"--- 桌宠启动程序 ---")
    print(f"根目录: {root_dir}")

    # ==========================================
    # 0. 清理残留进程 (防止端口冲突)
    # ==========================================
    print("\n[0/2] 正在清理前次残留进程 (防止端口 5000 被占用)...")
    try:
        if os.name == 'nt':
            # 杀死所有占用 5000 端口的进程
            subprocess.call('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :5000\') do taskkill /f /pid %a >nul 2>&1', shell=True)
            # 杀死孤立的 electron 进程
            subprocess.call('taskkill /F /IM electron.exe >nul 2>&1', shell=True)
    except Exception as e:
        print(f"清理残留进程时出现警告: {e}")

    # ==========================================
    # 1. 启动大脑 (FastAPI 后端)
    # ==========================================
    print("\n[1/2] 正在唤醒大脑 (FastAPI Backend)...")

    flask_process = subprocess.Popen(
        [sys.executable, 'web_interface.py'],
        cwd=services_dir
    )

    # 给后端充足的时间初始化与加载本地嵌入特征权重 (自适应调整为 8 秒，保障极其流畅的启动)
    time.sleep(8)

    # ==========================================
    # 2. 启动身体 (Electron 前端)
    # ==========================================
    print("[2/2] 正在构建身体 (Electron Frontend)...")

    # 获取 npm 命令 (自动寻找全局或下载便携版)
    npm_cmd = get_npm_command(root_dir)

    # 自动检查并安装前端依赖
    node_modules_dir = os.path.join(root_dir, 'node_modules')
    if not os.path.exists(node_modules_dir):
        print("\n[SYSTEM] 初次运行或未检测到前端依赖 (node_modules)，正在自动为您执行 npm install，请稍候...")
        try:
            subprocess.call([npm_cmd, 'install'], cwd=root_dir, shell=False)
        except FileNotFoundError:
            print("\n[ERROR] 未找到 npm 命令！请确认您是否已经安装了 Node.js (https://nodejs.org) 并已将其添加到 PATH。")
            flask_process.terminate()
            if os.name == 'nt':
                subprocess.call(['taskkill', '/F', '/T', '/PID', str(flask_process.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            sys.exit(1)

    try:
        # 运行 npm start
        electron_process = subprocess.Popen(
            [npm_cmd, 'start'],
            cwd=root_dir,
            shell=False
        )
    except FileNotFoundError:
        print("\n[ERROR] 未找到 npm 命令！请确认您是否已经安装了 Node.js (https://nodejs.org) 并已将其添加到 PATH。")
        flask_process.terminate()
        if os.name == 'nt':
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(flask_process.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        sys.exit(1)

    print("\n>>> 桌宠已召唤成功！ <<<")
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
        print("正在让桌宠休息 (清理后台进程)...")

        # 尝试优雅关闭
        flask_process.terminate()

        # 确保它真的死了 (强制杀死进程树，防止端口占用)
        if os.name == 'nt':
            # Windows 强力命令
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(flask_process.pid)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            flask_process.kill()

        print("晚安，再见。")

if __name__ == '__main__':
    main()
