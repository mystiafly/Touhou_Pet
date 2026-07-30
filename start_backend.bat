@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [SYSTEM] Clearing orphaned port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %%a >nul 2>&1

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
%PYTHON_EXE% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto PYTHON_DL_ERROR
goto RUN_PIP

:PYTHON_DL_ERROR
echo [ERROR] Automatic Python installation failed. Please download and install manually from https://www.python.org/
pause
exit /b 1

:RUN_PIP
echo == Step 1/2 == Checking and installing dependencies...
%PYTHON_EXE% -m pip install -r requirements.txt --timeout 1000 -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 goto PIP_ERROR
goto START_BACKEND

:PIP_ERROR
echo [ERROR] Dependency installation failed.
exit /b 1

:START_BACKEND
echo == Step 2/2 == Starting Backend API...
set HF_ENDPOINT=https://hf-mirror.com
cd services
%PYTHON_EXE% web_interface.py
