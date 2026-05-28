@echo off
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
goto RUN_PIP

:PYTHON_ERROR
echo [ERROR] Python not found. Please install Python first!
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
%PYTHON_EXE% run.py

