import sqlite3
import os
import time
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'usage_stats.db')
PING_TIMEOUT_SECONDS = 180  # 3 minutes

class StatsManager:
    def __init__(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self.init_db()

    def init_db(self):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    character TEXT NOT NULL,
                    start_time INTEGER NOT NULL,
                    last_ping_time INTEGER NOT NULL,
                    duration INTEGER NOT NULL DEFAULT 0
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS dialogs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    character TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )
            ''')
            conn.commit()

    def ping(self, character: str):
        """Handle a heartbeat ping from the frontend. Updates active session or creates a new one."""
        now = int(time.time())
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Find the most recent session for this character
            cursor.execute('''
                SELECT id, start_time, last_ping_time 
                FROM sessions 
                WHERE character = ? 
                ORDER BY last_ping_time DESC LIMIT 1
            ''', (character,))
            row = cursor.fetchone()

            if row:
                session_id, start_time, last_ping_time = row
                # If the last ping was within the timeout window, extend the session
                if now - last_ping_time <= PING_TIMEOUT_SECONDS:
                    duration = now - start_time
                    cursor.execute('''
                        UPDATE sessions 
                        SET last_ping_time = ?, duration = ? 
                        WHERE id = ?
                    ''', (now, duration, session_id))
                    conn.commit()
                    return

            # Otherwise, create a new session
            cursor.execute('''
                INSERT INTO sessions (character, start_time, last_ping_time, duration) 
                VALUES (?, ?, ?, 0)
            ''', (character, now, now))
            conn.commit()

    def log_dialog(self, character: str):
        """Log a dialog interaction."""
        now = int(time.time())
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO dialogs (character, timestamp) 
                VALUES (?, ?)
            ''', (character, now))
            conn.commit()

    def get_dashboard_stats(self):
        """Retrieve aggregated statistics for the dashboard."""
        stats = {
            "total_time": 0,
            "character_time": {},
            "weekly_usage": {"labels": [], "data": []},
            "daily_dialogs": {"labels": [], "data": []},
            "recent_activity": []
        }
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # 1. Total Time and Time per Character
            cursor.execute('SELECT character, SUM(duration) FROM sessions GROUP BY character')
            total_duration = 0
            for char, duration in cursor.fetchall():
                stats["character_time"][char] = duration
                total_duration += duration
            stats["total_time"] = total_duration

            # 2. Weekly Usage (Last 7 days)
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            for i in range(6, -1, -1):
                day = today - timedelta(days=i)
                day_start = int(day.timestamp())
                day_end = int((day + timedelta(days=1)).timestamp())
                
                cursor.execute('''
                    SELECT SUM(duration) FROM sessions 
                    WHERE last_ping_time >= ? AND last_ping_time < ?
                ''', (day_start, day_end))
                val = cursor.fetchone()[0] or 0
                stats["weekly_usage"]["labels"].append(day.strftime("%m-%d"))
                stats["weekly_usage"]["data"].append(round(val / 60, 2)) # in minutes
                
                cursor.execute('''
                    SELECT COUNT(*) FROM dialogs 
                    WHERE timestamp >= ? AND timestamp < ?
                ''', (day_start, day_end))
                d_val = cursor.fetchone()[0] or 0
                stats["daily_dialogs"]["labels"].append(day.strftime("%m-%d"))
                stats["daily_dialogs"]["data"].append(d_val)
                
            # 3. Recent Activity (Daily Open/Close for last 7 days)
            cursor.execute('''
                SELECT date(start_time, 'unixepoch', 'localtime') as d, 
                       MIN(start_time), MAX(last_ping_time)
                FROM sessions
                GROUP BY d
                ORDER BY d DESC LIMIT 7
            ''')
            for row in cursor.fetchall():
                d, start_ts, end_ts = row
                stats["recent_activity"].append({
                    "date": d,
                    "open_time": datetime.fromtimestamp(start_ts).strftime("%H:%M:%S"),
                    "close_time": datetime.fromtimestamp(end_ts).strftime("%H:%M:%S")
                })
                
            # 4. Character Colors
            import json
            stats["character_colors"] = {}
            chars_dir = os.path.join(os.path.dirname(DB_PATH), "..", "services", "characters")
            if os.path.exists(chars_dir):
                for item in os.listdir(chars_dir):
                    config_path = os.path.join(chars_dir, item, "config.json")
                    if os.path.exists(config_path):
                        try:
                            with open(config_path, 'r', encoding='utf-8') as f:
                                conf = json.load(f)
                                theme = conf.get("theme_color")
                                if theme:
                                    stats["character_colors"][item] = theme
                        except Exception:
                            pass
                            
        return stats

stats_manager = StatsManager()
