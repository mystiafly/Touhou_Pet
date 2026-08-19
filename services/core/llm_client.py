import os
from openai import OpenAI
from langchain_openai import ChatOpenAI
from core.config_manager import get_config, get_custom_engines

def get_llm_client_and_model(provider_override: str = None):
    """根据配置动态获取大模型客户端和模型名称"""
    config_data = get_config()
    provider = provider_override if provider_override and provider_override != "inherit" else config_data.get("api_provider", os.getenv("API_PROVIDER", "deepseek"))
    provider = provider.lower()
    
    deepseek_key = config_data.get("engine_api_key") or config_data.get("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY")
    gemini_key = config_data.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
    
    # Check custom engine
    if provider.startswith("custom_"):
        custom_engines = get_custom_engines()
        for engine in custom_engines:
            if engine.get("id") == provider:
                api_key = engine.get("api_key")
                if not api_key:
                    api_key = config_data.get("engine_api_key") or config_data.get("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY") or "sk-local"
                model_name = engine.get("model_name", "custom-model")
                return OpenAI(
                    api_key=api_key,
                    base_url=engine.get("base_url")
                ), model_name
    
    if provider == "gemini" and gemini_key:
        return OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        ), "gemini-2.5-flash"
        
    if provider == "deepseek-v4-pro" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-v4-pro"
        
    if provider == "deepseek-v4-flash" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-v4-flash"
        
    if provider == "deepseek-chat" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    if provider == "deepseek" and deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    # 自动兜底 (使用 Gemini)
    if gemini_key:
        return OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        ), "gemini-2.5-flash"
    elif deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        ), "deepseek-chat"
        
    raise ValueError("未检测到有效的 API 密钥环境，请检查 .env 文件。")

def is_temperature_fixed_model(model_name: str) -> bool:
    """判断是否属于强制要求 temperature=1.0 的推理或特定模型 (如 Kimi/Moonshot, OpenAI o1/o3, DeepSeek-R1/Reasoner 等)"""
    if not model_name:
        return False
    name_lower = model_name.lower()
    return any(k in name_lower for k in [
        "kimi", "moonshot", "o1", "o3", "r1", "reasoner", "thinking"
    ])

def get_safe_temperature(model_name: str, preferred_temp: float = 0.7) -> float:
    """获取安全的 temperature 参数"""
    if is_temperature_fixed_model(model_name):
        return 1.0
    return preferred_temp

def get_langchain_model(provider_override: str = None):
    """根据配置动态获取 LangChain ChatModel 包装实例"""
    config_data = get_config()
    provider = provider_override if provider_override and provider_override != "inherit" else config_data.get("api_provider", os.getenv("API_PROVIDER", "deepseek"))
    provider = provider.lower()
    
    deepseek_key = config_data.get("engine_api_key") or config_data.get("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY")
    gemini_key = config_data.get("gemini_api_key") or os.getenv("GEMINI_API_KEY")
    
    api_key = None
    base_url = None
    model_name = None
    
    # Check custom engine
    if provider.startswith("custom_"):
        custom_engines = get_custom_engines()
        for engine in custom_engines:
            if engine.get("id") == provider:
                api_key = engine.get("api_key")
                if not api_key:
                    api_key = config_data.get("engine_api_key") or config_data.get("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY")
                base_url = engine.get("base_url")
                model_name = engine.get("model_name", "custom-model")
                break
    
    if not api_key:
        if provider == "gemini" and gemini_key:
            api_key = gemini_key
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            model_name = "gemini-2.5-flash"
        elif provider == "deepseek-v4-pro" and deepseek_key:
            api_key = deepseek_key
            base_url = "https://api.deepseek.com"
            model_name = "deepseek-v4-pro"
        elif provider == "deepseek-v4-flash" and deepseek_key:
            api_key = deepseek_key
            base_url = "https://api.deepseek.com"
            model_name = "deepseek-v4-flash"
        elif provider in ["deepseek-chat", "deepseek"] and deepseek_key:
            api_key = deepseek_key
            base_url = "https://api.deepseek.com"
            model_name = "deepseek-chat"
        elif gemini_key:
            api_key = gemini_key
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            model_name = "gemini-2.5-flash"
        elif deepseek_key:
            api_key = deepseek_key
            base_url = "https://api.deepseek.com"
            model_name = "deepseek-chat"
        
    if not api_key:
        raise ValueError("未检测到有效的 API 密钥环境，请检查 .env 文件。")
        
    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model_name,
        temperature=get_safe_temperature(model_name, 0.7)
    )

