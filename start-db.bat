@echo off
:: start-db.bat — Levanta el contenedor PostgreSQL de stc-produccion-v2
:: Requiere Podman instalado y la machine ya configurada.

powershell -ExecutionPolicy Bypass -File "%~dp0start-db.ps1"
pause
