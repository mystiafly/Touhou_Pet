@echo off
chcp 65001 >nul
set HF_ENDPOINT=https://hf-mirror.com
cd /d "%~dp0"

:: Auto-guarded process launcher to prevent console auto-close on crash
if not "%~1"=="--guarded" (
    cmd /c ""%~f0" --guarded %*"
    exit /b %ERRORLEVEL%
)

:: Check if running directly inside ZIP preview
echo "%~dp0" | findstr /i "AppData\Local\Temp" >nul
if not errorlevel 1 (
    echo.
    echo [ERROR] Detected running inside ZIP preview!
    echo [ERROR] Please extract the full ZIP folder before running start.bat.
    goto ALWAYS_FREEZE
)

echo [SYSTEM] Clearing old processes and port 5000...
taskkill /F /IM electron.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr /v " 0$" ^| findstr /v " 0 "') do if not "%%a"=="0" taskkill /f /pid %%a >nul 2>&1

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
echo [WARNING] Local .venv not found. Using global Python.
if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set PYTHON_EXE="%LocalAppData%\Programs\Python\Python311\python.exe"
if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set PYTHON_EXE="%LocalAppData%\Programs\Python\Python312\python.exe"
if exist "%LocalAppData%\Programs\Python\Python310\python.exe" set PYTHON_EXE="%LocalAppData%\Programs\Python\Python310\python.exe"
if exist "%ProgramFiles%\Python311\python.exe" set PYTHON_EXE="%ProgramFiles%\Python311\python.exe"
if exist "%ProgramFiles%\Python312\python.exe" set PYTHON_EXE="%ProgramFiles%\Python312\python.exe"
if exist "%ProgramFiles%\Python310\python.exe" set PYTHON_EXE="%ProgramFiles%\Python310\python.exe"

:CHECK_PYTHON
%PYTHON_EXE% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto DOWNLOAD_PYTHON

%PYTHON_EXE% -c "import fastapi, langgraph, mem0, spacy, zh_core_web_sm" >nul 2>&1
if not errorlevel 1 (
    echo [SYSTEM] Dependencies verified! Instant booting...
    goto QUICK_START
)

goto RUN_PIP

:DOWNLOAD_PYTHON
echo [SYSTEM] Python 3.10+ not detected. Automatically downloading Python 3.11...
curl.exe -L -o python_installer.exe https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
if errorlevel 1 goto PYTHON_DL_ERROR
echo [SYSTEM] Download successful! Installing in background...
start /wait python_installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
del python_installer.exe
echo [SYSTEM] Python installed! Re-checking...
set PYTHON_EXE="%LocalAppData%\Programs\Python\Python311\python.exe"
if not exist %PYTHON_EXE% set PYTHON_EXE=python
%PYTHON_EXE% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto PYTHON_DL_ERROR
goto RUN_PIP

:PYTHON_DL_ERROR
echo [ERROR] Automatic Python installation failed. Please install manually.
goto ALWAYS_FREEZE

:RUN_PIP
cd /d "%~dp0"
echo.
echo == Step 1/3 == Installing base dependencies...
%PYTHON_EXE% -m pip install -r "%~dp0requirements.txt" --timeout 1000 -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 goto PIP_ERROR

echo [SYSTEM] Checking spacy models...
%PYTHON_EXE% -c "import zh_core_web_sm" >nul 2>&1
if errorlevel 1 (
    echo [SYSTEM] Downloading zh_core_web_sm...
    %PYTHON_EXE% -m pip install https://ghfast.top/https://github.com/explosion/spacy-models/releases/download/zh_core_web_sm-3.8.0/zh_core_web_sm-3.8.0-py3-none-any.whl
)
%PYTHON_EXE% -c "import en_core_web_sm" >nul 2>&1
if errorlevel 1 (
    echo [SYSTEM] Downloading en_core_web_sm...
    %PYTHON_EXE% -m pip install https://ghfast.top/https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
)

goto CHECK_PACKAGES

:PIP_ERROR
echo [ERROR] Dependency installation failed.
goto ALWAYS_FREEZE

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
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% NEQ 0 (
    echo.
    echo [ERROR] Desktop pet execution interrupted with code %EXIT_CODE%. See logs above.
    goto ALWAYS_FREEZE
)

echo.
echo [SYSTEM] Desktop pet closed cleanly. Goodbye!
exit /b 0

:ALWAYS_FREEZE
echo.
echo =======================================================
echo [SYSTEM] Console locked to prevent auto-close.
echo Check the logs above to resolve issues.
echo =======================================================
pause
goto ALWAYS_FREEZE
