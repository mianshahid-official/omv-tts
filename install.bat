@echo off
@chcp 65001 >nul
title OmniVoice Studio - Automated One-Click Installer
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ================================================================
echo      [OMNIVOICE STUDIO - ONE-CLICK INSTALLER & SETUP]
echo ================================================================
echo.
echo This installer will:
echo   1. Verify your Python environment
echo   2. Install all required dependencies (Core + PyTorch + OmniVoice)
echo   3. Download the OmniVoice neural models to local storage
echo   4. Automatically launch OmniVoice Local Studio
echo.

:: 1. Check Python
echo [*] Step 1/3: Checking Python installation...
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Python is not installed or not in your system PATH!
        echo.
        echo Please download and install Python 3.10, 3.11, or 3.12 from:
        echo    https://www.python.org/downloads/
        echo.
        echo IMPORTANT: Make sure to check the box "Add Python to PATH" during install!
        echo.
        pause
        exit /b 1
    )
    set PY_CMD=py
) else (
    set PY_CMD=python
)

for /f "tokens=*" %%v in ('%PY_CMD% --version 2^>^&1') do set PY_VER=%%v
echo   [OK] Found Python: !PY_VER!
echo.

:: 2. Install requirements
echo [*] Step 2/3: Checking & installing required Python packages...
echo   [*] Updating pip if needed...
%PY_CMD% -m pip install --upgrade pip >nul 2>nul

echo   [*] Installing core packages from requirements.txt...
%PY_CMD% -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install requirements from requirements.txt!
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)
echo   [OK] Core packages installed successfully!
echo.

echo   [*] Checking PyTorch & OmniVoice neural engine for local free TTS...
%PY_CMD% -c "import torch, omnivoice" >nul 2>nul
if %errorlevel% neq 0 (
    echo   [*] Installing local neural engine dependencies (PyTorch & OmniVoice)...
    %PY_CMD% -m pip install -r requirements-local.txt
    if !errorlevel! neq 0 (
        echo.
        echo [WARNING] PyTorch installation note: PyTorch can also be installed later.
        echo Modal Cloud GPU synthesis will remain available.
    ) else (
        echo   [OK] Local neural engine installed successfully!
    )
) else (
    echo   [OK] PyTorch & OmniVoice are already installed!
)
echo.

:: 3. Download models to local storage
echo [*] Step 3/3: Verifying and downloading OmniVoice neural models...
echo   Target storage: %~dp0models\omnivoice
echo.
%PY_CMD% download_models.py
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Model download encountered an issue.
    echo You can re-run download_models.py at any time.
    echo.
    pause
) else (
    echo.
    echo   [OK] All neural model assets are verified and ready!
)
echo.

:: 4. Auto-launch run.bat
echo ================================================================
echo      [INSTALLATION COMPLETE] Launching OmniVoice Studio...
echo ================================================================
echo.
timeout /t 2 >nul 2>nul
call run.bat
exit /b 0
