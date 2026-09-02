import os
import json
import time
import shutil
import zipfile
import subprocess
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
from tempfile import mkdtemp

from core.config_manager import SERVICES_DIR, USER_DATA_DIR, CHARACTER_CONFIG_WHITELIST, GLOBAL_KEYS
from core.reaction_manager import get_reactions_file, get_reactions_audio_dir

ROOT_DIR = os.path.dirname(SERVICES_DIR)
BACKUP_DIR = os.path.join(ROOT_DIR, 'data', 'backups', 'characters')
MANIFEST_FILE = os.path.join(BACKUP_DIR, 'manifest.json')
THREE_DAYS_SECONDS = 3 * 86400

def get_backup_dir() -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    return BACKUP_DIR

def get_all_character_ids() -> List[str]:
    """扫描系统中所有可用角色目录"""
    char_ids = set()
    for base in [USER_DATA_DIR, SERVICES_DIR]:
        chars_path = os.path.join(base, 'characters')
        if os.path.exists(chars_path):
            for item in os.listdir(chars_path):
                c_path = os.path.join(chars_path, item)
                if os.path.isdir(c_path):
                    char_ids.add(item)
    return sorted(list(char_ids))

def get_backup_manifest() -> Dict[str, Any]:
    """读取并计算备份清单状态（包含 3 日时效性分析）"""
    get_backup_dir()
    if not os.path.exists(MANIFEST_FILE):
        return {
            'has_backup': False,
            'is_valid_within_3_days': False,
            'last_backup_time': None,
            'last_backup_timestamp': 0,
            'backup_count': 0,
            'characters': [],
            'backup_dir': BACKUP_DIR,
            'message': '尚未生成过角色包全量备份'
        }
    
    try:
        with open(MANIFEST_FILE, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        last_ts = float(manifest.get('last_backup_timestamp', 0))
        now_ts = time.time()
        elapsed = now_ts - last_ts
        is_valid = (elapsed < THREE_DAYS_SECONDS)
        
        manifest['has_backup'] = True
        manifest['is_valid_within_3_days'] = is_valid
        manifest['elapsed_hours'] = round(elapsed / 3600, 1)
        manifest['backup_dir'] = BACKUP_DIR
        return manifest
    except Exception as e:
        return {
            'has_backup': False,
            'is_valid_within_3_days': False,
            'last_backup_time': None,
            'last_backup_timestamp': 0,
            'backup_count': 0,
            'characters': [],
            'backup_dir': BACKUP_DIR,
            'error': str(e),
            'message': f'读取备份清单异常: {e}'
        }

def create_full_character_backup(char_id: str, output_dir: str) -> Optional[Dict[str, Any]]:
    """
    将单个角色全量导出并打包为 ZIP
    包含：人设、专属提示词、动态数据库(模板+状态)、日记记忆、应付词与离线语音、全套立绘及Live2D资产
    """
    # 寻找角色源目录 (优先 USER_DATA_DIR，其次 SERVICES_DIR)
    char_dir = os.path.join(USER_DATA_DIR, 'characters', char_id)
    if not os.path.exists(char_dir):
        char_dir = os.path.join(SERVICES_DIR, 'characters', char_id)
    if not os.path.exists(char_dir):
        return None

    temp_dir = mkdtemp()
    try:
        export_folder = os.path.join(temp_dir, char_id)
        
        def ignore_filter(src, names):
            ignored = []
            for n in names:
                if n in ('.lock', '__pycache__', '.DS_Store', 'Thumbs.db') or n.startswith('checkpoints.db') or n.endswith('.tmp'):
                    ignored.append(n)
            return ignored
            
        # 1. 复制全套角色文件夹
        shutil.copytree(char_dir, export_folder, ignore=ignore_filter)
        
        # 2. 净化 config.json，确保导出安全
        config_path = os.path.join(export_folder, 'config.json')
        char_name = char_id
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    raw_cfg = json.load(f)
                clean_config = {}
                for k, v in raw_cfg.items():
                    if k in CHARACTER_CONFIG_WHITELIST and k not in GLOBAL_KEYS:
                        clean_config[k] = v
                clean_config['character_id'] = raw_cfg.get('character_id', char_id)
                clean_config['character_name'] = raw_cfg.get('character_name', char_id)
                char_name = clean_config['character_name']
                clean_config['persona_prompt'] = raw_cfg.get('persona_prompt', '')
                clean_config['user_prompt'] = raw_cfg.get('user_prompt', '')
                clean_config['theme_color'] = raw_cfg.get('theme_color', '#ff6b8b')
                
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(clean_config, f, ensure_ascii=False, indent=2)
            except Exception as ce:
                print(f'[BACKUP] 净化 {char_id} config.json 警告: {ce}')
        
        # 3. 自动打包点击互动应付词 reactions.json 与离线语音 reactions_audio
        reaction_src = get_reactions_file(char_id)
        if not os.path.exists(reaction_src):
            reaction_src = os.path.join(char_dir, 'reactions.json')
        if os.path.exists(reaction_src):
            try:
                shutil.copy2(reaction_src, os.path.join(export_folder, 'reactions.json'))
            except Exception as re:
                print(f'[BACKUP] 打包 {char_id} reactions.json 警告: {re}')
                
        audio_src = get_reactions_audio_dir(char_id)
        if os.path.exists(audio_src) and os.listdir(audio_src):
            try:
                dst_audio = os.path.join(export_folder, 'reactions_audio')
                if os.path.exists(dst_audio):
                    shutil.rmtree(dst_audio, ignore_errors=True)
                shutil.copytree(audio_src, dst_audio)
            except Exception as ae:
                print(f'[BACKUP] 打包 {char_id} reactions_audio 警告: {ae}')

        # 4. 生成统一命名的 ZIP 备份包
        zip_filename = f'{char_id}_full_backup.zip'
        final_zip_path = os.path.join(output_dir, zip_filename)
        
        with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(export_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)
                    
        file_size_bytes = os.path.getsize(final_zip_path)
        file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
        
        return {
            'character_id': char_id,
            'character_name': char_name,
            'file_name': zip_filename,
            'file_size_mb': file_size_mb,
            'backup_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def run_all_characters_backup(force: bool = False) -> Dict[str, Any]:
    """
    执行全量角色防死备份
    :param force: 若为 True 则无视 3 日限制强制全量重新备份
    """
    target_dir = get_backup_dir()
    manifest_info = get_backup_manifest()
    
    # 检查 3 日智能频控规则
    if not force and manifest_info.get('has_backup') and manifest_info.get('is_valid_within_3_days'):
        return {
            'status': 'skipped',
            'message': f"3日内（{manifest_info.get('last_backup_time')}）已生成全量角色备份，跳过自动备份。",
            'manifest': manifest_info
        }
        
    char_ids = get_all_character_ids()
    backed_up_list = []
    total_size = 0.0
    
    for cid in char_ids:
        try:
            info = create_full_character_backup(cid, target_dir)
            if info:
                backed_up_list.append(info)
                total_size += info.get('file_size_mb', 0.0)
        except Exception as e:
            print(f'[BACKUP] 备份角色 {cid} 失败: {e}')
            
    now = datetime.now()
    manifest_data = {
        'last_backup_time': now.strftime('%Y-%m-%d %H:%M:%S'),
        'last_backup_timestamp': now.timestamp(),
        'backup_count': len(backed_up_list),
        'total_size_mb': round(total_size, 2),
        'characters': backed_up_list
    }
    
    try:
        with open(MANIFEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f'[BACKUP] 写入 manifest.json 失败: {e}')
        
    return {
        'status': 'success',
        'message': f'已成功全量备份 {len(backed_up_list)} 个角色包至 data/backups/characters/ 目录！',
        'manifest': get_backup_manifest()
    }

def open_backup_folder() -> Tuple[bool, str]:
    """在系统文件资源管理器中打开备份目录"""
    target_dir = get_backup_dir()
    try:
        if os.name == 'nt':
            os.startfile(target_dir)
        else:
            subprocess.Popen(['xdg-open', target_dir])
        return True, '已在资源管理器中打开备份文件夹'
    except Exception as e:
        return False, f'打开备份文件夹失败: {e}'
