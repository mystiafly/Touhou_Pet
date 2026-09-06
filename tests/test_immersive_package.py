import pytest
from core.config_manager import get_config, save_config

def test_immersive_package_config_default():
    """测试配置管理器中沉浸套餐字段的默认值"""
    cfg = get_config()
    assert "immersive_package" in cfg
    assert cfg["immersive_package"] in ["companion", "gal"]

def test_immersive_package_config_save():
    """测试沉浸套餐配置的保存与读取"""
    original_cfg = get_config()
    original_package = original_cfg.get("immersive_package", "companion")

    try:
        save_config({"immersive_package": "gal"})
        updated = get_config()
        assert updated["immersive_package"] == "gal"

        save_config({"immersive_package": "companion"})
        restored = get_config()
        assert restored["immersive_package"] == "companion"
    finally:
        save_config({"immersive_package": original_package})

def test_api_config_endpoints_immersive_package(client):
    """测试系统配置 API (GET & POST) 对沉浸套餐的持久化支持"""
    original_cfg = get_config()
    original_package = original_cfg.get("immersive_package", "companion")

    try:
        # GET /api/settings/config
        res = client.get("/api/settings/config")
        assert res.status_code == 200
        data = res.json()
        assert "immersive_package" in data

        # POST /api/settings/config 设置为 gal
        post_res = client.post("/api/settings/config", json={"immersive_package": "gal"})
        assert post_res.status_code == 200
        assert post_res.json()["status"] == "success"

        # 验证更新
        verify_res = client.get("/api/settings/config")
        assert verify_res.json()["immersive_package"] == "gal"

        # POST /api/settings/config 设置回 companion
        post_res2 = client.post("/api/settings/config", json={"immersive_package": "companion"})
        assert post_res2.status_code == 200
        assert post_res2.json()["status"] == "success"

        verify_res2 = client.get("/api/settings/config")
        assert verify_res2.json()["immersive_package"] == "companion"
    finally:
        save_config({"immersive_package": original_package})

def test_api_character_info_contains_immersive_package(client):
    """测试 /api/character_info 返回沉浸套餐字段"""
    res = client.get("/api/character_info")
    assert res.status_code == 200
    data = res.json()
    assert "immersive_package" in data
    assert data["immersive_package"] in ["companion", "gal"]
