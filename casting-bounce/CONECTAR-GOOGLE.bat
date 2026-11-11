@echo off
title Conectar ao Google Drive
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b)
if not exist node_modules call npm install
call npm run google
pause
