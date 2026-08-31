import os
import json
import time
import threading
import shutil
import zipfile
import base64
import requests
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Request, Body, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from core.config_manager import get_config, save_config, get_active_character_id, GLOBAL_CONFIG_FILE
from core.databank_manager import load_databank, save_databank_state_sheet, save_databank_template_raw, get_databank_paths
from tools.presets_manager import get_self_talk_presets_file
from api.routers.common import safe_recycle_delete, find_live2d_model_file, ensure_live2d_pose_configured

router = APIRouter()
SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT_DIR = os.path.dirname(SERVICES_DIR)

@router.get("/api/databank")
def get_databank():
    """获取当前角色的动态数据库(DataBank)状态"""
    databank = load_databank()
    if databank is None:
        return {"status": "error", "message": "当前角色未配置 DataBank 模板"}
    return {"status": "success", "data": databank}

@router.get("/api/databank/template")
def get_databank_template():
    """获取当前角色的原始 DataBank 模板 JSON"""
    template_path, _ = get_databank_paths()
    if not template_path or not os.path.exists(template_path):
        return {"status": "error", "message": "当前角色无 DataBank 模板"}
    with open(template_path, 'r', encoding='utf-8') as f:
        return {"status": "success", "data": f.read()}

@router.post("/api/databank/update_content")
def update_databank_content(payload: dict = Body(...)):
    sheet_id = payload.get("sheet_id")
    content = payload.get("content")
    if not sheet_id or content is None:
        return {"status": "error", "message": "参数错误"}
    success, msg = save_databank_state_sheet(sheet_id, content)
    return {"status": "success" if success else "error", "message": msg}

@router.post("/api/databank/update_template")
def update_databank_template(payload: dict = Body(...)):
    raw_json = payload.get("raw_json")
    if not raw_json:
        return {"status": "error", "message": "JSON内容为空"}
    success, msg = save_databank_template_raw(raw_json)
    return {"status": "success" if success else "error", "message": msg}


@router.get("/api/characters/list")
async def api_characters_list():
    import os, json
    from core.config_manager import SERVICES_DIR, get_active_character_id
    active_char = get_active_character_id()
    chars_dir = os.path.join(SERVICES_DIR, "characters")
    result = []
    if os.path.exists(chars_dir):
        for item in os.listdir(chars_dir):
            char_path = os.path.join(chars_dir, item)
            config_path = os.path.join(char_path, "config.json")
            if os.path.isdir(char_path) and os.path.exists(config_path):
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        conf = json.load(f)
                        result.append({
                            "character_id": conf.get("character_id", item),
                            "character_name": conf.get("character_name", item),
                            "persona_prompt": conf.get("persona_prompt", ""),
                            "theme_color": conf.get("theme_color", ""),
                            "avatar_url": f"/api/characters/{item}/avatar",
                            "is_active": (item == active_char)
                        })
                except Exception:
                    pass
    return JSONResponse({"status": "success", "active_character": active_char, "characters": result})

@router.get("/api/characters/{char_id}/avatar")
async def api_get_character_avatar(char_id: str):
    import os
    from core.config_manager import SERVICES_DIR
    
    # 1. 检查是否存在自定义 avatar
    for ext in ["png", "jpg", "jpeg", "webp"]:
        av_path = os.path.join(SERVICES_DIR, "characters", char_id, f"avatar.{ext}")
        if os.path.exists(av_path):
            media = "image/png" if ext == "png" else f"image/{ext}"
            return FileResponse(av_path, media_type=media, headers={"Cache-Control": "no-cache, max-age=0"})
            
    # 2. 检查是否有 normal.png 静态立绘作为次级备用
    normal_sprite = os.path.join(SERVICES_DIR, "characters", char_id, "assets", "main_sprites", "normal.png")
    if os.path.exists(normal_sprite):
        return FileResponse(normal_sprite, media_type="image/png", headers={"Cache-Control": "no-cache, max-age=0"})
        
    # 3. 回退为默认机器人 SVG 头像
    default_svg = os.path.join(SERVICES_DIR, "static", "images", "default_robot_avatar.svg")
    if os.path.exists(default_svg):
        return FileResponse(default_svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})
        
    return JSONResponse({"status": "error", "message": "Avatar not found"}, status_code=404)

@router.post("/api/characters/{char_id}/avatar")
async def api_upload_character_avatar(char_id: str, file: UploadFile = File(...)):
    import os, time
    from core.config_manager import SERVICES_DIR
    
    char_dir = os.path.join(SERVICES_DIR, "characters", char_id)
    if not os.path.exists(char_dir):
        return JSONResponse({"status": "error", "message": f"角色 {char_id} 不存在"}, status_code=404)
        
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        return JSONResponse({"status": "error", "message": "图片大小不能超过 10MB"}, status_code=400)
        
    save_path = os.path.join(char_dir, "avatar.png")
    try:
        # 如果有 PIL，尝试居中正方形裁剪并压缩为 512x512 PNG
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(contents))
            img = img.convert("RGBA")
            w, h = img.size
            min_dim = min(w, h)
            left = (w - min_dim) / 2
            top = (h - min_dim) / 2
            right = (w + min_dim) / 2
            bottom = (h + min_dim) / 2
            img = img.crop((left, top, right, bottom))
            img.thumbnail((512, 512), Image.Resampling.LANCZOS)
            img.save(save_path, "PNG", optimize=True)
        except Exception:
            with open(save_path, "wb") as f:
                f.write(contents)
                
        return JSONResponse({
            "status": "success",
            "message": "头像上传成功！",
            "avatar_url": f"/api/characters/{char_id}/avatar?t={int(time.time()*1000)}"
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"保存头像失败: {str(e)}"}, status_code=500)

@router.delete("/api/characters/{char_id}/avatar")
async def api_delete_character_avatar(char_id: str):
    import os, time
    from core.config_manager import SERVICES_DIR
    
    char_dir = os.path.join(SERVICES_DIR, "characters", char_id)
    if not os.path.exists(char_dir):
        return JSONResponse({"status": "error", "message": f"角色 {char_id} 不存在"}, status_code=404)
        
    for ext in ["png", "jpg", "jpeg", "webp"]:
        p = os.path.join(char_dir, f"avatar.{ext}")
        if os.path.exists(p):
            safe_recycle_delete(p)
            
    return JSONResponse({
        "status": "success",
        "message": "已恢复默认头像！",
        "avatar_url": f"/api/characters/{char_id}/avatar?t={int(time.time()*1000)}"
    })

