def test_get_history(client):
    """
    测试获取对话历史记录接口 (GET /api/history)
    """
    response = client.get("/api/history")
    # 验证 HTTP 状态码为 200
    assert response.status_code == 200
    
    # 验证返回的内容至少是一个合法的 JSON 结构
    # （这里可以根据实际业务需求添加更多对 response.json() 的断言）
    data = response.json()
    assert isinstance(data, list) or isinstance(data, dict)

def test_post_chat(client):
    """
    测试发送聊天消息接口 (POST /api/chat)
    """
    payload = {"message": "你好！"}
    response = client.post("/api/chat", json=payload)
    
    # 根据之前的测试脚本，我们需要确保接口能正常响应
    assert response.status_code == 200
    
    # 打印一些内容用于调试（在 pytest 中通常只有失败时才会显示 print 的内容）
    print(f"Chat Response: {response.text}")
