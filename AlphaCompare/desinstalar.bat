@echo off
setlocal enableextensions
chcp 1252 >nul

set "DST=%APPDATA%\Adobe\CEP\extensions\com.alpha.compare"

echo Removendo Alpha Compare de:
echo   %DST%
echo.

if not exist "%DST%" (
  echo Nada instalado. Nada a fazer.
  echo.
  pause
  exit /b 0
)

rem  rmdir simples so tira o junction; se for pasta copiada, forca com /s /q
rmdir "%DST%" 2>nul
if exist "%DST%" rmdir /s /q "%DST%"

if exist "%DST%" (
  echo [ERRO] Nao consegui remover. Feche o Illustrator e tente de novo.
) else (
  echo OK! Removido. Reinicie o Illustrator.
)
echo.
pause
