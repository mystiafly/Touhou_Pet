# scratch/test_diary_generation.py
import sys
import os

# Ensure the root folder and services folder are in python path
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_path)
sys.path.append(os.path.join(root_path, 'services'))

# Change working directory to services to align with running environment
os.chdir(os.path.join(root_path, 'services'))

from services.web_interface import app, DAILY_HISTORY_DIR
import json

def test_diary_endpoints():
    print("Initializing Flask test client...")
    client = app.test_client()

    test_date = "2026-05-28"
    log_file = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{test_date}.txt")
    diary_file = os.path.join(DAILY_HISTORY_DIR, f"rumia_diary_{test_date}.txt")

    print(f"Creating a mock chat log file for {test_date} at {log_file}...")
    # Ensure directory exists
    os.makedirs(DAILY_HISTORY_DIR, exist_ok=True)
    
    # Save original content if files already exist to prevent corruption
    original_log = None
    if os.path.exists(log_file):
        with open(log_file, 'r', encoding='utf-8') as f:
            original_log = f.read()
            
    original_diary = None
    if os.path.exists(diary_file):
        with open(diary_file, 'r', encoding='utf-8') as f:
            original_diary = f.read()
        os.remove(diary_file) # Remove it so we can test the on-the-fly generation

    try:
        mock_chat = (
            "[10:00:00] 用户: 露米娅，你今天真可爱！\n"
            "[10:00:15] 露米娅(shy): 哼，说什么呢！别以为夸我我就会对你客气！不过……其实我也有点高兴就是了……\n"
        )
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(mock_chat)

        print("Triggering the logs API endpoint `/api/settings/logs/2026-05-28`...")
        response = client.get(f'/api/settings/logs/{test_date}')
        assert response.status_code == 200, f"Status code is {response.status_code}"
        
        data = json.loads(response.data.decode('utf-8'))
        print("\nAPI Response:")
        print(json.dumps(data, indent=2, ensure_ascii=False))

        assert data["success"] is True, "Success should be True"
        assert data["date"] == test_date, f"Date should be {test_date}"
        assert data["chat_content"].strip() == mock_chat.strip(), "Chat content does not match"
        assert "diary_content" in data, "Diary content key should be in response"
        assert len(data["diary_content"]) > 0, "Diary content should not be empty"
        
        print("\n[SUCCESS] Diary generation and separate sub-tabs backend integration validated successfully!")
        
    finally:
        # Restore original files
        if original_log is not None:
            with open(log_file, 'w', encoding='utf-8') as f:
                f.write(original_log)
        else:
            if os.path.exists(log_file):
                os.remove(log_file)
                
        if original_diary is not None:
            with open(diary_file, 'w', encoding='utf-8') as f:
                f.write(original_diary)
        else:
            if os.path.exists(diary_file):
                os.remove(diary_file)

if __name__ == '__main__':
    test_diary_endpoints()
