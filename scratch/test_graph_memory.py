import sys
import os

# Reconfigure stdout for Windows Chinese/Emoji support
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure we can load modules from services
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))

print("[TEST] Verifying spacy loading...")
try:
    from mem0.utils.spacy_models import get_nlp_full
    nlp = get_nlp_full()
    if nlp is not None:
        print(f"[SUCCESS] Loaded spaCy model: {nlp.meta.get('name')} (Version: {nlp.meta.get('version')})")
        
        # Test extraction
        from mem0.utils.entity_extraction import extract_entities
        text = "用户今天过生日，最喜欢吃巧克力饼干和红茶。"
        entities = extract_entities(text)
        print(f"[SUCCESS] Extracted Chinese entities: {entities}")
    else:
        print("[FAIL] nlp model is None!")
except Exception as e:
    print(f"[ERROR] spaCy load verification failed: {e}")
