@echo off
chcp 65001 >nul
set HF_ENDPOINT=https://hf-mirror.com
cd /d "%~dp0"

:: 检查是否未解压直接在 ZIP 预览中双击运行
echo "%~dp0" | findstr /i "AppData\Local\Temp" >nul
if not errorlevel 1 (
    echo.
    echo [ERROR] 检测到您可能直接在 ZIP 压缩包内部双击了 start.bat！
    echo [ERROR] 请先将压缩包【完整解压】到电脑的普通文件夹中，然后再运行 start.bat。
    echo.
    pause
    exit /b 1
)

echo [SYSTEM] Clearing orphaned ghost windows and port 5000...
taskkill /F /IM electron.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %%a >nul 2>&1

echo ========================================
echo         Rumia Desktop Pet Startup
echo ========================================
echo.

set PYTHON_EXE=python

if not exist .venv\Scripts\python.exe goto NO_VENV
set PYTHON_EXE=.venv\Scripts\python.exe
echo [SYSTEM] Local virtual environment (.venv) detected. Using it!
goto CHECK_PYTHON

:NO_VENV
echo [WARNING] Local virtual environment (.venv) not found. Using global Python.

:CHECK_PYTHON
%PYTHON_EXE% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto DOWNLOAD_PYTHON

:: 快速启动检查：如果核心依赖已安装，直接秒启动，不再重复跑 pip 下载检查
%PYTHON_EXE% -c "import fastapi, langgraph, mem0, spacy, zh_core_web_sm" >nul 2>&1
if not errorlevel 1 (
    echo [SYSTEM] Dependencies verified! Instant booting...
    goto QUICK_START
)

goto RUN_PIP

:DOWNLOAD_PYTHON
echo [SYSTEM] Python 3.10+ not detected. Automatically downloading and installing Python 3.11...
curl.exe -L -o python_installer.exe https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
if errorlevel 1 goto PYTHON_DL_ERROR
echo [SYSTEM] Download successful! Installing in background (takes ~1 minute, DO NOT CLOSE)...
start /wait python_installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
del python_installer.exe
echo [SYSTEM] Python installed! Re-checking...
set PYTHON_EXE="%LocalAppData%\Programs\Python\Python311\python.exe"
if not exist %PYTHON_EXE% set PYTHON_EXE=python
%PYTHON_EXE% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto PYTHON_DL_ERROR
goto RUN_PIP

:PYTHON_DL_ERROR
echo [ERROR] Automatic Python installation failed. Please download and install manually from https://www.python.org/
pause
exit /b 1

:RUN_PIP
cd /d "%~dp0"
echo.
echo == Step 1/3 == Checking and installing base dependencies...
%PYTHON_EXE% -m pip install -r "%~dp0requirements.txt" --timeout 1000 -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 goto PIP_ERROR

echo [SYSTEM] Checking spacy models...
%PYTHON_EXE% -c "import zh_core_web_sm" >nul 2>&1
if errorlevel 1 (
    echo [SYSTEM] Downloading zh_core_web_sm, this only happens once...
    %PYTHON_EXE% -m pip install https://ghfast.top/https://github.com/explosion/spacy-models/releases/download/zh_core_web_sm-3.8.0/zh_core_web_sm-3.8.0-py3-none-any.whl
)
%PYTHON_EXE% -c "import en_core_web_sm" >nul 2>&1
if errorlevel 1 (
    echo [SYSTEM] Downloading en_core_web_sm, this only happens once...
    %PYTHON_EXE% -m pip install https://ghfast.top/https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
)

goto CHECK_PACKAGES

:PIP_ERROR
echo [ERROR] Dependency installation failed.
pause
exit /b 1

:CHECK_PACKAGES
echo.
echo == Step 2/3 == Validating Flask and Mem0 packages...
%PYTHON_EXE% -c "import flask; print('-> Flask Core OK')" 2>nul
if errorlevel 1 %PYTHON_EXE% -m pip install --force-reinstall flask openai python-dotenv -i https://pypi.tuna.tsinghua.edu.cn/simple

%PYTHON_EXE% -c "import mem0; print('-> Mem0 Memory Agent OK')" 2>nul
if errorlevel 1 %PYTHON_EXE% -m pip install mem0ai sentence-transformers qdrant-client torch -i https://pypi.tuna.tsinghua.edu.cn/simple

:QUICK_START
echo.
echo == Step 3/3 == Waking up Rumia. Please wait...
echo.
set HF_ENDPOINT=https://hf-mirror.com
%PYTHON_EXE% run.py
if errorlevel 1 (
    echo.
    echo [ERROR] 桌宠运行中断或异常退出。请检查上方报错日志。
    pause
)

