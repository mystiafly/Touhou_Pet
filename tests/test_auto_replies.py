import pytest
from core.config_manager import get_config, save_config, DEFAULT_AUTO_REPLIES_PROMPT
from tools.tool_executor import parse_reply, extract_suggested_replies

def test_auto_replies_config_defaults():
    """测试全局配置中自动回话默认值与恢复逻辑"""
    cfg = get_config()
    assert "enable_auto_replies" in cfg
    assert isinstance(cfg["enable_auto_replies"], bool)
    assert "auto_replies_prompt" in cfg
    assert "<suggested_replies>" in cfg["auto_replies_prompt"]

def test_extract_suggested_replies_standard():
    """测试标准格式的自动回话候选项提取"""
    text = (
        "<character_thought>\n1. 思考\n</character_thought>\n"
        "[normal][12] 哼，今天你迟到了哦！(傲娇扭头)\n\n"
        "<suggested_replies>\n"
        "[温柔] 抱歉啦，路上有点堵车，给你带了礼物哦。\n"
        "[调侃] 某人这么早就开始想我啦？\n"
        "[好奇] 露米娅等了我多久呀？\n"
        "</suggested_replies>"
    )
    replies = extract_suggested_replies(text)
    assert len(replies) == 3
    assert replies[0]["emotion"] == "温柔"
    assert "路上有点堵车" in replies[0]["text"]
    assert replies[1]["emotion"] == "调侃"
    assert "某人这么早" in replies[1]["text"]
    assert replies[2]["emotion"] == "好奇"
    assert "等了我多久" in replies[2]["text"]

def test_extract_suggested_replies_numbered_and_chinese_brackets():
    """测试带有序号、中英文括号与符号的变体格式提取"""
    text = (
        "[normal][10] 好无聊呀~ (在桌面上打滚)\n\n"
        "<suggested_replies>\n"
        "1. 【宠溺】 那带你去吃好吃的点心好不好？\n"
        "2. 【戏谑】 滚来滚去的像个小毛球一样。\n"
        "- 【疑惑】 今天怎么没去找琪露诺玩呢？\n"
        "</suggested_replies>"
    )
    replies = extract_suggested_replies(text)
    assert len(replies) == 3
    assert replies[0]["emotion"] == "宠溺"
    assert "吃好吃的点心" in replies[0]["text"]
    assert replies[1]["emotion"] == "戏谑"
    assert "像个小毛球" in replies[1]["text"]
    assert replies[2]["emotion"] == "疑惑"
    assert "找琪露诺玩" in replies[2]["text"]

def test_parse_reply_strips_suggested_replies():
    """测试 parse_reply 确保对白干净，彻底剔除候选项标签不泄露"""
    raw_text = (
        "<character_thought>\n思考内容\n</character_thought>\n"
        "[shy][15] (脸红) 你...你怎么突然这么说...\n\n"
        "<suggested_replies>\n"
        "[温柔] 因为最喜欢你了呀。\n"
        "[调侃] 怎么脸红成苹果啦？\n"
        "[追问] 刚才的话你到底听到了没有呀？\n"
        "</suggested_replies>"
    )
    emotion, score, clean_content = parse_reply(raw_text)
    assert emotion == "shy"
    assert score == 15
    assert "(脸红) 你...你怎么突然这么说..." in clean_content
    assert "<suggested_replies>" not in clean_content
    assert "</suggested_replies>" not in clean_content
    assert "最喜欢你了呀" not in clean_content
    assert "怎么脸红成苹果啦" not in clean_content

def test_extract_empty_when_no_tag():
    """当模型未生成候选项标签时，安全返回空列表"""
    text = "[normal][10] 今天天气真好呢。"
    replies = extract_suggested_replies(text)
    assert replies == []

def test_auto_replies_api_save_and_load(client):
    """测试通过 /api/settings/config 保存与读取自动回话开关和提示词，并在测试后无损恢复"""
    orig_res = client.get("/api/settings/config")
    orig_data = orig_res.json() if orig_res.status_code == 200 else {}
    orig_enabled = orig_data.get("enable_auto_replies", True)
    orig_prompt = orig_data.get("auto_replies_prompt", DEFAULT_AUTO_REPLIES_PROMPT)

    try:
        res = client.post("/api/settings/config", json={
            "enable_auto_replies": True,
            "auto_replies_prompt": DEFAULT_AUTO_REPLIES_PROMPT
        })
        assert res.status_code == 200
        assert res.json().get("success") is True

        get_res = client.get("/api/settings/config")
        assert get_res.status_code == 200
        data = get_res.json()
        assert data.get("enable_auto_replies") is True
        assert "<suggested_replies>" in data.get("auto_replies_prompt")
    finally:
        client.post("/api/settings/config", json={
            "enable_auto_replies": orig_enabled,
            "auto_replies_prompt": orig_prompt
        })

def test_suggested_replies_endpoint_validation(client):
    """测试 /api/suggested_replies 在空参数或关闭状态下的边界与校验"""
    # 1. 空回复内容
    res = client.post("/api/suggested_replies", json={"user_message": "你好", "char_reply": ""})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["suggested_replies"] == []

def test_suggested_replies_endpoint_mock_success(client, monkeypatch):
    """测试 /api/suggested_replies 调用后置模型成功生成并解析回话建议"""
    from langchain_core.messages import AIMessage

    mock_content = (
        "<suggested_replies>\n"
        "[温柔] 乖，好多了。手怎么这么冰，要不要我给你暖暖？\n"
        "[调侃] 认得出，这招牌动作除了你还有谁。\n"
        "[好奇] 认得出呀，怎么突然这么温柔了？\n"
        "</suggested_replies>"
    )

    def mock_call_model(*args, **kwargs):
        return AIMessage(content=mock_content)

    monkeypatch.setattr("graph.nodes.call_model_with_fallback", mock_call_model)

    res = client.post("/api/suggested_replies", json={
        "user_message": "你刚才摸我头了",
        "char_reply": "乖哦。这样有没有好一点？还认得出我是谁吗？",
        "char_name": "芙兰朵露"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["suggested_replies"]) == 3
    assert data["suggested_replies"][0]["emotion"] == "温柔"
    assert "好多了" in data["suggested_replies"][0]["text"]
    assert data["suggested_replies"][1]["emotion"] == "调侃"
    assert data["suggested_replies"][2]["emotion"] == "好奇"

