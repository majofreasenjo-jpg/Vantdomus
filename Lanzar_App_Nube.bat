@echo off
title Lanzador VantUnit (Conectado a la Nube)
color 0B
echo ================================================================
echo        INICIANDO VANTUNIT MOBILE (CONEXION A PRODUCCION)
echo ================================================================
echo.
echo Limpiando cache de red...
taskkill /F /IM node.exe >nul 2>&1

echo Conectando al repositorio movil...
cd /d "D:\Aplicaciones de Juegos\VantDomus\vantdomus_mobile"

echo.
echo ================================================================
echo   1. Abre la app "Expo Go" en tu celular.
echo   2. Escanea el codigo QR gigante que aparecera a continuacion.
echo.
echo   [Nota]: La app se conectara al "Cerebro" alojado en Render.
echo ================================================================
echo.

echo Arrancando puente de conexion...
echo.
call npx expo start -c

pause
