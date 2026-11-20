@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Gerando instalador e versao portatil (pasta release) ===
call npm run dist || (echo Falha ao gerar.& pause & exit /b 1)
start "" "%~dp0release"
echo Pronto!
pause
