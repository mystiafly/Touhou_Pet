# web_interface.py - Web界面后端 (FastAPI 架构升级版) - Refactored Entry Point
import os
import sys
import threading
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

import io

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SERVICES_DIR)

from core.config_manager import USER_DATA_DIR, SERVICES_DIR

LOGS_DIR = os.path.join(USER_DATA_DIR, "logs")
try:
    os.makedirs(LOGS_DIR, exist_ok=True)
except Exception:
    pass
backend_log_file = os.path.join(LOGS_DIR, "backend_output.log")

# 双写日志流：既实时输出到控制台黑框，又实时存盘到 logs/backend_output.log
class TeeLogger:
    def __init__(self, stream, log_filepath):
        self.terminal = stream
        self.log_filepath = log_filepath
        try:
            self.file = open(log_filepath, "a", encoding="utf-8", buffering=1)
        except Exception:
            self.file = None

    def write(self, message):
        if self.terminal:
            try:
                self.terminal.write(message)
                self.terminal.flush()
            except Exception:
                pass
        if self.file:
            try:
                self.file.write(message)
                self.file.flush()
            except Exception:
                pass

    def flush(self):
        if self.terminal:
            try:
                self.terminal.flush()
            except Exception:
                pass
        if self.file:
            try:
                self.file.flush()
            except Exception:
                pass

    def isatty(self):
        return getattr(self.terminal, 'isatty', lambda: False)()

    def reconfigure(self, **kwargs):
        pass

def silence_noisy_third_party_loggers():
    """彻底屏绝第三方库 (fastembed, huggingface_hub, qdrant_client, urllib3) 弹出的红字告警日志"""
    import logging
    for log_name in ["fastembed", "fastembed.common.model_management", "huggingface_hub", "qdrant_client", "urllib3", "httpx", "sentence_transformers"]:
        logging.getLogger(log_name).setLevel(logging.CRITICAL)

    try:
        from loguru import logger
        logger.disable("fastembed")
        logger.disable("qdrant_client")
        logger.disable("huggingface_hub")
    except Exception:
        pass

silence_noisy_third_party_loggers()

if 'pytest' not in sys.modules:
    sys.stdout = TeeLogger(sys.stdout, backend_log_file)
    sys.stderr = TeeLogger(sys.stderr, backend_log_file)

# 重新配置 stdout/stderr 编码为 utf-8，防止 Windows 环境下打印 Emoji ⚠️ 触发 UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

sys.path.append(SERVICES_DIR)

load_dotenv(os.path.join(os.path.dirname(SERVICES_DIR), '.env'))

from api.routes import router
from workers.distillation import daily_distillation_worker

# 初始化 FastAPI
app = FastAPI(title="Desktop Pet Backend", version="0.3.0")

# 挂载静态文件目录 (services/static -> /static)
app.mount("/static", StaticFiles(directory=os.path.join(SERVICES_DIR, "static")), name="static")

# 挂载角色资源目录(USER_DATA_DIR/characters -> /char_assets)
app.mount("/char_assets", StaticFiles(directory=os.path.join(USER_DATA_DIR, "characters")), name="char_assets")

# 挂载路由
app.include_router(router)

if __name__ == '__main__':
    # 启动后台每日记忆主动整理守护线程
    t = threading.Thread(target=daily_distillation_worker, daemon=True)
    t.start()
    
    print("[BACKEND] 正在启动本地极其流畅的 FastAPI 异步后台服务器...")
    uvicorn.run(app, host="127.0.0.1", port=5000)
