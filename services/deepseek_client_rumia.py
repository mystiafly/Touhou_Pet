import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# [新增] 加载 .env
# 同样寻找上一级目录的 .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# === 配置 ===
api_key = os.getenv("DEEPSEEK_API_KEY") # [修改]
if not api_key:
    print("❌ 错误：未找到 DEEPSEEK_API_KEY，请检查 .env 文件")
    # 可以选择在这里 exit() 或者抛出异常

HISTORY_FILE = "dialog_history.json"
MAX_HISTORY_ROUNDS = 20000

client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
# ========== 核心函数：加载与保存历史 ==========
def load_history():
    """从文件加载对话历史，如果文件不存在则初始化新的历史。"""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"警告：读取历史文件失败，将创建新历史。错误：{e}")
    # 初始历史：系统设定 + 开场白（可选）
    return [
        {"role": "system", "content": "你是东方Project中的露米娅，一个喜欢在黑暗中恶作剧的食人妖怪，说话带有天真的邪恶感。记住我们的所有对话。"}
    ]

def save_history(messages):
    """将对话历史保存到文件。"""
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)  # indent使文件可读
    except IOError as e:
        print(f"警告：保存历史文件失败。错误：{e}")

def trim_history(messages, max_rounds):
    """修剪历史，只保留最近N轮对话（保留系统消息）。"""
    # 系统消息总是保留
    system_message = messages[0]
    # 其余为对话历史，每2条（user+assistant）为一轮
    dialogue = messages[1:]
    if len(dialogue) > max_rounds * 2:
        dialogue = dialogue[-(max_rounds * 2):]  # 只保留最后N轮
    return [system_message] + dialogue


# ========== 主程序 ==========
def main():
    messages = load_history()
    print(f"历史加载完成，已有 {len(messages)-1} 条对话记录。")
    print("输入内容开始对话，输入 '退出'、'clear' 或 'reset' 可执行相应操作。")

    while True:
        try:
            user_input = input("\n你说：").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n程序中断。")
            break

        # 处理特殊命令
        if user_input.lower() in ['退出', 'exit', 'quit', 'q']:
            print("露米娅：下次再一起玩吧～")
            break
        elif user_input.lower() in ['clear', 'reset', '清除']:
            # 重置为仅包含系统消息的初始状态
            messages = [messages[0]]
            save_history(messages)
            print("对话历史已清除。")
            continue
        elif not user_input:
            continue  # 忽略空输入

        # 1. 添加用户消息
        messages.append({"role": "user", "content": user_input})

        # 2. 调用API
        try:
            response = client.chat.completions.create(
                model="deepseek-reasoner",
                messages=messages,
                stream=False
            )
            ai_reply = response.choices[0].message.content
            print(f"露米娅：{ai_reply}")

            # 3. 添加AI回复
            messages.append({"role": "assistant", "content": ai_reply})

            # 4. 修剪历史并保存
            messages = trim_history(messages, MAX_HISTORY_ROUNDS)
            save_history(messages)

        except Exception as e:
            print(f"出错：{e}")
            # 移除最后一条（失败的用户消息），避免中断影响下一轮
            if messages and messages[-1]["role"] == "user":
                messages.pop()

    # 循环结束后保存最终状态（修剪后）
    save_history(trim_history(messages, MAX_HISTORY_ROUNDS))
    print("对话历史已保存。")

if __name__ == "__main__":
    main()
