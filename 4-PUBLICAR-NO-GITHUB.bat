@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Publicar nova versao no GitHub ===
echo Antes: 1) aumente "version" no package.json  2) escreva as novidades em resources\changelog.json
echo        3) defina o token:  setx GH_TOKEN seu_token_aqui   (feche e abra este arquivo depois)
if "%GH_TOKEN%"=="" (echo.& echo GH_TOKEN nao definido.& pause & exit /b 1)
call npm run release || (echo Falha ao publicar.& pause & exit /b 1)
echo Publicado! Abra a release no GitHub e clique em "Publish release" se estiver como rascunho.
pause
