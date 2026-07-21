import os
from openai import OpenAI
from langchain_openai import ChatOpenAI
from core.config_manager import get_config, get_custom_engines

def get_llm_client_and_model(provider_override: str = None):
    """根据配置动态获取大模型客户端和模型名称"""
    config_data = get_config()
    provider = provider_override if provider_override and provider_override != "inherit" else config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini"))
    provider = provider.lower()
    
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    # Check custom engine
    if provider.startswith("custom_"):
        custom_engines = get_custom_engines()
        for engine in custom_engines:
            if engine.get("id") == provider:
                api_key = engine.get("api_key", "sk-local")
                if not api_key:
                    api_key = "sk-local"
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

def get_langchain_model(provider_override: str = None):
    """根据配置动态获取 LangChain ChatModel 包装实例"""
    config_data = get_config()
    provider = provider_override if provider_override and provider_override != "inherit" else config_data.get("api_provider", os.getenv("API_PROVIDER", "gemini"))
    provider = provider.lower()
    
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    api_key = None
    base_url = None
    model_name = None
    
    # Check custom engine
    if provider.startswith("custom_"):
        custom_engines = get_custom_engines()
        for engine in custom_engines:
            if engine.get("id") == provider:
                api_key = engine.get("api_key", "sk-local")
                if not api_key:
                    api_key = "sk-local"
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
        temperature=0.7
    )
