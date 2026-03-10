@echo off
title VantDomus Mobile Server
echo =======================================================
echo     Levantando Servidor Expo para VantDomus Mobile 📱
echo =======================================================
echo.
echo Limpiando procesos de Expo / Node fantasma... (puedes ignorar errores aqui)
taskkill /F /IM node.exe >nul 2>&1

echo.
echo Entrando al directorio correcto del proyecto movil...
cd /d "D:\Aplicaciones de Juegos\VantDomus\vantdomus_mobile"

echo.
echo Arrancando el empaquetador de la SDK de React Native...
call npx expo start -c

echo.
pause
