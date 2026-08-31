import os
import sqlite3
import shutil
import logging

logger = logging.getLogger("CheckpointManager")

def get_checkpoint_db_path() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rumia_checkpoints.db")

def prune_and_vacuum_checkpoints(
    db_path: str = None,
    keep_threads: int = 50,
    keep_checkpoints_per_thread: int = 10,
    create_backup: bool = True
) -> dict:
    """
    Safely prunes historical checkpoints and writes in LangGraph SQLite database,
    then executes VACUUM to reclaim disk space.
    """
    if not db_path:
        db_path = get_checkpoint_db_path()
        
    if not os.path.exists(db_path):
        return {"status": "not_found", "freed_mb": 0}
        
    initial_size = os.path.getsize(db_path)
    initial_mb = initial_size / (1024 * 1024)
    
    if create_backup:
        backup_path = f"{db_path}.bak"
        try:
            shutil.copy2(db_path, backup_path)
        except Exception as e:
            logger.warning(f"Failed to create backup at {backup_path}: {e}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('checkpoints', 'writes');")
        tables = [row[0] for row in cur.fetchall()]
        
        if 'checkpoints' not in tables:
            conn.close()
            return {"status": "no_checkpoints_table", "freed_mb": 0}

        cur.execute("SELECT DISTINCT thread_id FROM checkpoints ORDER BY rowid DESC LIMIT ?", (keep_threads,))
        active_threads = [row[0] for row in cur.fetchall()]
        
        if active_threads:
            placeholders = ",".join(["?"] * len(active_threads))
            cur.execute(f"DELETE FROM checkpoints WHERE thread_id NOT IN ({placeholders})", active_threads)
            
            for thread_id in active_threads:
                cur.execute("""
                    DELETE FROM checkpoints 
                    WHERE thread_id = ? AND checkpoint_id NOT IN (
                        SELECT checkpoint_id FROM checkpoints 
                        WHERE thread_id = ? 
                        ORDER BY checkpoint_id DESC 
                        LIMIT ?
                    )
                """, (thread_id, thread_id, keep_checkpoints_per_thread))
        else:
            cur.execute("DELETE FROM checkpoints;")

        if 'writes' in tables:
            cur.execute("""
                DELETE FROM writes 
                WHERE (thread_id, checkpoint_id) NOT IN (
                    SELECT thread_id, checkpoint_id FROM checkpoints
                );
            """)

        conn.commit()
        cur.execute("VACUUM;")
        conn.commit()
    except Exception as e:
        logger.error(f"Error during checkpoint pruning: {e}")
        conn.close()
        raise e
    finally:
        conn.close()
        
    final_size = os.path.getsize(db_path)
    final_mb = final_size / (1024 * 1024)
    freed_mb = initial_mb - final_mb
    
    logger.info(f"Checkpoint DB pruned: {initial_mb:.2f} MB -> {final_mb:.2f} MB (Freed {freed_mb:.2f} MB)")
    
    return {
        "status": "success",
        "initial_mb": round(initial_mb, 2),
        "final_mb": round(final_mb, 2),
        "freed_mb": round(freed_mb, 2)
    }

def auto_maintain_checkpoints_if_needed(threshold_mb: float = 100.0):
    """
    检查并在超过阈值时自动维护修剪数据库。
    """
    db_path = get_checkpoint_db_path()
    if os.path.exists(db_path):
        size_mb = os.path.getsize(db_path) / (1024 * 1024)
        if size_mb > threshold_mb:
            return prune_and_vacuum_checkpoints(db_path, create_backup=False)
    return {"status": "skipped", "freed_mb": 0}
