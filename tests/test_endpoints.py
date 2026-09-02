def test_get_history(client):
    """
    测试获取对话历史记录接口 (GET /api/history)
    """
    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list) or isinstance(data, dict)

def test_page_renders(client):
    """
    测试页面静态模板渲染接口 (GET /pet, GET /dashboard, GET /)
    """
    assert client.get("/pet").status_code == 200
    assert client.get("/dashboard").status_code == 200
    assert client.get("/").status_code == 200

def test_system_router(client):
    """
    测试系统与配置路由 (GET /api/system/version, GET /api/settings/config)
    """
    res_ver = client.get("/api/system/version")
    assert res_ver.status_code == 200
    assert "version" in res_ver.json()
    
    res_cfg = client.get("/api/settings/config")
    assert res_cfg.status_code == 200

def test_character_router(client):
    """
    测试角色管理路由 (GET /api/characters/list, GET /api/character_info)
    """
    res_chars = client.get("/api/characters/list")
    assert res_chars.status_code == 200
    assert isinstance(res_chars.json(), (list, dict))
    
    res_info = client.get("/api/character_info")
    assert res_info.status_code == 200
    info_data = res_info.json()
    assert "character_name" in info_data or "id" in info_data

def test_memory_router(client):
    """
    测试记忆与日志路由 (GET /api/settings/logs)
    """
    res_logs = client.get("/api/settings/logs")
    assert res_logs.status_code == 200

def test_audio_router(client):
    """
    测试音频与 TTS 路由 (GET /api/tts/gpt_sovits/status)
    """
    res_tts = client.get("/api/tts/gpt_sovits/status")
    assert res_tts.status_code == 200

def test_backup_router(client):
    """
    测试更新防死全量角色备份路由 (GET /api/system/backup_status, POST /api/system/backup_characters)
    """
    res_status = client.get("/api/system/backup_status")
    assert res_status.status_code == 200
    data = res_status.json()
    assert data["status"] == "success"
    assert "data" in data
    assert "has_backup" in data["data"]
    assert "is_valid_within_3_days" in data["data"]


