import urllib.request
import json
import sys

# Configure stdout encoding to UTF-8
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:5000/api/settings/memory_graph"
print(f"[TEST] Requesting {url} ...")
try:
    with urllib.request.urlopen(url, timeout=5) as response:
        status_code = response.getcode()
        html = response.read().decode('utf-8')
        print(f"[SUCCESS] Status code: {status_code}")
        try:
            data = json.loads(html)
            print("[SUCCESS] Decoded JSON:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except Exception as je:
            print(f"[WARNING] Could not parse JSON response: {je}")
            print("Raw response:")
            print(html)
except Exception as e:
    print(f"[FAIL] Request failed: {e}")
