@echo off
title VantDomus B2B Command Center
echo ========================================================
echo        INICIANDO VANTDOMUS B2B COMMAND CENTER
echo            INTEGRACION ESTANDAR
echo ========================================================
echo.

echo [1/2] Levantando el Core de Inteligencia (Python FastAPI)...
start "VantDomus - Backend API" cmd /k "cd /d "%~dp0\vantdomus_core" && python -m uvicorn app.main:app --host 0.0.0.0 --port 12801 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Levantando la Central de Mando (React Next.js)...
start "VantDomus - Frontend Dashboard" cmd /k "cd /d "%~dp0\vantdomus_panel" && npx next dev -p 3010"

echo.
echo Los servidores se estan iniciando en dos ventanas negras separadas.
echo.
echo === INSTRUCCIONES ===
echo Una vez que ambas ventanas dejen de cargar, abre tu navegador y entra a:
echo http://localhost:3010/ceo
echo.
echo (Puedes cerrar esta ventana, pero NO cierres las dos que se acaban de abrir).
pause
