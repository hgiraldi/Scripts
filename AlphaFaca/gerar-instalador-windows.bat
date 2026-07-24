@echo off
REM ================================================================
REM  Alpha Faca - gerar instalador do Windows (.exe)
REM  Clique com o botao DIREITO e escolha "Executar como administrador".
REM ================================================================
cd /d "C:\Program Files\Adobe\Adobe Illustrator 2022\Presets\en_US\Scripts\AlphaFaca"
title Alpha Faca - gerando instalador

echo.
echo === Limpando cache anterior (winCodeSign) e dist ===
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" 2>nul
rmdir /s /q "dist" 2>nul

echo.
echo === Compilando o instalador (pode levar alguns minutos) ===
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run dist:win

echo.
if exist "dist\Alpha Faca Setup*.exe" (
  echo ============================================================
  echo  PRONTO! O instalador esta em:
  echo  C:\Program Files\Adobe\Adobe Illustrator 2022\Presets\en_US\Scripts\AlphaFaca\dist
  echo ============================================================
) else (
  echo ============================================================
  echo  Algo falhou. Confira as mensagens acima.
  echo  (Rodou como Administrador?)
  echo ============================================================
)
echo.
pause
