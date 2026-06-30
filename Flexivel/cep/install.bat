@echo off
REM ============================================================
REM Instalador Windows (DUPLO CLIQUE) dos paineis Alpha - autossuficiente.
REM Instala qualquer pasta com.alpha.* que estiver JUNTO deste arquivo
REM (serve p/ Ondulado e Flexivel). Liga o PlayerDebugMode (CSXS 9..12).
REM ============================================================
setlocal
set "ALPHA_SRC=%~dp0"
echo Instalando painel Alpha...
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach($v in 9,10,11,12){$k='HKCU:\Software\Adobe\CSXS.'+$v; if(-not(Test-Path $k)){$null=New-Item $k -Force}; $null=New-ItemProperty $k -Name PlayerDebugMode -Value '1' -PropertyType String -Force}; $srcDir=Get-ChildItem -Path $env:ALPHA_SRC -Directory -Filter 'com.alpha.*' | Select-Object -First 1; if(-not $srcDir){Write-Host 'ERRO: pasta com.alpha.* nao esta junto deste instalador.' -ForegroundColor Red; exit 1}; $dst=Join-Path $env:APPDATA ('Adobe\CEP\extensions\'+$srcDir.Name); if(Test-Path $dst){Remove-Item $dst -Recurse -Force}; $null=New-Item -ItemType Directory -Force $dst; Copy-Item (Join-Path $srcDir.FullName '*') $dst -Recurse -Force; Write-Host ('OK! '+$srcDir.Name+' instalado em '+$dst) -ForegroundColor Green"
echo.
echo Reinicie o Illustrator: Janela ^> Extensoes
pause
