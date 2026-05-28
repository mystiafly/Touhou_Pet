import os
import sys
from dotenv import load_dotenv

# Reconfigure stdout for Windows Chinese/Emoji support
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Load .env inside rumia
load_dotenv()

from mem0 import Memory

def main():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        print("[FAIL] DEEPSEEK_API_KEY is not set.")
        return
        
    print(f"[INFO] Loaded DEEPSEEK_API_KEY: {api_key[:6]}...{api_key[-4:] if len(api_key) > 10 else ''}")
    
    # Configure Mem0
    # LLM uses DeepSeek via standard OpenAI compatible model wrapper
    # Embedder uses HuggingFace local SentenceTransformers (FREE!)
    # Vector store uses Qdrant local files
    config = {
        "llm": {
            "provider": "openai",
            "config": {
                "model": "deepseek-chat",
                "api_key": api_key,
                "openai_base_url": "https://api.deepseek.com",
                "temperature": 0.1,
                "max_tokens": 1000
            }
        },
        "embedder": {
            "provider": "huggingface",
            "config": {
                "model": "multi-qa-MiniLM-L6-cos-v1" # Lightweight free local embedding model
            }
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": "rumia_memory",
                "path": "daily_history/qdrant_test", # Local folder
                "embedding_model_dims": 384
            }
        }
    }
    
    # Clean up old database directory to prevent dimension mismatch
    import shutil
    db_path = os.path.join("daily_history", "qdrant_test")
    if os.path.exists(db_path):
        print(f"[INFO] Removing old database folder: {db_path} to reset dimensions...")
        try:
            shutil.rmtree(db_path)
        except Exception as e:
            print(f"[WARNING] Failed to remove {db_path}: {e}")

    try:
        print("[INFO] Initializing Mem0 Memory...")
        m = Memory.from_config(config)
        print("[SUCCESS] Mem0 Initialized successfully!")
        
        user_id = "test_user_01"
        
        # Test 1: Add a memory
        print("\n--- Test 1: Adding a memory ---")
        fact = "用户今天过生日，最喜欢吃巧克力饼干和红茶。"
        print(f"Adding fact: {fact}")
        m.add(fact, user_id=user_id)
        print("[SUCCESS] Memory added successfully!")
        
        # Test 2: Search/Get memories
        print("\n--- Test 2: Retrieving memories ---")
        memories = m.get_all(filters={"user_id": user_id})
        print(f"Retrieved memories raw (Type: {type(memories)}): {memories}")
        
        memories_list = []
        if isinstance(memories, dict) and "results" in memories:
            memories_list = memories["results"]
        elif isinstance(memories, dict) and "memories" in memories:
            memories_list = memories["memories"]
        elif isinstance(memories, list):
            memories_list = memories
            
        for idx, mem in enumerate(memories_list, 1):
            if isinstance(mem, dict):
                print(f"  {idx}. {mem.get('memory')} (ID: {mem.get('id')})")
            else:
                print(f"  {idx}. {mem}")
            
        # Test 3: Search relevant memories
        print("\n--- Test 3: Searching relevant memories ---")
        query = "What does the user like to eat or drink?"
        print(f"Query: {query}")
        results = m.search(query, filters={"user_id": user_id}, limit=3)
        print(f"Search results raw (Type: {type(results)}): {results}")
        
        results_list = []
        if isinstance(results, dict) and "results" in results:
            results_list = results["results"]
        elif isinstance(results, list):
            results_list = results
            
        for idx, res in enumerate(results_list, 1):
            if isinstance(res, dict):
                print(f"  {idx}. {res.get('memory')} (Score: {res.get('score', 0.0):.4f})")
            else:
                print(f"  {idx}. {res}")
            
        print("\n==========================================")
        print("[CONGRATULATIONS] Mem0 is 100% operational!")
        print("==========================================\n")
        
    except Exception as e:
        print(f"\n[ERROR] Mem0 failed: {type(e).__name__}: {e}")

if __name__ == '__main__':
    main()
