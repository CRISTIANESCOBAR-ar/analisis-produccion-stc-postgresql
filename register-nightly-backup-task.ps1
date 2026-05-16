# ============================================================
# register-nightly-backup-task.ps1
# Registra/actualiza una tarea diaria para ejecutar run-nightly-backup.ps1.
# ============================================================

param(
    [string]$TaskName = 'STC Nightly Full Backup',
    [Alias('Time')]
    [datetime]$At = (Get-Date '02:00'),
    [switch]$RunNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $rootDir 'run-nightly-backup.ps1'

if (-not (Test-Path $scriptPath)) {
    throw "No se encontró el script: $scriptPath"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$principalHighest = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$principalLimited = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
$selectedRunLevel = 'Highest'

try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principalHighest -Force | Out-Null
} catch {
    if ($_.Exception.Message -notmatch '0x80070005|Acceso denegado|access is denied') {
        throw
    }

    Write-Host 'No fue posible registrar la tarea con RunLevel Highest. Reintentando con RunLevel Limited...'
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principalLimited -Force | Out-Null
    $selectedRunLevel = 'Limited'
}

Write-Host "Tarea registrada: $TaskName"
Write-Host "Hora diaria: $($At.ToString('HH:mm'))"
Write-Host "Script: $scriptPath"
Write-Host "Opciones: WakeToRun + StartWhenAvailable + S4U + RunLevel $selectedRunLevel"

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host 'La tarea se lanzó inmediatamente.'
}