# web_interface.py - Web界面后端 (FastAPI 架构升级版) - Refactored Entry Point
import os
import sys
import threading
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# 重新配置 stdout/stderr 编码为 utf-8，防止 Windows 环境下打印 Emoji ⚠️ 触发 UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SERVICES_DIR)

load_dotenv(os.path.join(os.path.dirname(SERVICES_DIR), '.env'))

from api.routes import router
from workers.distillation import daily_distillation_worker

# 初始化 FastAPI
app = FastAPI(title="Desktop Pet Backend", version="0.3.0")

# 挂载静态文件目录 (services/static -> /static)
app.mount("/static", StaticFiles(directory=os.path.join(SERVICES_DIR, "static")), name="static")

# 挂载路由
app.include_router(router)

if __name__ == '__main__':
    # 启动后台每日记忆主动整理守护线程
    t = threading.Thread(target=daily_distillation_worker, daemon=True)
    t.start()
    
    print("[BACKEND] 正在启动本地极其流畅的 FastAPI 异步后台服务器...")
    uvicorn.run(app, host="127.0.0.1", port=5000)
