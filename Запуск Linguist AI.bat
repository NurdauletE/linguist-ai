@echo off
chcp 65001 >nul
title Linguist AI
cd /d "%~dp0"

echo Starting Linguist AI...
start "Linguist AI — сервер" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Browser opened. To stop the server, close the server window.
pause
