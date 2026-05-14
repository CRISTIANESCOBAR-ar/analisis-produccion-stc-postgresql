# ============================================================
# start-db.ps1
# Levanta el contenedor PostgreSQL de stc-produccion-v2.
# Usado por stc-produccion-v2 y stc-mezclas-poc.
#
# Puerto expuesto: 5433  (host) → 5432 (contenedor)
# BD:   stc_produccion
# User: stc_user  /  Pass: stc_password_2026
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$composeDir = "C:\stc-produccion-v2"

# ---------- 1. Verificar que Podman machine está activa ----------
Write-Host "`n[1/3] Verificando Podman machine..." -ForegroundColor Cyan
$machineStatus = podman machine inspect --format "{{.State}}" 2>$null
if ($machineStatus -ne "running") {
    Write-Host "     Podman machine no está activa. Iniciando..." -ForegroundColor Yellow
    podman machine start
} else {
    Write-Host "     Podman machine: OK (running)" -ForegroundColor Green
}

# ---------- 2. Levantar solo el servicio postgres ----------
Write-Host "`n[2/3] Levantando contenedor stc_postgres..." -ForegroundColor Cyan
Set-Location $composeDir
podman compose up -d postgres

# ---------- 3. Esperar hasta que el healthcheck diga healthy ----------
Write-Host "`n[3/3] Esperando a que PostgreSQL esté listo..." -ForegroundColor Cyan
$maxWait  = 60   # segundos máximos
$elapsed  = 0
$interval = 3

do {
    Start-Sleep -Seconds $interval
    $elapsed += $interval
    $status = podman inspect --format "{{.State.Health.Status}}" stc_postgres 2>$null
    Write-Host "     ($elapsed s) Estado: $status"
} while ($status -ne "healthy" -and $elapsed -lt $maxWait)

if ($status -eq "healthy") {
    Write-Host @"

============================================================
  PostgreSQL listo
------------------------------------------------------------
  Host:     localhost
  Puerto:   5433 (contenedor) / 5434 (túnel SSH para backend)
  BD:       stc_produccion
  Usuario:  stc_user
  Password: stc_password_2026
============================================================
"@ -ForegroundColor Green

    # ---------- 4. Tunel SSH (Windows → container via Podman SSH) ----------
    # El wslrelay no reenvía correctamente el protocolo postgres cuando hay
    # múltiples distros WSL. El túnel SSH bypasea este problema.
    Write-Host "`n[+] Levantando túnel SSH postgres (localhost:5434 → container:5432)..." -ForegroundColor Cyan
    $containerIP = podman inspect stc_postgres --format "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" 2>$null
    $sshKey = "$env:USERPROFILE\.local\share\containers\podman\machine\machine"
    $sshPort = (podman machine inspect podman-machine-default --format "{{.SSHConfig.Port}}" 2>$null)
    if (-not $sshPort) { $sshPort = 64061 }

    # Matar túnel previo en port 5434 si existe
    Stop-Process -Name ssh -ErrorAction SilentlyContinue

    $sshArgs = @(
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "-i", $sshKey,
        "-N",
        "-L", "5434:${containerIP}:5432",
        "user@127.0.0.1",
        "-p", $sshPort
    )
    $tunnelProc = Start-Process ssh -ArgumentList $sshArgs -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 2

    if (Test-NetConnection -ComputerName localhost -Port 5434 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded) {
        Write-Host "     Túnel activo (PID $($tunnelProc.Id)) en localhost:5434" -ForegroundColor Green
    } else {
        Write-Host "     [WARN] Túnel no respondió en port 5434. Verificar manualmente." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[ERROR] El contenedor no alcanzó estado 'healthy' en $maxWait s." -ForegroundColor Red
    Write-Host "Revisa los logs con:  podman logs stc_postgres" -ForegroundColor Yellow
    exit 1
}
