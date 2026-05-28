import urllib.request
import json
import sys

# Reconfigure stdout for Windows Chinese/Emoji support
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

chat_url = "http://127.0.0.1:5000/api/chat"
speak_url = "http://127.0.0.1:5000/api/rumia_speak"

def test_chat_memory():
    print("==================================================")
    print("[TEST 1/2] Verifying Chat Memory Recall (P0 Reminder)")
    print("==================================================")
    
    # We ask a question about user preferences to test if injected memory is active
    post_data = json.dumps({"message": "你知道我最喜欢喝什么、吃什么吗？"}).encode('utf-8')
    req = urllib.request.Request(
        chat_url,
        data=post_data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            status = response.getcode()
            result = json.loads(response.read().decode('utf-8'))
            print(f"[SUCCESS] HTTP Status: {status}")
            print(f"[SUCCESS] Rumia Reply: {result.get('reply')}")
            print(f"[SUCCESS] Mood: {result.get('emotion')}, Fav score: {result.get('favorability')} ({result.get('fav_change'):+d})")
            
            reply_text = result.get('reply', '')
            if '巧克力' in reply_text or '红茶' in reply_text:
                print("\n🎉 [VERIFICATION PASSED] Rumia correctly remembered user's favorites from the P0 Memory injection!")
            else:
                print("\n⚠️ [VERIFICATION FAILED] Memory keywords ('巧克力' or '红茶') were not found in Rumia's reply.")
    except Exception as e:
        print(f"[FAIL] Chat request failed: {e}")

def test_active_speak():
    print("\n==================================================")
    print("[TEST 2/2] Verifying Active Speak (P0 Context)")
    print("==================================================")
    
    # Trigger auto speak after a period of silence (count = 1)
    post_data = json.dumps({"type": "auto", "count": 1}).encode('utf-8')
    req = urllib.request.Request(
        speak_url,
        data=post_data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            status = response.getcode()
            result = json.loads(response.read().decode('utf-8'))
            print(f"[SUCCESS] HTTP Status: {status}")
            print(f"[SUCCESS] Rumia Active Speak: {result.get('reply')}")
            print(f"[SUCCESS] Mood: {result.get('emotion')}")
            print("\n🎉 [VERIFICATION COMPLETED] Active speak trigger tested successfully!")
    except Exception as e:
        print(f"[FAIL] Active speak request failed: {e}")

if __name__ == '__main__':
    print("🚀 Starting Rumia Attention Priority (方案 A) E2E Tests...\n")
    test_chat_memory()
    test_active_speak()
