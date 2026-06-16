@echo off
title VantDomus Panel Web Administrativo
color 0B

echo ===================================================
echo   Iniciando VantDomus Panel Administrativo Local
echo ===================================================
echo.
echo Presiona Ctrl+C para detener el servidor web en cualquier momento.
echo.

cd /d "%~dp0\vantdomus_panel"
npm run dev -- -p 3005

pause
