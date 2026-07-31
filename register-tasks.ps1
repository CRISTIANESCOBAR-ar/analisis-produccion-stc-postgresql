# ============================================================
# register-tasks.ps1
# Registra las tareas programadas necesarias para el arranque
# de Podman y WSL Service con los privilegios adecuados.
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$autoStartScript = Join-Path $scriptDir "auto-start-podman.ps1"

Write-Host "Verificando ruta del script: $autoStartScript" -ForegroundColor Cyan

if (-not (Test-Path $autoStartScript)) {
    throw "No se encontró el script auto-start-podman.ps1 en $autoStartScript"
}

# 1. Definir las acciones
$actAdmin = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$autoStartScript`" -ServiceOnly"
$actUser  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$autoStartScript`""

# 2. Definir triggers y settings comunes
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# 3. Definir los principales (Contexto de usuario y elevación)
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
Write-Host "Registrando tareas para el usuario: $currentUser" -ForegroundColor Cyan

$pAdmin = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
$pUser  = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

# 4. Eliminar la tarea antigua si existe para evitar conflictos
Write-Host "Removiendo tarea antigua PodmanAutoStartAdmin (si existe)..." -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName "PodmanAutoStartAdmin" -Confirm:$false -ErrorAction SilentlyContinue

# 5. Registrar las nuevas tareas
Write-Host "Registrando tarea PodmanWSLServiceAdmin (Elevada)..." -ForegroundColor Green
Register-ScheduledTask -TaskName "PodmanWSLServiceAdmin" -Action $actAdmin -Trigger $trigger -Principal $pAdmin -Settings $settings -Force | Out-Null

Write-Host "Registrando tarea PodmanAutoStartUser (Usuario normal)..." -ForegroundColor Green
Register-ScheduledTask -TaskName "PodmanAutoStartUser" -Action $actUser -Trigger $trigger -Principal $pUser -Settings $settings -Force | Out-Null

Write-Host "`n¡Tareas programadas registradas exitosamente!" -ForegroundColor Green
Write-Host "1. PodmanWSLServiceAdmin -> Habilita WSLService (Admin)"
Write-Host "2. PodmanAutoStartUser    -> Inicia Podman y PostgreSQL (Usuario)"
