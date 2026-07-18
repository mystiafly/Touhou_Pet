import os
import json
import re
from core.config_manager import get_file_path, get_config
from core.llm_client import get_llm_client_and_model

SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# === [感应预设系统] ===
def get_presets_dir(): return get_file_path("presets")
def get_custom_presets_file(): return get_file_path("presets/custom_presets.json")
def get_self_talk_presets_file(): return get_file_path("presets/self_talk_presets.json")

def init_custom_presets():
    """初始化自定义感应预设的文件夹和文件，如果没有就建立并初始化"""
    presets_dir = get_presets_dir()
    custom_presets_file = get_custom_presets_file()
    self_talk_presets_file = get_self_talk_presets_file()
    
    if not os.path.exists(presets_dir):
        os.makedirs(presets_dir)
    if not os.path.exists(custom_presets_file):
        try:
            with open(custom_presets_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            print(f"[PRESETS] 已成功建立感应预设管理文件: {custom_presets_file} (目前留空)")
        except Exception as e:
            print(f"[PRESETS ERROR] 建立感应预设文件失败: {e}")
            
    if not os.path.exists(self_talk_presets_file):
        try:
            config_data = get_config()
            char_name = config_data.get("character_name", "桌宠")
            default_self_talk = {
                "greeting_suffix": f" 要求：话语简短（15字以内），体现{char_name}的性格，不要和历史记录重复。",
                "short_idle": "（现在是一段沉默的时间。请主动向我搭话。注意不要和之前说过的话重复。）",
                "medium_idle": "（我已经很久没有理你了。请用害羞或生气的傲娇口吻主动向我搭话，抱怨我冷落你，或者引起我的注意。话语要带有强烈情绪。）",
                "long_idle": "（我已经很久没有理你了。请用非常委屈或嚎啕大哭的口吻主动向我搭话，表现出极度的孤独和难过。）"
            }
            with open(self_talk_presets_file, 'w', encoding='utf-8') as f:
                json.dump(default_self_talk, f, ensure_ascii=False, indent=2)
            print(f"[PRESETS] 已成功建立自言自语预设管理文件: {self_talk_presets_file}")
        except Exception as e:
            print(f"[PRESETS ERROR] 建立自言自语预设文件失败: {e}")

# 自动执行初始化建立页面
init_custom_presets()

def check_semantic_presets(user_message, candidates):
    """使用轻量级 LLM 调用进行二次语义感应匹配判断"""
    if not candidates:
        return []
    try:
        client, model_name = get_llm_client_and_model()
        
        prompt = (
            "You are a semantic matching assistant. Your job is to determine if the user's message relates to any of the candidate topics.\n"
            f"User's message: \"{user_message}\"\n\n"
            "Candidate topics:\n"
        )
        for idx, p in enumerate(candidates):
            prim_kws = p.get("trigger_keywords", []) or p.get("key", [])
            sec_kws = p.get("secondary_keywords", []) or p.get("keysecondary", [])
            all_kws = prim_kws + sec_kws
            keywords_str = ", ".join(all_kws)
            prompt += f"- ID: {idx}, Topic Name: \"{p.get('name', p.get('comment', ''))}\", Keywords/Topic description: \"{keywords_str}\"\n"
            
        prompt += (
            "\nOutput ONLY a JSON list of IDs (integers) that are semantically related to the user's message, e.g., [0, 2]. "
            "If none are relevant, output []. Do not include any markdown code blocks, explanations, or extra text."
        )
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": prompt}],
            temperature=0.0,
            max_tokens=50
        )
        
        result_text = response.choices[0].message.content.strip()
        # 清理可能包含的 Markdown 块语法
        result_text = re.sub(r'```json\s*|```', '', result_text).strip()
        
        triggered_ids = json.loads(result_text)
        if isinstance(triggered_ids, list):
            return [int(x) for x in triggered_ids if str(x).isdigit() or isinstance(x, int)]
    except Exception as e:
        print(f"[PRESETS] 二次 AI 语义匹配失败: {e}")
    return []

