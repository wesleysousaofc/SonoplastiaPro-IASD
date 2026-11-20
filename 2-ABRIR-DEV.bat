@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Abrindo o SonoplastiaPro em modo de desenvolvimento (o que voce editar atualiza na hora)...
call npm run dev
pause