def format_llm_error(error: Exception | str, char_name: str = "桌宠") -> dict:
    """
    智能分析大模型抛出的异常，精准识别欠费、未授权、超频、超时等错误，
    并转化为角色口吻的对话气泡与大贤者思维链诊断。
    """
    err_str = str(error)
    err_lower = err_str.lower()
    
    emotion = "crying"
    thought = f"【大模型 API 调用异常】\n原始错误信息: {err_str}"
    
    # 0. Temperature 约束异常 (400, invalid temperature: only 1 is allowed for this model)
    if "temperature" in err_lower and ("only 1" in err_lower or "must be 1" in err_lower or "invalid temperature" in err_lower):
        reply = f"呜...当前大模型要求 Temperature 必须为 1.0！系统已为您自动尝试兼容适配，请重试一次看看~"
        thought = f"【大贤者诊断 - Temperature 约束】\n目标大模型强制要求 Temperature 为 1.0 (例如 Kimi/o1/o3 推理模型)。已自动修正。"
        error_type = "invalid_temperature"
    
    # 1. 欠费 / 余额不足 (402, Insufficient Balance, out_of_quota, etc.)
    if any(k in err_lower for k in [
        "insufficient balance", "insufficient_balance", "balance", "欠费", "余额",
        "quota exceeded", "quota_exceeded", "out of quota", "exceeded your current quota",
        "account_overdue", "payment required", "402"
    ]):
        reply = f"呜呜...大模型 API 账户好像欠费或者余额不足啦！(错误: Insufficient Balance)\n快去大贤者控制台或服务商官网充值吧，不然我没法动脑思考了..."
        thought = f"【大贤者警报 - 账户欠费】\n检测到大模型服务商返回 402/欠费代码 (Insufficient Balance)。请前往对应服务商控制台充值以恢复对话。"
        error_type = "insufficient_balance"
        
    # 2. 认证失败 / API Key 错误 (401, Invalid API Key, Unauthorized, Authentication Fails)
    elif any(k in err_lower for k in [
        "authentication", "invalid api key", "invalid_api_key", "incorrect api key",
        "unauthorized", "401", "未授权", "密钥无效", "api_key"
    ]):
        emotion = "shy"
        reply = f"唔... API 密钥好像填错了或者失效了 (401 Unauthorized)！\n请在大贤者控制台的「大脑引擎」中检查并更新 API Key 哦~"
        thought = f"【大贤者警报 - 认证失败】\nAPI Key 认证失败 (401 Unauthorized)。请检查 API 密钥是否输入完整且有效。"
        error_type = "unauthorized"

    # 3. 频率限制 / 并发超限 (429, Rate Limit, Too Many Requests)
    elif any(k in err_lower for k in [
        "rate limit", "rate_limit", "too many requests", "429", "resource has been exhausted", "tpm", "rpm"
    ]):
        emotion = "angry"
        reply = f"哎呀脑子转不过来了...说话太快触发了服务商的频率限制 (429 Rate Limit)，稍等几秒再和我搭话吧！"
        thought = f"【大贤者警报 - 请求超限】\n大模型请求过于频繁 (429 Rate Limit)。已达到 TPM/RPM 或并发上限。"
        error_type = "rate_limit"

    # 4. 模型不存在 / 名称错误 (404, Model Not Found)
    elif any(k in err_lower for k in [
        "model_not_found", "model not found", "does not exist", "404", "not found"
    ]):
        reply = f"找不到配置的模型名称呢 (404 Not Found)！\n请在大贤者控制台确认模型代号 (Model Name) 是否拼写正确。"
        thought = f"【大贤者警报 - 模型不存在】\n目标大模型不存在 (404 Not Found)。请检查模型名称是否输入正确。"
        error_type = "model_not_found"

    # 5. 网络超时 / 无法连接 (Timeout, ConnectionRefused, 10060)
    elif any(k in err_lower for k in [
        "timeout", "timed out", "connection error", "connection refused", "connectionrefused", "10060", "connecterror"
    ]):
        reply = f"呜...连接大模型服务器超时了，请检查网络连接、代理或 API Base URL 设置哦！"
        thought = f"【大贤者警报 - 网络连接超时】\n连接目标 Base URL 超时。请检查网络环境或代理配置。"
        error_type = "network_timeout"

    # 6. 未配置任何 API Key (ValueError: 未检测到有效的 API 密钥环境)
    elif "未检测到有效的 api 密钥环境" in err_lower or "api 密钥" in err_lower:
        emotion = "shy"
        reply = f"主人还没给我配置大模型 API Key 呢！\n请打开大贤者控制台 (Dashboard)，在「大脑引擎」填入 API Key 唤醒我吧~"
        thought = f"【大贤者提示 - 缺少 API 密钥】\n尚未配置有效的 API Key，请在控制台设置。"
        error_type = "missing_api_key"

    # 7. 其他未知异常
    else:
        short_err = err_str[:80] + ("..." if len(err_str) > 80 else "")
        reply = f"哎呀，脑细胞好像短路了... (错误: {short_err})"
        thought = f"【大贤者诊断 - 未知异常】\n{err_str}"
        error_type = "unknown_error"

    return {
        "success": False,
        "is_error": True,
        "error_type": error_type,
        "reply": reply,
        "thought": thought,
        "emotion": emotion,
        "raw_error": err_str
    }

