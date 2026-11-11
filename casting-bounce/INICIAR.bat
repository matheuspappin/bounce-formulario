@echo off
title Casting Bounce Basement
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b)
if not exist node_modules (
  echo Instalando dependencias...
  call npm install || (pause & exit /b)
)
echo.
echo Formulario: http://localhost:5173
echo Para parar: feche esta janela ou aperte Ctrl+C
echo.
call npm run dev
pause
