import os
import subprocess
import shutil
import sys
import json

def sanitize_data_for_packaging():
    print("[0.5/2] 正在清洗测试数据并生成纯净出厂模板...")
    clean_dir = "build/clean_data"
    if os.path.exists(clean_dir):
        shutil.rmtree(clean_dir)
    os.makedirs(clean_dir, exist_ok=True)
    
    ignore_func = shutil.ignore_patterns("qdrant_db", "daily_history", "*.db", "*.lock", "*.log", "__pycache__")
    shutil.copytree("services/characters", os.path.join(clean_dir, "characters"), ignore=ignore_func)
    shutil.copytree("services/global_presets", os.path.join(clean_dir, "global_presets"), ignore=ignore_func)
    
    clean_config = {"active_character": "rumia", "custom_engines": []}
    with open(os.path.join(clean_dir, "global_config.json"), "w", encoding="utf-8") as f:
        json.dump(clean_config, f, indent=2, ensure_ascii=False)
        
    for char in os.listdir(os.path.join(clean_dir, "characters")):
        char_dir = os.path.join(clean_dir, "characters", char)
        if not os.path.isdir(char_dir): continue
            
        config_path = os.path.join(char_dir, "config.json")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                c = json.load(f)
            c["distilled_dates"] = []
            c["user_prompt"] = "我是一个神隐到幻想乡的外界男性，对这里一无所知，被你从昏迷中救了过来。"
            c["app_launcher"] = {}
            c["enable_greeting"] = True
            c["enable_auto_speak"] = True
            c["auto_speak_multiplier"] = 1.0
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(c, f, indent=2, ensure_ascii=False)
                
        with open(os.path.join(char_dir, "favorability.json"), "w", encoding="utf-8") as f: json.dump({"score": 60}, f, indent=2)
        with open(os.path.join(char_dir, "dialog_history.json"), "w", encoding="utf-8") as f: f.write("[]")
        with open(os.path.join(char_dir, "databank_state.json"), "w", encoding="utf-8") as f: f.write('{"nodes": [], "edges": []}')
        with open(os.path.join(char_dir, "user_profile.json"), "w", encoding="utf-8") as f: f.write("{}")
            
        daily = os.path.join(char_dir, "daily_history")
        if os.path.exists(daily): shutil.rmtree(daily)
        qdrant = os.path.join(char_dir, "qdrant_db")
        if os.path.exists(qdrant): shutil.rmtree(qdrant)
    return clean_dir

def main():
    print("==================================================")
    print("开始构建 Rumia Desktop Pet 官方双版本发行版...")
    print("==================================================")
    
    clean_data_dir = sanitize_data_for_packaging()
    root_dir = os.path.abspath(os.path.dirname(__file__))
    dist_dir = os.path.join(root_dir, "dist")
    installer_dir = os.path.join(dist_dir, "installer")
    
    # 1. 构建 Python 后端
    new_backend = os.path.join(dist_dir, "backend")
    existing_exe = os.path.join(new_backend, "web_interface.exe")
    force_rebuild = "--rebuild-backend" in sys.argv
    
    if os.path.exists(existing_exe) and not force_rebuild:
        print("\n>>> [1/3] [极速模式] 检测到已存在预编译后端 dist/backend，跳过 PyInstaller 耗时构建...")
    else:
        print("\n>>> [1/3] 正在使用 PyInstaller 构建 Python 预编译后端 (onedir)...")
        pyinstaller_cmd = [
            sys.executable, "-m", "PyInstaller",
            "--noconfirm",
            "web_interface.spec"
        ]
        
        try:
            subprocess.run(pyinstaller_cmd, cwd=root_dir, check=True)
        except subprocess.CalledProcessError as e:
            print("\n[ERROR] Python 后端构建失败:", e)
            sys.exit(1)
            
        old_backend = os.path.join(dist_dir, "web_interface")
        if os.path.exists(old_backend):
            if os.path.exists(new_backend):
                shutil.rmtree(new_backend)
            os.rename(old_backend, new_backend)
            print("Python 后端构建并重命名为 dist/backend 完成！")
        elif not os.path.exists(existing_exe):
            print(f"\n[ERROR] 未找到生成的后端目录: {old_backend}")
            sys.exit(1)
    
    npx_cmd = "npx.cmd" if os.name == 'nt' else "npx"
    
    # 2. 构建【完整独立版】(Full Edition)
    print("\n>>> [2/3] 正在构建【完整独立版】(Rumia Desktop Pet Full Setup.exe)...")
    full_config = {
        "electronVersion": "28.3.3",
        "productName": "Rumia Desktop Pet (Full)",
        "artifactName": "Rumia Desktop Pet Full Setup ${version}.${ext}",
        "extraFiles": [
            {"from": "dist/backend", "to": "dist/backend"}
        ],
        "extraResources": [
            {"from": "dist/backend", "to": "dist/backend"}
        ]
    }
    full_cfg_path = os.path.join(root_dir, "build_full.json")
    with open(full_cfg_path, "w", encoding="utf-8") as f:
        json.dump(full_config, f, indent=2)

    try:
        subprocess.run([npx_cmd, "electron-builder", "--win", "-c", "build_full.json"], cwd=root_dir, check=True)
        print("[SUCCESS] 【完整独立版】打包成功！")
    except subprocess.CalledProcessError as e:
        print("\n[ERROR] 完整独立版打包失败:", e)
        sys.exit(1)
    finally:
        if os.path.exists(full_cfg_path):
            os.remove(full_cfg_path)

    # 3. 构建【极简轻量版】(Lite Edition)
    print("\n>>> [3/3] 正在构建【极简轻量版】(Rumia Desktop Pet Lite Setup.exe)...")
    lite_config = {
        "electronVersion": "28.3.3",
        "productName": "Rumia Desktop Pet (Lite)",
        "artifactName": "Rumia Desktop Pet Lite Setup ${version}.${ext}",
        "extraFiles": [
            {"from": ".node_env", "to": ".node_env"}
        ]
    }
    lite_cfg_path = os.path.join(root_dir, "build_lite.json")
    with open(lite_cfg_path, "w", encoding="utf-8") as f:
        json.dump(lite_config, f, indent=2)

    try:
        subprocess.run([npx_cmd, "electron-builder", "--win", "-c", "build_lite.json"], cwd=root_dir, check=True)
        print("[SUCCESS] 【极简轻量版】打包成功！")
    except subprocess.CalledProcessError as e:
        print("\n[ERROR] 极简轻量版打包失败:", e)
        sys.exit(1)
    finally:
        if os.path.exists(lite_cfg_path):
            os.remove(lite_cfg_path)

    # 4. 移动安装包到 installer 目录
    os.makedirs(installer_dir, exist_ok=True)
    dist_dir = os.path.join(root_dir, "dist")
    for item in os.listdir(dist_dir):
        if item.endswith(".exe") or item.endswith(".blockmap") or item.endswith(".yml"):
            src = os.path.join(dist_dir, item)
            dst = os.path.join(installer_dir, item)
            if os.path.isfile(src):
                shutil.copy2(src, dst)

    print("==================================================")
    print(f"[ALL SUCCESS] 双版本发行版构建全部完成！安装包已输出到: '{installer_dir}'")
    print("==================================================")

if __name__ == "__main__":
    main()