class BatchDeleteRequest(BaseModel):
    character_ids: List[str]

@router.post("/api/characters/batch_delete")
async def api_characters_batch_delete(req: BatchDeleteRequest):
    import os
    from core.config_manager import SERVICES_DIR, USER_DATA_DIR, get_active_character_id
    
    active_char = get_active_character_id()
    deleted = []
    skipped = []
    
    for cid in req.character_ids:
        cid = cid.strip().lower()
        if not cid:
            continue
        if cid == "rumia":
            skipped.append({"id": cid, "reason": "基础角色(露米娅)受系统保护无法删除"})
            continue
        if cid == active_char:
            skipped.append({"id": cid, "reason": "当前正在活跃运行的灵魂无法删除，请先切换为其他角色"})
            continue
            
        char_dir = os.path.join(SERVICES_DIR, "characters", cid)
        data_char_dir = os.path.join(USER_DATA_DIR, "data", "characters", cid)
        
        ok = True
        if os.path.exists(char_dir):
            if not safe_recycle_delete(char_dir):
                ok = False
        if os.path.exists(data_char_dir):
            safe_recycle_delete(data_char_dir)
            
        if ok:
            deleted.append(cid)
        else:
            skipped.append({"id": cid, "reason": "删除失败(文件可能被系统占用)"})
            
    return JSONResponse({
        "status": "success",
        "deleted": deleted,
        "skipped": skipped,
        "message": f"成功将 {len(deleted)} 个角色移至回收站！" + (f" (跳过 {len(skipped)} 个)" if skipped else "")
    })

class CharacterGenRequest(BaseModel):
    mode: str = "lazy"
    name: str = ""
    description: str = ""
    character_id: str = ""
    character_name: str = ""
    persona_prompt: str = ""
    base_prompt: str = ""
    dynamic_tail: str = ""
    theme_color: str = ""
    app_launcher: str = ""
    env_presets: str = ""

@router.delete("/api/characters/{char_id}")
async def api_delete_character(char_id: str):
    import os, json
    from core.config_manager import SERVICES_DIR, get_active_character_id, GLOBAL_CONFIG_FILE
    
    if char_id == "rumia":
        return JSONResponse({"status": "error", "message": "基础角色(露米娅)无法被删除！"}, status_code=400)
        
    char_dir = os.path.join(SERVICES_DIR, "characters", char_id)
    if not os.path.exists(char_dir):
        return JSONResponse({"status": "error", "message": f"找不到角色: {char_id}"}, status_code=404)
        
    try:
        ok = safe_recycle_delete(char_dir)
        if not ok:
            return JSONResponse({"status": "error", "message": "删除失败：文件可能被占用"}, status_code=500)
        
        # If we deleted the active character, switch back to rumia
        if get_active_character_id() == char_id:
            if os.path.exists(GLOBAL_CONFIG_FILE):
                try:
                    with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                        g_config = json.load(f)
                    g_config["active_character"] = "rumia"
                    with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
                        json.dump(g_config, f, indent=4, ensure_ascii=False)
                except Exception:
                    pass
                    
        return JSONResponse({"status": "success", "message": "已安全移至回收站！"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"删除失败: {str(e)}"}, status_code=500)

