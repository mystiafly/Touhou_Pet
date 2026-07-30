@echo off
chcp 65001 >nul
cd /d "%~dp0"

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
%PYTHON_EXE% --version >nul 2>&1
if errorlevel 1 goto DOWNLOAD_PYTHON
goto RUN_PIP

:DOWNLOAD_PYTHON
echo [SYSTEM] 未检测到 Python，正在为您全自动下载并静默安装 Python 3.11...
curl.exe -L -o python_installer.exe https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
if errorlevel 1 goto PYTHON_DL_ERROR
echo [SYSTEM] 下载成功！正在后台安装 (约需1分钟，请勿关闭窗口)...
start /wait python_installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
del python_installer.exe
echo [SYSTEM] Python 安装完毕！正在重新检测...
set PYTHON_EXE="%LocalAppData%\Programs\Python\Python311\python.exe"
%PYTHON_EXE% --version >nul 2>&1
if errorlevel 1 goto PYTHON_DL_ERROR
goto RUN_PIP

:PYTHON_DL_ERROR
echo [ERROR] 自动安装 Python 失败。请您手动前往 https://www.python.org/ 下载并安装！
pause
exit /b 1

:RUN_PIP
echo.
echo == Step 1/3 == Checking and installing base dependencies...
%PYTHON_EXE% -m pip install -r requirements.txt
if errorlevel 1 goto PIP_ERROR
goto CHECK_PACKAGES

:PIP_ERROR
echo [ERROR] Dependency installation failed.
pause
exit /b 1

:CHECK_PACKAGES
echo.
echo == Step 2/3 == Validating Flask and Mem0 packages...
%PYTHON_EXE% -c "import flask; print('-> Flask Core OK')" 2>nul
if errorlevel 1 %PYTHON_EXE% -m pip install --force-reinstall flask openai python-dotenv

%PYTHON_EXE% -c "import mem0; print('-> Mem0 Memory Agent OK')" 2>nul
if errorlevel 1 %PYTHON_EXE% -m pip install mem0ai sentence-transformers qdrant-client torch

echo.
echo == Step 3/3 == Waking up Rumia. Please wait...
echo.
%PYTHON_EXE% run.py <nul

