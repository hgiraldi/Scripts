@echo off
setlocal enableextensions
chcp 1252 >nul

echo ============================================================
echo   AlphaScreening - desinstalador
echo ============================================================
echo.

set "DST=%APPDATA%\Adobe\CEP\extensions\com.alpha.screening"

if not exist "%DST%" (
  echo Nada instalado em:
  echo   %DST%
  echo.
  pause
  exit /b 0
)

echo Removendo o link/pasta da extensao...
rmdir "%DST%" 2>nul
if exist "%DST%" rmdir /s /q "%DST%"

echo.
if exist "%DST%" (
  echo [ERRO] Nao consegui remover. Feche o Illustrator e tente de novo.
) else (
  echo OK! AlphaScreening removido. O repositorio nao foi tocado.
)
echo.
pause
