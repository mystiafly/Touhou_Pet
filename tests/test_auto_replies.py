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

def test_auto_replies_mode_and_history_rounds_config(client):
    """测试自动回话模式与历史轮数配置持久化与角色信息读取"""
    orig_res = client.get("/api/settings/config")
    orig_data = orig_res.json() if orig_res.status_code == 200 else {}
    orig_mode = orig_data.get("auto_replies_mode", "click")
    orig_rounds = orig_data.get("auto_replies_history_rounds", 3)

    try:
        # 1. 保存模式为 auto, 历史轮数为 5
        save_res = client.post("/api/settings/config", json={
            "auto_replies_mode": "auto",
            "auto_replies_history_rounds": 5
        })
        assert save_res.status_code == 200
        assert save_res.json().get("success") is True

        # 2. 从 settings/config 读取验证
        cfg_res = client.get("/api/settings/config")
        cfg_data = cfg_res.json()
        assert cfg_data.get("auto_replies_mode") == "auto"
        assert cfg_data.get("auto_replies_history_rounds") == 5

        # 3. 从 character_info 读取验证
        char_res = client.get("/api/character_info")
        assert char_res.status_code == 200
        char_data = char_res.json()
        assert char_data.get("auto_replies_mode") == "auto"
        assert char_data.get("auto_replies_history_rounds") == 5
    finally:
        # 恢复初始配置
        client.post("/api/settings/config", json={
            "auto_replies_mode": orig_mode,
            "auto_replies_history_rounds": orig_rounds
        })

def test_suggested_replies_multi_turn_context(client, monkeypatch):
    """测试 /api/suggested_replies 在携带历史轮数时，能正确装配近期对话脉络"""
    from langchain_core.messages import AIMessage

    recorded_messages = []
    def mock_call_model(messages, *args, **kwargs):
        recorded_messages.extend(messages)
        return AIMessage(content="<suggested_replies>\n[温柔] 好的呢\n[调侃] 哈哈\n[好奇] 为什么呢\n</suggested_replies>")

    monkeypatch.setattr("graph.nodes.call_model_with_fallback", mock_call_model)

    # 模拟历史对话
    mock_history = [
        {"role": "user", "content": "今天天气真好"},
        {"role": "assistant", "content": "[happy][10] 是呀，适合出去散步呢"},
        {"role": "user", "content": "那你想去哪里玩？"},
        {"role": "assistant", "content": "[smile][12] 我想去博丽神社抓蝴蝶！"}
    ]
    monkeypatch.setattr("core.memory_manager.load_history", lambda: mock_history)

    res = client.post("/api/suggested_replies", json={
        "user_message": "抓蝴蝶小心摔倒哦",
        "char_reply": "才不会呢，我飞得可稳啦！",
        "char_name": "露米娅",
        "history_rounds": 2
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["suggested_replies"]) == 3

    # 验证传递给模型的 human message 是否包含了前序情境和最新情境
    human_msg = recorded_messages[1].content
    assert "【近期对话脉络参考（前序情境）】" in human_msg
    assert "用户: 今天天气真好" in human_msg
    assert "露米娅: 是呀，适合出去散步呢" in human_msg
    assert "用户: 那你想去哪里玩？" in human_msg
    assert "露米娅: 我想去博丽神社抓蝴蝶！" in human_msg
    assert "【最新对话情境】" in human_msg
    assert "用户刚才说：抓蝴蝶小心摔倒哦" in human_msg
    assert "露米娅刚才回复：才不会呢，我飞得可稳啦！" in human_msg

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



