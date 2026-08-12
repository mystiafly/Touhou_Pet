import os
import sys

# Ensure HuggingFace mirror and offline environment variables
os.environ["HF_ENDPOINT"] = os.getenv("HF_ENDPOINT", "https://hf-mirror.com")
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SERVICES_DIR)

from mem0 import Memory

def seed_lily_personality():
    lily_db_path = os.path.join(SERVICES_DIR, "characters", "lily", "qdrant_db")
    os.makedirs(lily_db_path, exist_ok=True)
    
    # Configuration matching services/core/memory_manager.py
    mem0_config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "path": lily_db_path,
                "collection_name": "lily_memory_gemini_v2",
                "embedding_model_dims": 384
            }
        },
        "embedder": {
            "provider": "huggingface",
            "config": {
                "model": "sentence-transformers/all-MiniLM-L6-v2"
            }
        },
        "version": "v1.1"
    }

    # If GEMINI_API_KEY or DEEPSEEK_API_KEY is available, set LLM for mem0 extraction
    gemini_key = os.getenv("GEMINI_API_KEY")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if gemini_key:
        mem0_config["llm"] = {
            "provider": "openai",
            "config": {
                "api_key": gemini_key,
                "model": "gemini-2.5-flash",
                "openai_base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"
            }
        }
    elif deepseek_key:
        mem0_config["llm"] = {
            "provider": "openai",
            "config": {
                "api_key": deepseek_key,
                "model": "deepseek-chat",
                "openai_base_url": "https://api.deepseek.com"
            }
        }

    print(f"[LILY SEED] Initializing Mem0 for Lily White at path: {lily_db_path}", flush=True)
    memory = Memory.from_config(mem0_config)

    # Seed facts for Lily White
    seed_facts = [
        "莉莉白是宣告春天的妖精，性格开朗活泼，平时最喜欢在大自然里报春。",
        "莉莉白最喜欢弹奏手风琴，与妖精朋友大妖精和琪露诺一起在森林中迎接春风。",
        "莉莉白每次看到春天的花朵绽放，就会兴奋地挥舞翅膀宣布‘春天来了！’。",
        "莉莉白很喜欢和主人一起在露天花圃散步，享受温暖的阳光和红茶。"
    ]

    print("[LILY SEED] Seeding Lily White personality memory nodes...", flush=True)
    for idx, fact in enumerate(seed_facts, 1):
        print(f"  [{idx}/{len(seed_facts)}] Adding: {fact}", flush=True)
        memory.add(
            fact,
            user_id="player_01",
            metadata={"date": "2026-08-11", "character": "lily", "type": "personality_sea_seed"},
            infer=False
        )

    print("\n[LILY SEED] Fetching all memory nodes for Lily White...", flush=True)
    all_memories = memory.get_all(user_id="player_01")
    print(f"[LILY SEED] Total memory nodes in Lily White's Personality Sea: {len(all_memories.get('results', [])) if isinstance(all_memories, dict) else len(all_memories)}", flush=True)
    
    m_list = all_memories.get('results', []) if isinstance(all_memories, dict) else all_memories
    for m in m_list:
        if isinstance(m, dict):
            print(f"  - Node ID: {m.get('id')} | Content: {m.get('memory')}", flush=True)

if __name__ == "__main__":
    seed_personality_sea = seed_lily_personality()
