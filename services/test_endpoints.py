import sys, os
sys.path.append(os.path.abspath('.'))

from fastapi.testclient import TestClient
from web_interface import app

client = TestClient(app)

print("Testing GET /api/history...")
resp_hist = client.get("/api/history")
print(resp_hist.status_code)
print(resp_hist.text)

print("\nTesting POST /api/chat...")
resp_chat = client.post("/api/chat", json={"message": "你好！"})
print(resp_chat.status_code)
print(resp_chat.text)
