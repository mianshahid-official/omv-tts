@echo off
title OmniVoice Studio - In-Place Updater
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ================================================================
echo      🔄 OMNIVOICE STUDIO - IN-PLACE CODE UPDATER
echo ================================================================
echo.

where git >nul 2>nul
if %errorlevel% equ 0 (
    if exist .git (
        echo [*] Pulling latest updates from GitHub...
        git pull origin main
    ) else (
        echo [*] Initializing git remote and fetching latest files...
        git init
        git remote add origin https://github.com/mianshahid-official/omv-tts.git
        git fetch origin main
        git reset --hard origin/main
    )
    if !errorlevel! equ 0 (
        echo.
        echo [✓] Updated successfully to latest version!
        pause
        exit /b 0
    )
)

echo [*] Updating files via GitHub archive...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/mianshahid-official/omv-tts/archive/refs/heads/main.zip' -OutFile 'patch.zip'; Expand-Archive -Path 'patch.zip' -DestinationPath 'patch_temp' -Force; Copy-Item -Path 'patch_temp\omv-tts-main\*' -Destination '.' -Recurse -Force; Remove-Item 'patch.zip', 'patch_temp' -Recurse -Force; Write-Host '[✓] All code files updated to latest version!'"

echo.
echo ================================================================
echo      ✓ UPDATE COMPLETE! Stored models were preserved.
echo ================================================================
pause
exit /b 0
