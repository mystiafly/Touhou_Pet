import os
import re
import time
from datetime import datetime
from core.config_manager import get_config, save_config
from core.memory_manager import get_memory_agent, DAILY_HISTORY_DIR
from core.profile_manager import get_favorability
from core.llm_client import get_llm_client_and_model

def generate_pet_diary(date_str, log_content):
    """根据今日聊天记录，以第一人称生成专属日记"""
    try:
        client, model_name = get_llm_client_and_model()
        current_fav = get_favorability()
        config = get_config()
        char_id = config.get("character_id", "rumia")
        char_name = config.get("character_name", "桌宠")
        char_persona = config.get("priority_reminder", "")
        
        prompt = (
            f"【防截断至高指令】：你必须有始有终地完整写完这篇日记，绝对禁止在句子中途截断、断字或留下未完成的半句话！日记结尾必须以完整的标点符号完美落笔收尾。\n\n"
            f"你现在的角色设定是：\n{char_persona}\n\n"
            f"你目前对用户的好感度是 {current_fav}/100。\n"
            f"今天的日期是 {date_str}。以下是你今天和用户的对话历史记录：\n"
            f"\"\"\"\n{log_content}\n\"\"\"\n\n"
            f"【任务要求】：\n"
            f"根据上述相处对话，以你（{char_name}）的第一人称视角写一篇极其生动、符合你性格设定的「{char_name}的日记」。\n"
            f"1. 语气：必须严格符合你的角色性格设定口吻。\n"
            f"2. 篇幅：字数必须在 400 到 800 字之间，写出一天相处的起伏、你的心理动作、纠结细节和情感变化，细节描写要详尽。\n"
            f"3. 格式：第一行必须是日期与天气/心情标签，第二行开始为日记正文，推荐分段书写以方便阅读。格式示例如下：\n"
            f"   『{date_str} | 心情：[你的心情] | 天气：[符合设定的场景环境]』\n"
            f"   今天和那家伙聊天了……（正文内容）\n"
            f"4. 必须使用纯中文，严禁使用英文，不要包含任何系统标记。\n"
            f"5. 【极其重要】：在写完日记后，另起一行，必须严格以以下 JSON 格式输出两个字段：\n"
            f"   - `compressed_diary`: 提取今天日记中的核心事实（包括主人具体做了什么、桌宠和主人的互动、主人的情绪状态或新设定的习惯等），用一句话精确总结，必须包含具体名词和动作，拒绝空泛的废话，用于未来的精准记忆检索（严格控制在50字以内）。\n"
            f"   - `new_reaction`: 结合今天日记内容，为你设计的特定心情的简短“应付词”（用于用户点击你身体时的反馈对话）。\n"
            f"   ```json\n"
            f"   {{\n"
            f"     \"compressed_diary\": \"今天主人一直在工作，但我陪着他，哪怕只是发发呆也很开心。\",\n"
            f"     \"new_reaction\": {{\"emotion\": \"angry\", \"text\": \"别老戳我，小心我咬你！\"}}\n"
            f"   }}\n"
            f"   ```\n"
            f"   emotion 必须是以下五个之一：normal, angry, shy, crying, sleeping。不要输出任何其他说明文字。"
        )
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": prompt}],
            temperature=0.7,
            max_tokens=5000
        )
        
        full_content = response.choices[0].message.content.strip()
        
        # 尝试提取并保存 new_reaction 和 compressed_diary
        diary_content = full_content
        compressed_diary = f"{date_str}的记忆: 这一天过得很平淡。"
        try:
            import json, re
            json_str = ""
            full_match_str = ""
            
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', full_content, re.DOTALL | re.IGNORECASE)
            if match:
                json_str = match.group(1)
                full_match_str = match.group(0)
            else:
                match_start = re.search(r'\{\s*"(?:compressed_diary|new_reaction)"', full_content)
                if match_start:
                    start_idx = match_start.start()
                    end_idx = full_content.rfind('}')
                    if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
                        json_str = full_content[start_idx:end_idx+1]
                        full_match_str = json_str
                
            if json_str:
                data = json.loads(json_str)
                if "new_reaction" in data:
                    new_reaction = data["new_reaction"]
                    emotion = str(new_reaction.get("emotion")).lower()
                    text = new_reaction.get("text")
                    if emotion and text:
                        from core.reaction_manager import append_reaction, DEFAULT_EMOTIONS
                        if emotion not in DEFAULT_EMOTIONS:
                            # 尝试兜底修正
                            if '生气' in emotion or 'ang' in emotion: emotion = 'angry'
                            elif '哭' in emotion or 'cry' in emotion: emotion = 'crying'
                            elif '害羞' in emotion or 'shy' in emotion: emotion = 'shy'
                            elif '睡' in emotion or 'sleep' in emotion: emotion = 'sleeping'
                            else: emotion = 'normal'
                        append_reaction(char_id, emotion, text)
                        print(f"[DIARY GENERATION] 提取到新的应付词并保存: [{emotion}] {text}")
                
                if "compressed_diary" in data:
                    compressed_diary = f"{date_str}的回忆: {data['compressed_diary']}"
                    
                # 从日记正文中移除这个 JSON 块
                diary_content = full_content.replace(full_match_str, "").strip()
        except Exception as parse_ex:
            print(f"[DIARY GENERATION] 提取 JSON 失败: {parse_ex}")
            
        return diary_content, compressed_diary
    except Exception as e:
        print(f"[DIARY GENERATION] Failed to generate diary: {e}")
        return f"『{date_str} | 心情：委屈 | 天气：阴天』\n今天脑子昏昏沉沉的，什么都没写下来……", f"{date_str}的记忆: 头昏沉沉的，不记得发生了什么。"

