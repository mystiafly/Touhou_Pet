import sys
import os
import pytest
from fastapi.testclient import TestClient

# 确保当前路径和 services 目录在 sys.path 中，以便能导入 web_interface
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'services')))

from web_interface import app

@pytest.fixture
def client():
    """
    提供 FastAPI TestClient 的 fixture。
    每个需要发起 API 请求的测试函数都可以直接将 `client` 作为参数传入。
    """
    with TestClient(app) as c:
        yield c
