@echo off
REM Lanzador local de VantDomus (API + Web) - doble clic para arrancar.
REM Portable: usa la ubicacion del propio .bat (%~dp0), sin rutas hardcodeadas.
title Iniciar VantDomus

set "ROOT=%~dp0"

echo Iniciando API (puerto 8001)...
start "VantDomus API" cmd /k "cd /d "%ROOT%apps\api" && set APP_ENV=demo&& .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

echo Iniciando Web (puerto 3000)...
start "VantDomus Web" cmd /k "cd /d "%ROOT%apps\web" && npm run dev"

echo Esperando a que levante el servidor...
timeout /t 6 >nul
start "" "http://localhost:3000/hogar/90e93e75-7bab-4b75-be70-37a7a8ed3478"

echo.
echo VantDomus arrancando. Deja abiertas las dos ventanas (API y Web).
echo Si el navegador abre antes de que termine de compilar, recarga en unos segundos.
pause
