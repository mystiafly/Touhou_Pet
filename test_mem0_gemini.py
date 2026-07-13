import os
from mem0 import Memory
from dotenv import load_dotenv

load_dotenv(r"g:\code\rumia\services\.env")
gemini_key = os.getenv("GEMINI_API_KEY")

config = {
    "embedder": {
        "provider": "gemini",
        "config": {
            "api_key": gemini_key,
            "model": "models/text-embedding-004"
        }
    }
}

try:
    m = Memory.from_config(config)
    m.add("hello world", user_id="test")
    print("Gemini mem0 provider WORKED!")
except Exception as e:
    print(f"Gemini mem0 provider FAILED: {e}")
