# services/settings_system.py
from flask import Blueprint, jsonify, request
import os
import signal
import sys
import threading
import time

# 创建蓝图对象
settings_bp = Blueprint('settings', __name__)

def shutdown_server():
    """延迟执行关闭服务器，给前端一点时间显示反馈"""
    time.sleep(1)
    print("系统正在关闭...")
    # 强制杀死当前进程 (适用于 Windows/Linux)
    os._exit(0)

@settings_bp.route('/api/settings/exit', methods=['POST'])
def exit_game():
    """退出游戏接口"""
    print("收到退出指令")

    # 启动一个子线程去执行关闭，防止请求没返回就被掐断了
    threading.Thread(target=shutdown_server).start()

    return jsonify({"success": True, "message": "露米娅正在去睡觉..."})

# 预留：将来可以在这里添加更多路由，比如：
# @settings_bp.route('/api/settings/save_config', methods=['POST'])
# ...
