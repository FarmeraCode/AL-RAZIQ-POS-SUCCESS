@echo off
title Al Raziq POS - Auto-Restart Engine
cd /d "%~dp0"

echo ---------------------------------------------------
echo  AL RAZIQ POS - ROBUST ONE-CLICK LAUNCHER
echo ---------------------------------------------------
echo.

:: Open the browser window once
echo Launching App Window...
start http://localhost:5173/
echo.

:start_server
echo [%time%] Starting Al Raziq POS System...
echo.
:: Run the engine. The batch file will wait here until the server exits.
node scripts/dev-lan.mjs

echo.
echo [WARNING] Server stopped unexpectedly! 
echo Restarting in 5 seconds...
echo ---------------------------------------------------
timeout /t 5 /nobreak >nul
goto start_server
