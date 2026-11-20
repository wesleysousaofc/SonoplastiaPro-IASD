@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === SonoplastiaPro - IASD : instalando dependencias ===
where node >nul 2>nul || (echo.& echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo.& pause & exit /b 1)
call npm install || (echo Falha no npm install.& pause & exit /b 1)
call npm run setup
echo.
echo Pronto! Agora use o 2-ABRIR-DEV.bat
pause
