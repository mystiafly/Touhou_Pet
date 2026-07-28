import requests
import json

try:
    response = requests.post(
        "http://127.0.0.1:5000/api/chat",
        json={"message": "你好啊琪露诺"}
    )
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.text)
except Exception as e:
    print("ERROR:", e)
