import threading
import time
from typing import List, Dict

# Global event queue
_event_queue: List[Dict] = []
_queue_lock = threading.Lock()

def add_event(event_type: str, data: Dict):
    with _queue_lock:
        _event_queue.append({
            "type": event_type,
            "data": data,
            "timestamp": time.time()
        })

def pop_event() -> Dict:
    with _queue_lock:
        if _event_queue:
            return _event_queue.pop(0)
        return None

def schedule_timer(minutes: int, memo: str):
    """
    Schedules a timer. When it expires, it adds a timer event to the queue.
    """
    def timer_callback():
        add_event("timer_alert", {"memo": memo})
        print(f"[Timer] Timer finished! Added event for memo: {memo}")
        with open("timer_debug.log", "a", encoding="utf-8") as f:
            f.write(f"[{time.time()}] Timer finished! Added event for memo: {memo}\n")

    # For safety, cap at 120 minutes
    if minutes > 120:
        minutes = 120
    elif minutes <= 0:
        minutes = 1

    seconds = minutes * 60
    print(f"[Timer] Scheduled timer for {minutes} minutes (Memo: {memo})")
    with open("timer_debug.log", "a", encoding="utf-8") as f:
        f.write(f"[{time.time()}] Scheduled timer for {minutes} minutes (Memo: {memo})\n")
    
    t = threading.Timer(seconds, timer_callback)
    t.daemon = True
    t.start()
