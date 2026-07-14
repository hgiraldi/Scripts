@echo off
setlocal
title Alpha Screen
set "DST=%USERPROFILE%\AlphaScreenApp"
if not exist "%DST%\node_modules\electron" (
  echo Rode "Instalar Alpha Screen.bat" primeiro.
  pause
  exit /b 1
)
cd /d "%DST%"
start "" /min cmd /c "npm start"
