import os
import json
import threading
from core.llm_client import get_llm_client_and_model
from core.config_manager import get_config

REACTIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "characters")
DEFAULT_EMOTIONS = ["normal", "angry", "crying", "shy", "sleeping"]

def get_reactions_file(char_id):
    char_dir = os.path.join(REACTIONS_DIR, char_id)
    if not os.path.exists(char_dir):
        os.makedirs(char_dir, exist_ok=True)
    return os.path.join(char_dir, "reactions.json")

def load_reactions(char_id):
    file_path = get_reactions_file(char_id)
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[REACTION] Failed to load reactions: {e}")
    return None

def save_reactions(char_id, data):
    file_path = get_reactions_file(char_id)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[REACTION] Failed to save reactions: {e}")

def append_reaction(char_id, emotion, text):
    data = load_reactions(char_id) or {e: [] for e in DEFAULT_EMOTIONS}
    if emotion not in data:
        data[emotion] = []
    
    # Avoid duplicates
    if text not in data[emotion]:
        data[emotion].append(text)
        # Keep maximum size to prevent infinite growth (e.g. max 50 per emotion)
        if len(data[emotion]) > 50:
            data[emotion].pop(0)
        save_reactions(char_id, data)

def generate_initial_reactions(char_id):
    """Generate the initial 5x5 reaction library using LLM"""
    client, model_name = get_llm_client_and_model()
    config = get_config()
    char_name = config.get("character_name", "桌宠")
    char_persona = config.get("priority_reminder", "")
    
    prompt = (
        f"你现在的角色设定是：\n{char_persona}\n\n"
        f"请为你自己（{char_name}）生成一套用于桌面宠物互动的“被点击反应短句库”。\n"
        f"当用户用鼠标点击你时，你会随机说出这些短句。\n"
        f"必须为以下5种心情各生成5句短句，语气必须极度符合你的人设，口语化，自然，字数尽量短（10字以内最佳）：\n"
        f"1. normal (正常状态，例如：“怎么啦？”、“别戳啦”)\n"
        f"2. angry (生气状态，例如：“别烦我！”、“走开！”)\n"
        f"3. crying (委屈/哭泣状态，例如：“呜呜...干嘛欺负我...”、“好痛...”)\n"
        f"4. shy (害羞状态，例如：“哎呀，别这样...”、“不要盯着我看啦...”)\n"
        f"5. sleeping (睡觉状态，例如：“呼...Zzz”、“好困...别吵...”)\n\n"
        f"请严格返回一段合法的 JSON，不要输出任何其他说明文字，格式如下：\n"
        f"{{\n"
        f"  \"normal\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"angry\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"crying\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"shy\": [\"...\", \"...\", \"...\", \"...\", \"...\"],\n"
        f"  \"sleeping\": [\"...\", \"...\", \"...\", \"...\", \"...\"]\n"
        f"}}"
    )
    
    try:
        print(f"[REACTION] 正在为 {char_id} 初始生成 5x5 词库...")
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=2000
        )
        content = response.choices[0].message.content.strip()
        # Parse JSON
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            # Validate format
            for e in DEFAULT_EMOTIONS:
                if e not in data:
                    data[e] = ["..."]
            save_reactions(char_id, data)
            print(f"[REACTION] 初始 5x5 词库生成完毕并保存。")
            return data
    except Exception as e:
        print(f"[REACTION] 生成初始词库失败: {e}")
    
    return None

def trigger_initial_generation_async(char_id):
    def worker():
        generate_initial_reactions(char_id)
    t = threading.Thread(target=worker)
    t.daemon = True
    t.start()
