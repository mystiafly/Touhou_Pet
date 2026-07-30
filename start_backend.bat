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
%PYTHON_EXE% --version >nul 2>&1
if errorlevel 1 goto PYTHON_ERROR
goto RUN_PIP

:PYTHON_ERROR
echo [ERROR] Python not found. Please install Python first!
exit /b 1

:RUN_PIP
echo == Step 1/2 == Checking and installing dependencies...
%PYTHON_EXE% -m pip install -r requirements.txt
if errorlevel 1 goto PIP_ERROR
goto START_BACKEND

:PIP_ERROR
echo [ERROR] Dependency installation failed.
exit /b 1

:START_BACKEND
echo == Step 2/2 == Starting Backend API...
cd services
%PYTHON_EXE% web_interface.py
