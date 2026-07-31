@echo off
echo ============================================================
echo Actualizando tareas programadas de Podman y WSL...
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0register-tasks.ps1"
echo.
echo Tareas actualizadas exitosamente. Ya puedes cerrar esta ventana.
pause
