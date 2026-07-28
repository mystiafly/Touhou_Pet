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
    
    # 拷贝目录
    shutil.copytree("services/characters", os.path.join(clean_dir, "characters"))
    shutil.copytree("services/global_presets", os.path.join(clean_dir, "global_presets"))
    
    # 清洗 global_config.json
    clean_config = {"active_character": "rumia", "custom_engines": []}
    with open(os.path.join(clean_dir, "global_config.json"), "w", encoding="utf-8") as f:
        json.dump(clean_config, f, indent=2, ensure_ascii=False)
        
    # 清洗角色数据
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
    print("开始构建 Rumia Desktop Pet 发行版...")
    print("==================================================")
    
    clean_data_dir = sanitize_data_for_packaging()
    root_dir = os.path.abspath(os.path.dirname(__file__))
    dist_dir = os.path.join(root_dir, "dist")
    
    # 清理旧的构建目录
    print("[0/2] 清理旧的构建目录...")
    if os.path.exists(dist_dir):
        try:
            shutil.rmtree(dist_dir)
        except Exception as e:
            print(f"清理失败: {e}，由于文件被占用（请关闭相关文件夹或程序），打包中止。")
            sys.exit(1)
    os.makedirs(dist_dir, exist_ok=True)
    
    # 1. 构建后端
    print("\n>>> [1/2] 正在使用 PyInstaller 构建 Python 后端 (onedir)...")
    
    # 构建 pyinstaller 命令
    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--name", "web_interface",
        "--onedir",
        "--windowed", # 无控制台黑框
        "--paths", "services",
        "--collect-all", "pydantic",
        "--collect-all", "pydantic_core",
        "--collect-all", "fastapi",
        "--collect-all", "spacy",
        "--collect-all", "en_core_web_sm",
        "--hidden-import", "en_core_web_sm",
        "--copy-metadata", "en_core_web_sm",
        "--collect-all", "mem0",
        "--collect-all", "langchain_google_genai",
        "--collect-all", "langchain_openai",
        "--collect-all", "langchain_community",
        "--add-data", f"{clean_data_dir}/characters{os.pathsep}characters",
        "--add-data", f"{clean_data_dir}/global_presets{os.pathsep}global_presets",
        "--add-data", f"{clean_data_dir}/global_config.json{os.pathsep}.",
        "--add-data", f"services/templates{os.pathsep}templates",
        "--add-data", f"services/static{os.pathsep}static",
        "services/web_interface.py"
    ]
    
    try:
        subprocess.run(pyinstaller_cmd, cwd=root_dir, check=True)
    except subprocess.CalledProcessError:
        print("\n[ERROR] Python 后端构建失败，请检查错误日志。")
        sys.exit(1)
        
    # 将 dist/web_interface 重命名为 dist/backend，适配 package.json
    old_backend = os.path.join(dist_dir, "web_interface")
    new_backend = os.path.join(dist_dir, "backend")
    if os.path.exists(old_backend):
        os.rename(old_backend, new_backend)
        print("Python 后端构建并重命名为 backend 完成！")
    else:
        print(f"\n[ERROR] 未找到生成的后端目录: {old_backend}")
        sys.exit(1)
    
    # 2. 构建前端 (Electron)
    print("\n>>> [2/2] 正在使用 electron-builder 构建前端并打包 NSIS 安装程序...")
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    
    try:
        subprocess.run([npm_cmd, "run", "build"], cwd=root_dir, check=True)
    except subprocess.CalledProcessError:
        print("\n[ERROR] Electron 前端打包失败，请检查错误日志。")
        sys.exit(1)
    
    print("\n[SUCCESS] 发行版构建全部完成！安装包已生成。")

if __name__ == "__main__":
    main()
