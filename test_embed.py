from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv(r"g:\code\rumia\services\.env")
api_key = os.getenv("GEMINI_API_KEY")

client = OpenAI(
    api_key=api_key,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

try:
    response = client.embeddings.create(
        model="text-embedding-004",
        input="Hello world"
    )
    print("text-embedding-004 WORKED!")
except Exception as e:
    print(f"text-embedding-004 FAILED: {e}")

try:
    response = client.embeddings.create(
        model="models/text-embedding-004",
        input="Hello world"
    )
    print("models/text-embedding-004 WORKED!")
except Exception as e:
    print(f"models/text-embedding-004 FAILED: {e}")
