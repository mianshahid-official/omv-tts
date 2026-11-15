@echo off
title OmniVoice Studio - Modal Cloud GPU Edition
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================================
echo   OmniVoice Studio - Modal Cloud GPU Desktop Launcher
echo ========================================================
echo.

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python is not installed or not in your system PATH!
        echo Please install Python 3.10+ from https://www.python.org/downloads/
        echo (Check "Add Python to PATH" during installation)
        pause
        exit /b 1
    )
    set PY_CMD=py
) else (
    set PY_CMD=python
)

:: Check basic dependencies
echo [*] Checking dependencies...
%PY_CMD% -c "import fastapi, uvicorn, pydantic, requests" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Installing required packages...
    %PY_CMD% -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed installing packages.
        pause
        exit /b 1
    )
)

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
echo [*] Launching OmniVoice Modal Studio...
%PY_CMD% modal_studio_gui.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application exited with error code %errorlevel%.
    pause
)
