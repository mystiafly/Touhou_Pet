import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

# Load .env
load_dotenv()

def test_gemini():
    print("\n--- Testing Gemini API ---")
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        print("[FAIL] GEMINI_API_KEY is not set.")
        return
        
    try:
        client = OpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        response = client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        print(f"[SUCCESS] Gemini response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"[FAIL] Gemini failed: {type(e).__name__}: {e}")

def test_deepseek(model_name):
    print(f"\n--- Testing DeepSeek API with model '{model_name}' ---")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if not deepseek_key:
        print("[FAIL] DEEPSEEK_API_KEY is not set.")
        return
        
    try:
        client = OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com"
        )
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        print(f"[SUCCESS] DeepSeek response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"[FAIL] DeepSeek failed: {type(e).__name__}: {e}")

if __name__ == '__main__':
    # Set console encoding to UTF-8 on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8')
    test_gemini()
    test_deepseek("deepseek-v4-flash")
    test_deepseek("deepseek-v4-pro")
    test_deepseek("deepseek-chat")
