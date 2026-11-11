@echo off
title Casting Bounce - localhost:2400
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org & pause & exit /b)
if not exist node_modules (call npm install || (pause & exit /b))
echo.
echo Site:   http://localhost:2400
echo Painel: http://localhost:2400/admin.html
echo Para parar: feche esta janela.
echo.
start "API casting (3001)" /min node server.js
call npx vite --port 2400 --strictPort --open /admin.html
pause