@router.post("/api/characters/generate")
async def api_characters_generate(req: CharacterGenRequest):
    import os, json, shutil
    from core.config_manager import SERVICES_DIR, GLOBAL_CONFIG_FILE

    try:
        template_dir = os.path.join(SERVICES_DIR, "character_templates", "shili")
        if not os.path.exists(template_dir):
            return JSONResponse({"status": "error", "message": "未找到基础示例母本 (character_templates/shili)！"}, status_code=500)

        theme_color = req.theme_color.strip() if req.theme_color else ""

        if req.mode in ["construct", "pro"]:
            # 构建模式：根据用户输入克隆沙盒副本并切换
            char_id = req.character_id.strip().lower()
            char_name = req.character_name.strip()
            persona_prompt = req.persona_prompt.strip()

            if not char_id or not char_name:
                return JSONResponse({"status": "error", "message": "英文 ID 和中文名不能为空。"}, status_code=400)
            
            # 校验英文 ID 格式
            import re
            if not re.match(r'^[a-z0-9_]+$', char_id):
                return JSONResponse({"status": "error", "message": "英文 ID 仅支持小写字母、数字和下划线。"}, status_code=400)

            if not persona_prompt:
                persona_prompt = f"你是「{char_name}」，一个由大贤者系统构建出的新角色。请遵循核心人设与用户自然互动。"

        else:
            # 懒人模式：调用大模型提炼核心人设
            from core.llm_client import get_langchain_model
            from langchain_core.messages import SystemMessage, HumanMessage
            system_prompt = """你是一个高级桌面宠物角色配置生成器。
用户的输入将包括角色名字和一段特质描述。
请将这些零散的设定提炼成严格的 JSON 格式，不要输出任何额外的代码块标记或说明文字：
1. "character_id": 英文短小标识符（仅小写字母和下划线，如 "neko"、"alice"）
2. "character_name": 角色的中文名
3. "persona_prompt": 浓缩的系统核心人设（2-3句话，第一人称或客观陈述均可）"""

            llm = get_langchain_model()
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"名字: {req.name}\n特质描述: {req.description}")
            ]
            
            response = llm.invoke(messages)
            res_text = response.content.strip()
            
            if res_text.startswith("```json"):
                res_text = res_text[7:]
            elif res_text.startswith("```"):
                res_text = res_text[3:]
            if res_text.endswith("```"):
                res_text = res_text[:-3]
                
            data = json.loads(res_text.strip())
            char_id = data.get("character_id", "").strip().lower()
            char_name = data.get("character_name", "").strip()
            persona_prompt = data.get("persona_prompt", "").strip()
            
            if not char_id or not char_name:
                return JSONResponse({"status": "error", "message": "模型提炼的 JSON 格式不完整。"}, status_code=500)

        # 检查是否已存在同名角色
        target_char_dir = os.path.join(SERVICES_DIR, "characters", char_id)
        if os.path.exists(target_char_dir):
            return JSONResponse({"status": "error", "message": f"角色 ID 「{char_id}」已存在，请换一个 ID 或先删除旧角色。"}, status_code=400)

        # 从母本完整克隆沙盒副本
        shutil.copytree(template_dir, target_char_dir)

        # 写入定制化的 config.json
        config_path = os.path.join(target_char_dir, "config.json")
        conf = {}
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                try: conf = json.load(f)
                except Exception: pass

        conf["character_id"] = char_id
        conf["character_name"] = char_name
        conf["persona_prompt"] = persona_prompt
        conf["user_prompt"] = conf.get("user_prompt", "我是一个神隐到幻想乡的外界男性，对这里一无所知，被你从昏迷中救了过来。")
        conf["active_sprite_set"] = conf.get("active_sprite_set", "Rumia")
        if theme_color:
            conf["theme_color"] = theme_color

        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(conf, f, ensure_ascii=False, indent=2)

        # 自动将全局活跃角色切换为新构建的角色
        if os.path.exists(GLOBAL_CONFIG_FILE):
            try:
                with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    g_config = json.load(f)
                g_config["active_character"] = char_id
                with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
                    json.dump(g_config, f, indent=4, ensure_ascii=False)
            except Exception as e:
                print(f"[CONSTRUCT] 自动切换全局角色失败: {e}")

        return JSONResponse({
            "status": "success", 
            "character_id": char_id,
            "character_name": char_name,
            "message": f"角色「{char_name}」构建成功，已为您自动切换到该角色！"
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@router.post("/api/characters/export")
async def api_characters_export(request: Request, background_tasks: BackgroundTasks):
    import os, shutil, zipfile, json
    from tempfile import mkdtemp
    from core.config_manager import USER_DATA_DIR, SERVICES_DIR, GLOBAL_KEYS, CHARACTER_CONFIG_WHITELIST
    from core.reaction_manager import get_reactions_file
    
    try:
        data = await request.json()
        char_id = data.get("char_id")
        export_memory = data.get("export_memory", False)
        export_databank = data.get("export_databank", False)
        
        if not char_id:
            return JSONResponse({"status": "error", "message": "Missing char_id"}, status_code=400)
            
        # 寻找角色源目录 (优先 USER_DATA_DIR，其次 SERVICES_DIR)
        char_dir = os.path.join(USER_DATA_DIR, "characters", char_id)
        if not os.path.exists(char_dir):
            char_dir = os.path.join(SERVICES_DIR, "characters", char_id)
        if not os.path.exists(char_dir):
            return JSONResponse({"status": "error", "message": "角色不存在"}, status_code=404)
            
        temp_dir = mkdtemp()
        export_folder = os.path.join(temp_dir, char_id)
        
        def ignore_export_files(src, names):
            ignored = []
            for n in names:
                # 永久过滤排除锁文件、临时文件与运行期缓存数据库 (如 checkpoints.db)
                if n in (".lock", "__pycache__", ".DS_Store", "Thumbs.db") or n.startswith("checkpoints.db") or n.endswith(".tmp"):
                    ignored.append(n)
                
            # 仅在角色根目录匹配时排除特定的未勾选内容
            if os.path.abspath(src) == os.path.abspath(char_dir):
                if not export_memory:
                    ignored.extend(["dialog_history.json", "favorability.json", "daily_history", "qdrant_db"])
                if not export_databank:
                    ignored.append("databank_state.json")
            return ignored
            
        # 1. 复制专属角色文件夹作为基础，并应用忽略规则
        shutil.copytree(char_dir, export_folder, ignore=ignore_export_files)
        
        # 2. 净化导出的 config.json，剔除全局设置与私有 API Key
        config_path = os.path.join(export_folder, "config.json")
        clean_config = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    raw_cfg = json.load(f)
                for k, v in raw_cfg.items():
                    if k in CHARACTER_CONFIG_WHITELIST and k not in GLOBAL_KEYS:
                        clean_config[k] = v
                clean_config["character_id"] = raw_cfg.get("character_id", char_id)
                clean_config["character_name"] = raw_cfg.get("character_name", char_id)
                clean_config["persona_prompt"] = raw_cfg.get("persona_prompt", "")
                clean_config["user_prompt"] = raw_cfg.get("user_prompt", "")
                clean_config["theme_color"] = raw_cfg.get("theme_color", "#ff6b8b")
                
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(clean_config, f, ensure_ascii=False, indent=2)
            except Exception as ce:
                print(f"[EXPORT] 净化 config.json 失败: {ce}")

        # 3. 自动打包点击互动应付词 reactions.json
        reaction_src = get_reactions_file(char_id)
        if not os.path.exists(reaction_src):
            reaction_src = os.path.join(char_dir, "reactions.json")
        if os.path.exists(reaction_src):
            try:
                shutil.copy2(reaction_src, os.path.join(export_folder, "reactions.json"))
            except Exception as re:
                print(f"[EXPORT] 打包 reactions.json 失败: {re}")
                
        # 4. 生成 zip 压缩包
        zip_path = os.path.join(temp_dir, f"{char_id}_export.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(export_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)
                    
        def cleanup_temp():
            shutil.rmtree(temp_dir, ignore_errors=True)
            
        background_tasks.add_task(cleanup_temp)
        return FileResponse(path=zip_path, filename=f"{char_id}_export.zip", media_type='application/zip')
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@router.post("/api/characters/inspect_zip")
async def api_characters_inspect_zip(file: UploadFile = File(...)):
    """预检上传的角色卡压缩包，自动提取 character_id, character_name, persona_prompt 等元信息"""
    import zipfile, json, io
    try:
        contents = await file.read()
        zip_buffer = io.BytesIO(contents)
        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
            config_entry = None
            for name in zip_ref.namelist():
                if name.endswith("config.json") and not name.startswith("__MACOSX"):
                    config_entry = name
                    break
            if config_entry:
                config_data = json.loads(zip_ref.read(config_entry).decode('utf-8'))
                char_id = config_data.get("character_id", "")
                char_name = config_data.get("character_name", "")
                if not char_id:
                    parts = config_entry.split('/')
                    if len(parts) > 1 and parts[0]:
                        char_id = parts[0]
                return JSONResponse({
                    "status": "success",
                    "character_id": char_id,
                    "character_name": char_name,
                    "persona_prompt": config_data.get("persona_prompt", "")[:120]
                })
        return JSONResponse({"status": "error", "message": "压缩包内未找到 config.json"}, status_code=400)
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@router.post("/api/characters/import")
async def api_characters_import(
    char_id: str = Form(...),
    file: UploadFile = File(...)
):
    import os, shutil, zipfile, json, re
    from tempfile import mkdtemp
    from core.config_manager import USER_DATA_DIR, SERVICES_DIR, GLOBAL_KEYS, CHARACTER_CONFIG_WHITELIST
    from core.reaction_manager import save_reactions

    char_id = char_id.strip()
    if not char_id or not re.match(r'^[a-zA-Z0-9_\-]+$', char_id):
        return JSONResponse({"status": "error", "message": "角色ID必须由英文字母、数字或下划线组成！"}, status_code=400)

    char_dir = os.path.join(USER_DATA_DIR, "characters", char_id)
    if os.path.exists(char_dir):
        return JSONResponse({"status": "error", "message": f"角色ID '{char_id}' 已存在，请更换或先在控制台删除旧角色！"}, status_code=400)
        
    temp_dir = mkdtemp()
    try:
        zip_path = os.path.join(temp_dir, "upload.zip")
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        extract_dir = os.path.join(temp_dir, "extract")
        os.makedirs(extract_dir, exist_ok=True)
        
        # 安全解压 (Zip Slip 防护)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                target_path = os.path.abspath(os.path.join(extract_dir, member.filename))
                if not target_path.startswith(os.path.abspath(extract_dir)):
                    raise Exception("非法压缩包：存在跨目录路径穿越风险！")
                zip_ref.extract(member, extract_dir)
            
        # 智能查找角色根目录 (包含 config.json 的目录)
        found_root = None
        for root, dirs, files in os.walk(extract_dir):
            if "config.json" in files:
                found_root = root
                break
                
        if not found_root:
            return JSONResponse({"status": "error", "message": "压缩包内未找到 config.json (无效的角色卡)"}, status_code=400)
            
        extract_dir = found_root
        
        # 1. 复制整个目录到 USER_DATA_DIR/characters/<char_id>
        shutil.copytree(extract_dir, char_dir)
        
        # 2. 净化并校准 config.json
        config_path = os.path.join(char_dir, "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    imported_cfg = json.load(f)
                clean_cfg = {}
                for k, v in imported_cfg.items():
                    if k in CHARACTER_CONFIG_WHITELIST and k not in GLOBAL_KEYS:
                        clean_cfg[k] = v
                clean_cfg["character_id"] = char_id
                if "character_name" not in clean_cfg or not clean_cfg["character_name"]:
                    clean_cfg["character_name"] = char_id
                    
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(clean_cfg, f, ensure_ascii=False, indent=2)
            except Exception as ce:
                print(f"[IMPORT] 校验 config.json 失败: {ce}")

        # 3. 如果包含 reactions.json，同步释放到数据目录
        reaction_file = os.path.join(char_dir, "reactions.json")
        if os.path.exists(reaction_file):
            try:
                with open(reaction_file, 'r', encoding='utf-8') as rf:
                    rdata = json.load(rf)
                save_reactions(char_id, rdata)
            except Exception as re:
                print(f"[IMPORT] 释放 reactions.json 失败: {re}")

        return JSONResponse({"status": "success", "message": f"角色 '{char_id}' 导入成功！"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@router.get("/api/character_info")
async def api_character_info():
    import json
    from core.config_manager import get_custom_engines, get_character_dir
    char_id = get_active_character_id()
    config = get_config()
    char_name = config.get("character_name", char_id)
    needs_onboarding = len(get_custom_engines()) == 0
    
    active_sprite_set = config.get("active_sprite_set", "main_sprites")
    assets_dir = os.path.join(get_character_dir(), "assets")
    sprite_dir = os.path.join(assets_dir, active_sprite_set)
    
    # If the configured set doesn't exist, fallback to the first available set
    if not os.path.exists(sprite_dir) and os.path.exists(assets_dir):
        sets = [d for d in os.listdir(assets_dir) if os.path.isdir(os.path.join(assets_dir, d))]
        if sets:
            active_sprite_set = sets[0]
            sprite_dir = os.path.join(assets_dir, active_sprite_set)
    
    images_dict = {
        "normal": [],
        "angry": [],
        "shy": [],
        "crying": [],
        "sleeping": [],
        "peeking_left": [],
        "peeking_right": []
    }
    
    if os.path.exists(sprite_dir):
        for f in os.listdir(sprite_dir):
            if f.lower().endswith('.png'):
                if f.lower().startswith('peeking_left'):
                    emotion_key = 'peeking_left'
                elif f.lower().startswith('peeking_right'):
                    emotion_key = 'peeking_right'
                else:
                    emotion_key = f.split('_')[0].split('.')[0]
                    
                if emotion_key in images_dict:
                    images_dict[emotion_key].append(f"/char_assets/{char_id}/assets/{active_sprite_set}/{f}")
                    
    # 自动检测沉浸模式角色专属壁纸 (支持 gif, png, jpg, webp)
    wallpaper_url = config.get("immersive_wallpaper", "")
    if not wallpaper_url:
        char_dir = get_character_dir()
        candidate_dirs = [assets_dir, char_dir]
        for cdir in candidate_dirs:
            if os.path.exists(cdir):
                for f in os.listdir(cdir):
                    if f.lower().startswith("wallpaper.") and f.lower().endswith(('.gif', '.png', '.jpg', '.jpeg', '.webp')):
                        if cdir == assets_dir:
                            wallpaper_url = f"/char_assets/{char_id}/assets/{f}"
                        else:
                            wallpaper_url = f"/char_assets/{char_id}/{f}"
                        break
            if wallpaper_url:
                break
                    
    live2d_rel = find_live2d_model_file(sprite_dir) if os.path.exists(sprite_dir) else None
    sprite_type = "live2d" if live2d_rel else "sprite"
    live2d_model_url = f"/char_assets/{char_id}/assets/{active_sprite_set}/{live2d_rel}" if live2d_rel else ""
    
    live2d_settings = config.get("live2d_settings", {})
    active_l2d_cfg = live2d_settings.get(active_sprite_set, {})
    live2d_scale = float(active_l2d_cfg.get("scale", 1.0))
    live2d_offset_x = float(active_l2d_cfg.get("offset_x", 0.0))
    live2d_offset_y = float(active_l2d_cfg.get("offset_y", 0.0))

    return JSONResponse({
        "character_id": char_id,
        "character_name": char_name,
        "theme_color": config.get("theme_color", ""),
        "sprite_type": sprite_type,
        "live2d_model_url": live2d_model_url,
        "live2d_scale": live2d_scale,
        "live2d_offset_x": live2d_offset_x,
        "live2d_offset_y": live2d_offset_y,
        "image_path": f"/char_assets/{char_id}/assets/{active_sprite_set}/",
        "images_dict": images_dict,
        "active_sprite_set": active_sprite_set,
        "wallpaper_url": wallpaper_url,
        "wallpaper_fit": config.get("wallpaper_fit", "cover"),
        "immersive_bg_mode": config.get("immersive_bg_mode", "image"),
        "immersive_media_url": config.get("immersive_media_url", ""),
        "immersive_bgm_url": config.get("immersive_bgm_url", ""),
        "enable_immersive_bgm": config.get("enable_immersive_bgm", True),
        "enable_immersive_starlight": config.get("enable_immersive_starlight", False),
        "enable_immersive_meteors": config.get("enable_immersive_meteors", False),
        "enable_immersive_parallax": config.get("enable_immersive_parallax", False),
        "enable_immersive_screenshot_btn": config.get("enable_immersive_screenshot_btn", False),
        "enable_greeting": config.get("enable_greeting", True),
        "enable_auto_speak": config.get("enable_auto_speak", True),
        "auto_speak_multiplier": config.get("auto_speak_multiplier", 1.0),
        "bubble_duration_multiplier": config.get("bubble_duration_multiplier", 1.0),
        "needs_onboarding": needs_onboarding
    })

@router.post("/api/switch_character")
async def api_switch_character(request: Request):
    import json
    try:
        data = await request.json()
        new_char_id = data.get("character_id")
        if not new_char_id:
            return JSONResponse({"status": "error", "message": "Missing character_id"}, status_code=400)
            
        import os
        g_config = {}
        if os.path.exists(GLOBAL_CONFIG_FILE):
            with open(GLOBAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                g_config = json.load(f)
        g_config["active_character"] = new_char_id
        with open(GLOBAL_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(g_config, f, indent=2)
            
        return JSONResponse({"status": "success", "require_restart": True})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@router.get("/api/presets/list")
def api_presets_list():
    import json
    from core.config_manager import USER_DATA_DIR, SERVICES_DIR, get_character_dir
    global_file = os.path.join(USER_DATA_DIR, "global_presets", "global_presets.json")
    if not os.path.exists(global_file):
        global_file = os.path.join(SERVICES_DIR, "global_presets", "global_presets.json")
    custom_file = os.path.join(get_character_dir(), "presets", "custom_presets.json")
    
    global_presets = []
    if os.path.exists(global_file):
        try:
            with open(global_file, 'r', encoding='utf-8') as f:
                global_presets = json.load(f)
        except Exception:
            pass
            
    custom_presets = []
    if os.path.exists(custom_file):
        try:
            with open(custom_file, 'r', encoding='utf-8') as f:
                custom_presets = json.load(f)
        except Exception:
            pass
            
    return JSONResponse({"success": True, "global": global_presets, "custom": custom_presets})

class PresetSaveRequest(BaseModel):
    type: str # 'global' or 'custom'
    preset: dict

@router.post("/api/presets/save")
def api_presets_save(req: PresetSaveRequest):
    import json
    from core.config_manager import USER_DATA_DIR, SERVICES_DIR, get_character_dir
    if req.type == "global":
        dir_path = os.path.join(USER_DATA_DIR, "global_presets")
        file_path = os.path.join(dir_path, "global_presets.json")
    else:
        dir_path = os.path.join(get_character_dir(), "presets")
        file_path = os.path.join(dir_path, "custom_presets.json")
        
    os.makedirs(dir_path, exist_ok=True)
    
    presets = []
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                presets = json.load(f)
        except Exception:
            presets = []
            
    # 如果同名，覆盖
    new_preset = req.preset
    name = new_preset.get("name", "").strip()
    if not name:
        return JSONResponse({"success": False, "error": "预设名称不能为空"})
        
    found = False
    for i, p in enumerate(presets):
        if p.get("name") == name:
            presets[i] = new_preset
            found = True
            break
            
    if not found:
        presets.append(new_preset)
        
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})

class PresetDeleteRequest(BaseModel):
    type: str
    name: str

@router.post("/api/presets/delete")
def api_presets_delete(req: PresetDeleteRequest):
    import json
    from core.config_manager import USER_DATA_DIR, SERVICES_DIR, get_character_dir
    if req.type == "global":
        file_path = os.path.join(USER_DATA_DIR, "global_presets", "global_presets.json")
    else:
        file_path = os.path.join(get_character_dir(), "presets", "custom_presets.json")
        
    if not os.path.exists(file_path):
        return JSONResponse({"success": True})
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            presets = json.load(f)
            
        presets = [p for p in presets if p.get("name") != req.name]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})

@router.post("/api/worldbook/import")
async def import_worldbook(file: UploadFile = File(...), type: str = Form("custom")):
    """接收酒馆格式的世界书 json 文件，解析并合入 custom_presets 或 global_presets"""
    try:
        content = await file.read()
        wb_data = json.loads(content.decode("utf-8"))
        
        if "entries" not in wb_data:
            return JSONResponse({"success": False, "error": "无效的世界书格式：找不到 entries 字段"})
            
        entries = wb_data.get("entries", {})
        if not isinstance(entries, dict):
            return JSONResponse({"success": False, "error": "无效的世界书格式：entries 不是字典"})
            
        from core.config_manager import get_file_path, USER_DATA_DIR, SERVICES_DIR
        
        if type == "global":
            custom_presets_file = os.path.join(USER_DATA_DIR, "global_presets", "global_presets.json")
        else:
            custom_presets_file = get_file_path("presets/custom_presets.json")
        
        custom_presets = []
        if os.path.exists(custom_presets_file):
            with open(custom_presets_file, 'r', encoding='utf-8') as f:
                try:
                    custom_presets = json.load(f)
                except Exception:
                    custom_presets = []
                    
        source_name = file.filename.replace(".json", "") if file.filename else "Unknown_Worldbook"
        
        count = 0
        for entry_id, entry in entries.items():
            if not isinstance(entry, dict):
                continue
                
            new_preset = {
                "name": entry.get("comment", f"wb_entry_{entry_id}"),
                "prompt": entry.get("content", ""),
                "trigger_keywords": entry.get("key", []),
                "secondary_keywords": entry.get("keysecondary", []),
                "constant": entry.get("constant", False),
                "disable": entry.get("disable", False),
                "position": int(entry.get("position", 1)) if entry.get("position") is not None else 1,
                "order": int(entry.get("order", 100)) if entry.get("order") is not None else 100,
                "prevent_recursion": entry.get("preventRecursion", False),
                "worldbook_source": source_name
            }
            
            # Clean up empty arrays
            if not new_preset["trigger_keywords"]:
                del new_preset["trigger_keywords"]
            if not new_preset["secondary_keywords"]:
                del new_preset["secondary_keywords"]
                
            custom_presets.append(new_preset)
            count += 1
            
        with open(custom_presets_file, 'w', encoding='utf-8') as f:
            json.dump(custom_presets, f, ensure_ascii=False, indent=2)
            
        return JSONResponse({"success": True, "count": count})
    except Exception as e:
        return JSONResponse({"success": False, "error": f"解析世界书失败: {str(e)}"})

# 13. 自定义大脑引擎接口

@router.get("/api/pet_reactions")
@router.get("/api/reactions")
def api_pet_reactions():
    """获取桌宠5x5点击反应词库及离线语音状态"""
    from core.reaction_manager import load_reactions, get_reactions_detail, trigger_initial_generation_async, DEFAULT_EMOTIONS
    char_id = get_active_character_id()
    data = load_reactions(char_id)
    
    # Check total reaction count to determine if it is extremely empty
    total_reactions = 0
    if data:
        for e in DEFAULT_EMOTIONS:
            total_reactions += len(data.get(e, []))

    if not data or total_reactions < 5:
        trigger_initial_generation_async(char_id)
        fallback = {e: ["嗯？"] for e in DEFAULT_EMOTIONS}
        fallback["angry"] = ["别碰我！"]
        fallback["crying"] = ["呜呜..."]
        fallback["shy"] = ["哎呀..."]
        fallback["sleeping"] = ["Zzz..."]
        if data:
            for e in DEFAULT_EMOTIONS:
                if data.get(e):
                    fallback[e] = data[e]
        detail = get_reactions_detail(char_id)
        return JSONResponse({"success": True, "reactions": fallback, "reactions_detail": detail, "is_generating": True})
        
    detail = get_reactions_detail(char_id)
    return JSONResponse({"success": True, "reactions": data, "reactions_detail": detail, "is_generating": False})

@router.get("/api/pet_reactions/audio_file/{char_id}/{filename}")
def api_pet_reactions_audio_file(char_id: str, filename: str):
    """静态读取并返回应付词离线音频文件"""
    from core.reaction_manager import get_reactions_audio_dir
    audio_dir = get_reactions_audio_dir(char_id)
    file_path = os.path.join(audio_dir, filename)
    if os.path.exists(file_path) and file_path.endswith('.mp3'):
        from fastapi.responses import FileResponse
        return FileResponse(file_path, media_type="audio/mpeg")
    return JSONResponse({"success": False, "error": "Audio file not found"}, status_code=404)

@router.post("/api/pet_reactions/record_single")
def api_pet_reactions_record_single(payload: dict = Body(...)):
    """单句应付词生成/录制为本地离线语音"""
    from core.reaction_manager import record_single_reaction_audio
    char_id = payload.get("character_id") or get_active_character_id()
    emotion = payload.get("emotion") or "normal"
    text = payload.get("text", "").strip()
    skip_refine = payload.get("skip_refine", False)

    if not text:
        return JSONResponse({"success": False, "error": "文本内容不能为空"}, status_code=400)

    success, audio_url, err = record_single_reaction_audio(char_id, emotion, text, skip_refine=skip_refine)
    if success and audio_url:
        return JSONResponse({"success": True, "audio_url": audio_url})
    return JSONResponse({"success": False, "error": err or "录制失败"}, status_code=500)

@router.post("/api/pet_reactions/batch_generate_audio")
def api_pet_reactions_batch_generate(payload: dict = Body(default={})):
    """启动全量应付词自动翻译精修与语音录制流水线"""
    from core.reaction_manager import batch_recorder
    char_id = payload.get("character_id") or get_active_character_id()
    force_overwrite = payload.get("force_overwrite", False)
    success, msg = batch_recorder.start_batch(char_id, force_overwrite=force_overwrite)
    return JSONResponse({"success": success, "message": msg})

@router.get("/api/pet_reactions/batch_progress")
def api_pet_reactions_batch_progress():
    """获取当前批量录制流水线进度"""
    from core.reaction_manager import batch_recorder
    return JSONResponse(batch_recorder.get_progress())

@router.post("/api/pet_reactions/stop_batch")
def api_pet_reactions_stop_batch():
    """停止批量录制流水线"""
    from core.reaction_manager import batch_recorder
    batch_recorder.stop_batch()
    return JSONResponse({"success": True, "message": "已发送停止信号"})

@router.post("/api/pet_reactions/add")
@router.post("/api/reactions/add")
def api_pet_reactions_add(payload: dict = Body(...)):
    """添加应付词"""
    from core.reaction_manager import append_reaction, DEFAULT_EMOTIONS
    emotion = payload.get("emotion")
    text = payload.get("text")
    if emotion not in DEFAULT_EMOTIONS or not text:
        return JSONResponse({"success": False, "error": "Invalid parameters"}, status_code=400)
    
    char_id = get_active_character_id()
    append_reaction(char_id, emotion, text)
    return {"success": True}

@router.post("/api/pet_reactions/delete")
@router.post("/api/reactions/delete")
def api_pet_reactions_delete(payload: dict = Body(...)):
    """删除应付词"""
    from core.reaction_manager import remove_reaction, DEFAULT_EMOTIONS
    emotion = payload.get("emotion")
    text = payload.get("text")
    if emotion not in DEFAULT_EMOTIONS or not text:
        return JSONResponse({"success": False, "error": "Invalid parameters"}, status_code=400)
    
    char_id = get_active_character_id()
    success = remove_reaction(char_id, emotion, text)
    return {"success": success}

@router.post("/api/pet_reactions/regenerate")
def api_pet_reactions_regenerate():
    """清空并重新生成词库"""
    from core.reaction_manager import save_reactions, trigger_initial_generation_async
    char_id = get_active_character_id()
    save_reactions(char_id, {})
    trigger_initial_generation_async(char_id)
    return {"success": True}

# 13. 静默记忆注入接口

@router.get("/api/sprites/list")
async def api_sprites_list():
    from core.config_manager import get_character_dir
    char_id = get_active_character_id()
    config = get_config()
    active_set = config.get("active_sprite_set", "main_sprites")
    assets_dir = os.path.join(get_character_dir(), "assets")
    
    sets = {}
    live2d_settings = config.get("live2d_settings", {})
    if os.path.exists(assets_dir):
        for set_name in os.listdir(assets_dir):
            set_dir = os.path.join(assets_dir, set_name)
            if os.path.isdir(set_dir):
                # 检查是否为 Live2D 模型套装
                live2d_rel = find_live2d_model_file(set_dir)
                if live2d_rel:
                    suit_cfg = live2d_settings.get(set_name, {})
                    sets[set_name] = {
                        "type": "live2d",
                        "model_file": live2d_rel,
                        "model_url": f"/char_assets/{char_id}/assets/{set_name}/{live2d_rel}",
                        "scale": float(suit_cfg.get("scale", 1.0)),
                        "offset_x": float(suit_cfg.get("offset_x", 0.0)),
                        "offset_y": float(suit_cfg.get("offset_y", 0.0))
                    }
                else:
                    images = {
                        "normal": [], "angry": [], "shy": [], "crying": [], "sleeping": [], "peeking_left": [], "peeking_right": []
                    }
                    for f in os.listdir(set_dir):
                        if f.lower().endswith(('.png', '.gif', '.webp', '.jpg', '.jpeg')):
                            if f.lower().startswith('peeking_left'):
                                emotion_key = 'peeking_left'
                            elif f.lower().startswith('peeking_right'):
                                emotion_key = 'peeking_right'
                            else:
                                emotion_key = f.split('_')[0].split('.')[0]
                                
                            if emotion_key in images:
                                images[emotion_key].append(f"/char_assets/{char_id}/assets/{set_name}/{f}")
                    sets[set_name] = {
                        "type": "sprite",
                        "images": images
                    }
                
    return JSONResponse({
        "success": True,
        "active_set": active_set,
        "sets": sets
    })

@router.post("/api/sprites/live2d_config")
async def api_sprites_live2d_config(req: Request):
    """保存 Live2D 模型的缩放比例与位置偏移"""
    from core.config_manager import save_config
    try:
        data = await req.json()
        set_name = data.get("set_name")
        scale = float(data.get("scale", 1.0))
        offset_x = float(data.get("offset_x", 0.0))
        offset_y = float(data.get("offset_y", 0.0))

        if not set_name:
            return JSONResponse({"success": False, "error": "set_name is required"}, status_code=400)

        config = get_config()
        if "live2d_settings" not in config:
            config["live2d_settings"] = {}

        config["live2d_settings"][set_name] = {
            "scale": scale,
            "offset_x": offset_x,
            "offset_y": offset_y
        }
        save_config(config)
        return JSONResponse({"success": True, "settings": config["live2d_settings"][set_name]})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@router.post("/api/sprites/import_live2d")
async def api_sprites_import_live2d(
    zip_path: Optional[str] = Form(None),
    set_name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    import zipfile
    from core.config_manager import get_character_dir
    char_id = get_active_character_id()
    assets_dir = os.path.join(get_character_dir(), "assets")
    os.makedirs(assets_dir, exist_ok=True)

    temp_zip_to_clean = None
    final_zip_path = None

    if file and file.filename:
        # 上传文件模式
        temp_zip_to_clean = os.path.join(assets_dir, f"_temp_import_{file.filename}")
        with open(temp_zip_to_clean, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        final_zip_path = temp_zip_to_clean
        if not set_name:
            set_name = os.path.splitext(file.filename)[0]
    elif zip_path:
        # 本地绝对路径模式 (例如 "H:\新建文件夹\mao_zh-Hans.zip")
        clean_path = zip_path.strip().strip('"').strip("'")
        if not os.path.exists(clean_path):
            return JSONResponse({"success": False, "message": f"找不到本地压缩包: {clean_path}"}, status_code=400)
        final_zip_path = clean_path
        if not set_name:
            set_name = os.path.splitext(os.path.basename(clean_path))[0]
    else:
        return JSONResponse({"success": False, "message": "请提供本地压缩包路径或上传 .zip 文件"}, status_code=400)

    # 规范化套装名称
    set_name = re.sub(r'[<>:"/\\|?*]', '_', set_name).strip()
    if not set_name:
        set_name = "live2d_outfit"

    target_dir = os.path.join(assets_dir, set_name)
    os.makedirs(target_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(final_zip_path, 'r') as zip_ref:
            # 解决 zip 解压中文文件名乱码 (cp437 -> gbk/utf-8)
            for zip_info in zip_ref.infolist():
                try:
                    fixed_name = zip_info.filename.encode('cp437').decode('gbk')
                except Exception:
                    try:
                        fixed_name = zip_info.filename.encode('cp437').decode('utf-8')
                    except Exception:
                        fixed_name = zip_info.filename

                fixed_name = fixed_name.lstrip('/\\')
                target_file_path = os.path.join(target_dir, fixed_name)
                
                if zip_info.is_dir():
                    os.makedirs(target_file_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
                    with zip_ref.open(zip_info) as source, open(target_file_path, "wb") as target:
                        shutil.copyfileobj(source, target)

        # 检查是否解压出了 Live2D 模型
        model_file = find_live2d_model_file(target_dir)
        if not model_file:
            return JSONResponse({
                "success": False,
                "message": f"解压完成，但在压缩包中未检测到 .model3.json 或 .model.json 配置文件！"
            }, status_code=400)

        # 自动设为当前套装
        config = get_config()
        config["active_sprite_set"] = set_name
        save_config(config)

        return JSONResponse({
            "success": True,
            "set_name": set_name,
            "type": "live2d",
            "model_file": model_file,
            "model_url": f"/char_assets/{char_id}/assets/{set_name}/{model_file}"
        })

    except Exception as e:
        return JSONResponse({"success": False, "message": f"解压 Live2D 模型失败: {str(e)}"}, status_code=500)
    finally:
        if temp_zip_to_clean and os.path.exists(temp_zip_to_clean):
            try:
                os.remove(temp_zip_to_clean)
            except Exception:
                pass

class SpriteSetActiveRequest(BaseModel):
    set_name: str

@router.post("/api/sprites/set_active")
async def api_sprites_set_active(req: SpriteSetActiveRequest):
    from core.config_manager import get_character_dir
    set_dir = os.path.join(get_character_dir(), "assets", req.set_name)
    if not os.path.exists(set_dir):
        return JSONResponse({"success": False, "message": "Sprite set not found"}, status_code=400)
        
    config = get_config()
    config["active_sprite_set"] = req.set_name
    save_config(config)
    return JSONResponse({"success": True})

class SpriteCreateSetRequest(BaseModel):
    set_name: str

class SpriteRenameSetRequest(BaseModel):
    old_name: str
    new_name: str

@router.post("/api/sprites/create_set")
async def api_sprites_create_set(req: SpriteCreateSetRequest):
    from core.config_manager import get_character_dir
    # Sanitize directory name (remove Windows invalid path characters)
    set_name = re.sub(r'[<>:"/\\|?*]', '', req.set_name).strip()
    if not set_name:
         return JSONResponse({"success": False, "message": "Invalid set name"}, status_code=400)
         
    set_dir = os.path.join(get_character_dir(), "assets", set_name)
    if os.path.exists(set_dir):
        return JSONResponse({"success": False, "message": "Set already exists"}, status_code=400)
        
    os.makedirs(set_dir, exist_ok=True)
    return JSONResponse({"success": True})

@router.post("/api/sprites/rename_set")
async def api_sprites_rename_set(req: SpriteRenameSetRequest):
    from core.config_manager import get_character_dir
    old_name = re.sub(r'[<>:"/\\|?*]', '', req.old_name).strip()
    new_name = re.sub(r'[<>:"/\\|?*]', '', req.new_name).strip()
    if not old_name or not new_name:
         return JSONResponse({"success": False, "message": "Invalid set name"}, status_code=400)
         
    old_dir = os.path.join(get_character_dir(), "assets", old_name)
    new_dir = os.path.join(get_character_dir(), "assets", new_name)
    if not os.path.exists(old_dir):
        return JSONResponse({"success": False, "message": "Original set not found"}, status_code=400)
    if os.path.exists(new_dir):
        return JSONResponse({"success": False, "message": "New set name already exists"}, status_code=400)
        
    try:
        os.rename(old_dir, new_dir)
        from core.config_manager import get_config, save_config
        config = get_config()
        if config.get("active_sprite_set", "main_sprites") == old_name:
            config["active_sprite_set"] = new_name
            save_config(config)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

@router.post("/api/sprites/upload")
async def api_sprites_upload(set_name: str = Form(...), emotion: str = Form(...), files: list[UploadFile] = File(...)):
    from core.config_manager import get_character_dir
    set_dir = os.path.join(get_character_dir(), "assets", set_name)
    if not os.path.exists(set_dir):
        return JSONResponse({"success": False, "message": "Sprite set not found"}, status_code=400)
        
    if emotion not in ["normal", "angry", "shy", "crying", "sleeping", "peeking_left", "peeking_right"]:
        return JSONResponse({"success": False, "message": "Invalid emotion"}, status_code=400)
        
    # Find next available index for this emotion
    existing_files = [f for f in os.listdir(set_dir) if f.startswith(f"{emotion}") and f.endswith(".png")]
    
    def get_index(filename):
        # Extracts index from normal.png (0) or normal_1.png (1)
        name = filename.split('.')[0]
        parts = name.split('_')
        if len(parts) > 1 and parts[-1].isdigit():
            return int(parts[-1])
        return 0
        
    indices = [get_index(f) for f in existing_files]
    next_idx = max(indices) + 1 if indices else 0
    
    for file in files:
        if next_idx == 0:
            filename = f"{emotion}.png"
        else:
            filename = f"{emotion}_{next_idx}.png"
        next_idx += 1
        
        file_path = os.path.join(set_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    return JSONResponse({"success": True})

class SpriteDeleteRequest(BaseModel):
    set_name: str
    filename: str

@router.post("/api/sprites/delete")
async def api_sprites_delete(req: SpriteDeleteRequest):
    from core.config_manager import get_character_dir
    set_dir = os.path.join(get_character_dir(), "assets", req.set_name)
    file_path = os.path.join(set_dir, req.filename)
    
    # Security check to prevent path traversal
    if not os.path.abspath(file_path).startswith(os.path.abspath(set_dir)):
        return JSONResponse({"success": False, "message": "Invalid path"}, status_code=400)
        
    if os.path.exists(file_path):
        os.remove(file_path)
        return JSONResponse({"success": True})
    return JSONResponse({"success": False, "message": "File not found"}, status_code=404)

