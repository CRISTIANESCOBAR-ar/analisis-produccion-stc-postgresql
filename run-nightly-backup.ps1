# ============================================================
# run-nightly-backup.ps1
# Arranca Podman/PostgreSQL si hace falta y ejecuta un backup full.
# Diseñado para Task Scheduler, sin depender de npm run dev ni de la UI.
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [string]$Reason = 'nightly-scheduled'
)

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startDbScript = Join-Path $rootDir 'start-db.ps1'
$backupScript = Join-Path $rootDir 'backup-database.ps1'
$logDir = Join-Path $rootDir 'backups\logs'

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$logFile = Join-Path $logDir "nightly-backup_$timestamp.log"

Start-Transcript -Path $logFile -Force | Out-Null

try {
    Write-Host "[nightly-backup] Inicio: $(Get-Date -Format s)"
    Write-Host "[nightly-backup] Preparando PostgreSQL..."
    & $startDbScript

    Write-Host "[nightly-backup] Ejecutando backup full..."
    & $backupScript -Mode Full -Reason $Reason

    Write-Host "[nightly-backup] Finalizado correctamente. Log: $logFile"
} catch {
    Write-Host "[nightly-backup] ERROR: $($_.Exception.Message)"
    throw
} finally {
    Stop-Transcript | Out-Null
}