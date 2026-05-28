import urllib.request
import json
import sys
import time

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

distill_url = "http://127.0.0.1:5000/api/settings/memory_distill_now"
graph_url = "http://127.0.0.1:5000/api/settings/memory_graph"

# 1. Trigger seeding
print("[1/2] Seeding test memory...")
req_data = json.dumps({"seed_test": True}).encode('utf-8')
req = urllib.request.Request(
    distill_url,
    data=req_data,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req, timeout=15) as res:
        print(f"Seeding Status: {res.getcode()}")
        result = json.loads(res.read().decode('utf-8'))
        print("Seeding Response:", json.dumps(result, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Seeding Failed: {e}")
    sys.exit(1)

# Wait 2 seconds for database sync
print("\nWaiting 2 seconds for database synchronization...")
time.sleep(2)

# 2. Get updated graph
print("\n[2/2] Fetching updated memory graph...")
try:
    with urllib.request.urlopen(graph_url, timeout=10) as res:
        print(f"Graph Status: {res.getcode()}")
        graph_data = json.loads(res.read().decode('utf-8'))
        print("Graph Nodes:")
        for node in graph_data.get("nodes", []):
            print(f" - [{node.get('type').upper()}] ID: {node.get('id')}, Label: {node.get('label')}")
        print("Graph Edges:")
        for edge in graph_data.get("edges", []):
            print(f" - Edge: {edge.get('from')} -> {edge.get('to')}")
except Exception as e:
    print(f"Fetching Graph Failed: {e}")
