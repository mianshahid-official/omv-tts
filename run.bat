@echo off
@chcp 65001 >nul
title OmniVoice Local Studio
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ================================================================
echo      [OMNIVOICE LOCAL STUDIO - FREE NEURAL TTS]
echo ================================================================
echo.

:: 1. Check for Python in PATH
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python is not installed or not in your system PATH!
        echo.
        echo Please install Python 3.10, 3.11, or 3.12 from:
        echo    https://www.python.org/downloads/
        echo.
        echo IMPORTANT: Check the box "Add Python to PATH" during installation.
        echo.
        pause
        exit /b 1
    )
    set PY_CMD=py
) else (
    set PY_CMD=python
)

:: 2. Auto-check required basic packages
echo [*] Checking required dependencies...
%PY_CMD% -c "import fastapi, uvicorn, pydantic, requests, huggingface_hub" >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [*] First-time setup: Installing required Python packages...
    echo [*] Running: %PY_CMD% -m pip install -r requirements.txt
    echo.
    %PY_CMD% -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies!
        echo Please check your internet connection or install manually with:
        echo    pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    )
    echo [*] Dependencies installed successfully!
    echo.
)

:: 3. Launch OmniVoice Local Studio
echo [*] Starting OmniVoice Local Studio on http://127.0.0.1:8000...
echo.
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
%PY_CMD% desktop_app.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application exited with error code %errorlevel%.
    pause
)
exit /b 0