def load_and_trigger_presets(user_message, favorability, is_self_talk=False):
    """加载并根据条件与关键词匹配触发相应的感应预设提示词 (混合模式：关键词直接触发 + AI二次语义感应)"""
    candidates = []
    custom_presets_file = get_custom_presets_file()
    if not os.path.exists(custom_presets_file):
        return ""
    try:
        with open(custom_presets_file, 'r', encoding='utf-8') as f:
            presets = json.load(f)
    except Exception as e:
        print(f"[PRESETS ERROR] 读取预设文件失败: {e}")
        return ""
    if not isinstance(presets, list):
        return ""

    global_presets_file = os.path.join(SERVICES_DIR, "global_presets", "global_presets.json")
    if os.path.exists(global_presets_file):
        try:
            with open(global_presets_file, 'r', encoding='utf-8') as f:
                global_presets = json.load(f)
            if isinstance(global_presets, list):
                presets.extend(global_presets)
        except Exception as e:
            print(f"[PRESETS ERROR] 读取全局预设失败: {e}")


    triggered_indices = set()
    semantic_candidates = []
    
    # 第一阶段：对所有预设进行基本筛选 (好感度过滤) 以及关键词字面匹配
    for idx, preset in enumerate(presets):
        if not isinstance(preset, dict):
            continue
            
        # 检查是否被禁用
        if preset.get("disable", False):
            continue
            
        # 检查好感度范围限制
        min_fav = preset.get("min_favorability")
        max_fav = preset.get("max_favorability")
        fav_ok = True
        if min_fav is not None:
            try:
                if favorability < int(min_fav):
                    fav_ok = False
            except:
                pass
        if max_fav is not None:
            try:
                if favorability > int(max_fav):
                    fav_ok = False
            except:
                pass
                
        if not fav_ok:
            continue  # 好感度不符，直接不考虑
            
        # 检查常驻状态 (always_active 或 constant)
        is_constant = preset.get("always_active", False) or preset.get("constant", False)
        if is_constant:
            triggered_indices.add(idx)
            print(f"[PRESETS] 常驻预设直接命中 (Constant): {preset.get('name', preset.get('comment', f'Preset-{idx}'))}")
            continue

        # 如果是自言自语模式，跳过所有非激活/非关键词匹配条目，不做处理
        if is_self_talk:
            continue

        # 检查关键词复合逻辑匹配 (AND逻辑: 主关键词 OR 命中 且 副关键词 OR 命中)
        primary_kws = preset.get("trigger_keywords", []) or preset.get("key", [])
        secondary_kws = preset.get("secondary_keywords", []) or preset.get("keysecondary", [])
        
        user_msg_lower = user_message.lower()
        
        has_primary = False
        if not primary_kws:
            has_primary = True
        else:
            for kw in primary_kws:
                if kw and isinstance(kw, str) and kw.lower() in user_msg_lower:
                    has_primary = True
                    break
                    
        has_secondary = False
        if not secondary_kws:
            has_secondary = True
        else:
            for kw in secondary_kws:
                if kw and isinstance(kw, str) and kw.lower() in user_msg_lower:
                    has_secondary = True
                    break
                    
        if has_primary and has_secondary and (primary_kws or secondary_kws):
            # 关键词命中，直接确定触发
            triggered_indices.add(idx)
            print(f"[PRESETS] 关键词(复合)直接命中，触发预设: {preset.get('name', preset.get('comment', f'Preset-{idx}'))}")
        elif (primary_kws or secondary_kws):
            # 包含关键词但没有直接字面命中，作为语义感应候选
            preset_copy = preset.copy()
            preset_copy["_original_index"] = idx
            semantic_candidates.append(preset_copy)
        else:
            # 没有关键词限制，且非 always_active。
            # 为了防止导入空关键字的世界书导致全量爆发，此处不再直接触发。
            # 如果用户希望常驻，应勾选 always_active。
            pass

    # 第二阶段：对未命中的候选进行二次 AI 语义感应 (自言自语模式下不执行语义感应)
    if not is_self_talk and semantic_candidates:
        print(f"[PRESETS] 进行二次 AI 语义感应匹配，候选数量: {len(semantic_candidates)}")
        triggered_candidate_ids = check_semantic_presets(user_message, semantic_candidates)
        for cid in triggered_candidate_ids:
            if 0 <= cid < len(semantic_candidates):
                orig_idx = semantic_candidates[cid]["_original_index"]
                triggered_indices.add(orig_idx)
                print(f"[PRESETS] 二次 AI 语义感应命中，触发预设: {presets[orig_idx].get('name', f'Preset-{orig_idx}')}")

    # 第三阶段：递归/链式触发判定
    # 如果已经触发的预设提示词内容中包含了其他未触发预设的关键词，并且好感度条件满足，则将该预设连锁触发
    max_depth = 5
    for depth in range(max_depth):
        new_triggers = False
        
        # 将当前所有已触发的预设（排除 always_active/constant，防止系统指令引发大面积交叉污染）合并为一个扫描文本池
        current_pool = ""
        for idx in triggered_indices:
            preset_obj = presets[idx]
            if not (preset_obj.get("always_active", False) or preset_obj.get("constant", False)):
                current_pool += " " + preset_obj.get("prompt", "")
        current_pool_lower = current_pool.lower()
        
        # 如果文本池为空，说明没有可以作为链式触发源的内容，直接结束递归
        if not current_pool_lower.strip():
            break
        
        for idx, preset in enumerate(presets):
            if not isinstance(preset, dict) or idx in triggered_indices:
                continue
                
            # 如果该预设被标记为“禁止递归触发”，则直接跳过
            if preset.get("prevent_recursion", False):
                continue
                
            # 同样需要校验好感度范围限制
            min_fav = preset.get("min_favorability")
            max_fav = preset.get("max_favorability")
            fav_ok = True
            if min_fav is not None:
                try:
                    if favorability < int(min_fav):
                        fav_ok = False
                except:
                    pass
            if max_fav is not None:
                try:
                    if favorability > int(max_fav):
                        fav_ok = False
                except:
                    pass
            
            if not fav_ok:
                continue
                
            # 检查关键词是否匹配当前已触发的提示词文本池 (严格遵守复合逻辑 AND)
            primary_kws = preset.get("trigger_keywords", []) or preset.get("key", [])
            secondary_kws = preset.get("secondary_keywords", []) or preset.get("keysecondary", [])
            
            has_primary = False
            if not primary_kws:
                has_primary = True
            else:
                for kw in primary_kws:
                    if kw and isinstance(kw, str) and kw.lower() in current_pool_lower:
                        has_primary = True
                        break
                        
            has_secondary = False
            if not secondary_kws:
                has_secondary = True
            else:
                for kw in secondary_kws:
                    if kw and isinstance(kw, str) and kw.lower() in current_pool_lower:
                        has_secondary = True
                        break
                        
            if has_primary and has_secondary and (primary_kws or secondary_kws):
                triggered_indices.add(idx)
                new_triggers = True
                print(f"[PRESETS] 递归链式触发命中 (深度={depth+1})，预设: {preset.get('name', preset.get('comment', f'Preset-{idx}'))}")
                        
        if not new_triggers:
            break

    # 汇总所有被触发的预设字典
    triggered_presets_list = []
    for idx in triggered_indices:
        triggered_presets_list.append(presets[idx])

    # 返回所有触发的预设字典列表，不再拼接为字符串，交由 nodes.py 根据 position 和 order 排列
    return triggered_presets_list
