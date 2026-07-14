@echo off
setlocal enableextensions
chcp 1252 >nul

echo ============================================================
echo   AlphaPack - instalador (teste)
echo ============================================================
echo.

rem  Caminho ABSOLUTO do repo -> funciona rodando de qualquer lugar
set "SRC=C:\Program Files\Adobe\Adobe Illustrator 2022\Presets\en_US\Scripts\AlphaPack\com.alpha.pack"
set "EXTDIR=%APPDATA%\Adobe\CEP\extensions"
set "DST=%EXTDIR%\com.alpha.pack"

if not exist "%SRC%" (
  echo [ERRO] Nao encontrei a pasta da extensao:
  echo        %SRC%
  echo.
  pause
  exit /b 1
)

echo [1/3] Habilitando extensoes nao assinadas (PlayerDebugMode)...
for %%V in (9 10 11) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
)

echo [2/3] Preparando a pasta de extensoes do CEP...
if not exist "%EXTDIR%" mkdir "%EXTDIR%"

if exist "%DST%" (
  echo       Removendo instalacao anterior...
  rmdir "%DST%" 2>nul
  if exist "%DST%" rmdir /s /q "%DST%"
)

echo [3/3] Criando o link (junction) para o repo...
mklink /J "%DST%" "%SRC%" >nul 2>&1

if not exist "%DST%" (
  echo       Link falhou; copiando os arquivos em vez de linkar...
  xcopy "%SRC%" "%DST%\" /E /I /Y >nul
)

echo.
if exist "%DST%" (
  echo ============================================================
  echo   OK! Instalado em:
  echo   %DST%
  echo.
  echo   Feche e abra o Illustrator e va em:
  echo   Janela ^> Extensoes ^> AlphaPack
  echo ============================================================
) else (
  echo [ERRO] Nao consegui instalar. Chame o Henrique/Claude.
)
echo.
pause
