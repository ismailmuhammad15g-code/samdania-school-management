@echo off
chcp 65001 >nul
title Auto Git Push
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed. Download it from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

node "%~dp0push.cjs"

echo.
pause
