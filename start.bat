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
if errorlevel 1 goto PYTHON_ERROR
goto CHECK_PACKAGES

:PYTHON_ERROR
echo [ERROR] Python not found. Please install Python first!
pause
exit /b 1

:CHECK_PACKAGES
echo.
echo == Step 1/2 == Validating core packages...
%PYTHON_EXE% -c "import flask, mem0, fastapi, uvicorn, langchain, langgraph, bs4, requests" >nul 2>&1
if errorlevel 1 goto RUN_PIP
echo [SYSTEM] Core packages validated successfully! Skipping slow pip install.
goto RUN_APP

:RUN_PIP
echo.
echo == Step 2/2 == Checking and installing base dependencies (this may take a while)...
%PYTHON_EXE% -m pip install -r requirements.txt
if errorlevel 1 goto PIP_ERROR
goto RUN_APP

:PIP_ERROR
echo [ERROR] Dependency installation failed.
pause
exit /b 1

:RUN_APP
echo.
echo == Step 2/2 == Waking up Rumia. Please wait...
echo.
%PYTHON_EXE% run.py <nul


