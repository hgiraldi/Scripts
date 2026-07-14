@echo off
setlocal
chcp 1252 >nul
title Instalar Alpha Screen
echo ============================================================
echo   Alpha Screen - instalacao (uma vez)
echo ============================================================
echo.
set "SRC=%~dp0"
set "DST=%USERPROFILE%\AlphaScreenApp"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a LTS em https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo [1/2] Copiando o app para pasta gravavel: %DST%
robocopy "%SRC%." "%DST%" /E /XD node_modules .git >nul

echo [2/2] Baixando Electron + pdf-lib...
cd /d "%DST%"
call npm install --no-audit --no-fund
echo.
if exist "%DST%\node_modules\electron" ( echo OK! Abra com "Alpha Screen.bat".
) else ( echo [ERRO] Falhou o npm install. )
echo.
pause
