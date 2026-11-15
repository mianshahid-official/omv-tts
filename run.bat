@echo off
title OmniVoice Studio
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ================================================================
echo      🎙️  OMNIVOICE STUDIO - DESKTOP LAUNCHER
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
%PY_CMD% -c "import fastapi, uvicorn, pydantic, requests" >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [*] First-time setup detected: Installing required Python packages...
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

:: 3. Launch Menu
echo Select launch mode:
echo   [1] OmniVoice Studio (Modal Cloud T4 GPU - Recommended)
echo       * Ultra-fast synthesis, multi-script bulk runner, zero local GPU needed
echo.
echo   [2] OmniVoice Local Studio (Local CPU/GPU Inference)
echo       * Runs entirely on local machine (requires PyTorch and local weights)
echo.
echo   [3] Pre-download Local Models (k2-fsa/OmniVoice and Whisper)
echo.
echo   [4] Reinstall / Update All Requirements
echo.

set /p CHOICE="Enter choice [1-4] (default is 1): "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    echo.
    echo [*] Starting OmniVoice Studio (Modal Cloud GPU Edition)...
    set PYTHONIOENCODING=utf-8
    set PYTHONUTF8=1
    %PY_CMD% modal_studio_gui.py
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Application exited with error code %errorlevel%.
        pause
    )
    exit /b 0
)

if "%CHOICE%"=="2" (
    echo.
    echo [*] Starting OmniVoice Local Studio...
    set PYTHONIOENCODING=utf-8
    set PYTHONUTF8=1
    %PY_CMD% desktop_app.py
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Application exited with error code %errorlevel%.
        echo Note: Local synthesis requires PyTorch and k2-fsa/OmniVoice.
        pause
    )
    exit /b 0
)

if "%CHOICE%"=="3" (
    echo.
    %PY_CMD% download_models.py
    pause
    exit /b 0
)

if "%CHOICE%"=="4" (
    echo.
    echo [*] Installing dependencies from requirements.txt...
    %PY_CMD% -m pip install --upgrade -r requirements.txt
    echo.
    echo [*] Done!
    pause
    exit /b 0
)

:: Fallback if invalid choice
echo.
echo [*] Starting OmniVoice Studio (Modal Cloud GPU Edition)...
%PY_CMD% modal_studio_gui.py
if %errorlevel% neq 0 pause