def daily_distillation_worker():
    """自动整理之前几天的历史聊天记录，同步生成日记并写入向量数据库"""
    print("[MEMORY DISTILLER] Background distillation worker started.")
    time.sleep(3)  # 等待后台端口启动完全
    
    agent = get_memory_agent()
    if not agent:
        print("[MEMORY DISTILLER] Worker stopped. Memory agent is not initialized.")
        return
    
    try:
        config_data = get_config()
        distilled_dates = config_data.get("distilled_dates", [])
        char_id = config_data.get("character_id", "rumia")
        char_name = config_data.get("character_name", "桌宠")
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        if not os.path.exists(DAILY_HISTORY_DIR):
            print("[MEMORY DISTILLER] daily_history directory does not exist yet.")
            return
            
        log_files = os.listdir(DAILY_HISTORY_DIR)
        target_dates = []
        for f in log_files:
            if f.startswith("chat_log_") and f.endswith(".txt"):
                date_str = f.replace("chat_log_", "").replace(".txt", "")
                if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                    if date_str < today_str and date_str not in distilled_dates:
                        target_dates.append(date_str)
                        
        if not target_dates:
            print("[MEMORY DISTILLER] All previous chat logs are already distilled. Nothing to do!")
            return
            
        target_dates.sort()
        print(f"[MEMORY DISTILLER] Found {len(target_dates)} days to distill: {target_dates}")
        
        for date_str in target_dates:
            log_file_path = os.path.join(DAILY_HISTORY_DIR, f"chat_log_{date_str}.txt")
            if not os.path.exists(log_file_path):
                continue
                
            try:
                print(f"[MEMORY DISTILLER] Reading chat log for {date_str}...")
                with open(log_file_path, 'r', encoding='utf-8') as lf:
                    log_content = lf.read().strip()
                    
                if log_content:
                    
                    # Generate the diary FIRST to get a summary
                    print(f"[MEMORY DISTILLER] Generating today's diary for {char_name} ({date_str})...")
                    today_diary, compressed_diary = generate_pet_diary(date_str, log_content)
                    
                    print(f"[MEMORY DISTILLER] Saving compressed diary facts to vector db via Mem0 for {date_str}...")
                    # BYPASS Mem0's broken LLM JSON parsing by storing the compressed diary directly as a memory with infer=False
                    agent.add(
                        compressed_diary,
                        user_id="player_01",
                        metadata={"date": date_str},
                        infer=False
                    )
                    
                    diary_file_path = os.path.join(DAILY_HISTORY_DIR, f"{char_id}_diary_{date_str}.txt")
                    try:
                        with open(diary_file_path, 'w', encoding='utf-8') as df:
                            # 按照用户要求，将压缩日记放在原日记正文的下面
                            df.write(today_diary + f"\n\n---\n【记忆压缩(用于核心检索)】：\n{compressed_diary}")
                    except Exception as df_ex:
                        print(f"[MEMORY DISTILLER] Failed to save diary: {df_ex}")
                else:
                    print(f"[MEMORY DISTILLER] Log for {date_str} is empty. Skipping.")
                    
                distilled_dates.append(date_str)
                config_data["distilled_dates"] = distilled_dates
                save_config(config_data)
                
            except Exception as ex:
                print(f"[MEMORY DISTILLER] Error distilling log for {date_str}: {ex}")
                break
    except Exception as e:
        print(f"[MEMORY DISTILLER] General worker error: {e}")
