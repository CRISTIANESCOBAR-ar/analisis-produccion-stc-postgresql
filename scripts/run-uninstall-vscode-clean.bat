@echo off
setlocal

set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%uninstall-vscode-clean.ps1

if not exist "%PS_SCRIPT%" (
  echo [ERROR] No se encontro el script: %PS_SCRIPT%
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Limpieza completa de Visual Studio Code
echo ============================================
echo.
echo Este proceso debe ejecutarse como Administrador.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process PowerShell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%PS_SCRIPT%""'"

echo.
echo Se solicito elevacion de permisos. Revisa la ventana de PowerShell abierta.
pause
