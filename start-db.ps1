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

function Test-PodmanApi {
    try {
        podman info --format "{{.Host.RemoteSocket.Path}}" 1>$null 2>$null
        return $true
    } catch {
        return $false
    }
}

function Get-PodmanSshPort {
    try {
        $connections = podman system connection list --format json 2>$null | ConvertFrom-Json
        $defaultConnection = $connections | Where-Object { $_.Default } | Select-Object -First 1
        if ($defaultConnection.URI -match '127\.0\.0\.1:(\d+)') {
            return [int]$Matches[1]
        }
    } catch {
    }

    return $null
}

# ---------- 1. Verificar que Podman machine está activa ----------
Write-Host "`n[1/3] Verificando Podman machine..." -ForegroundColor Cyan
$podmanReady = Test-PodmanApi
if (-not $podmanReady) {
    Write-Host "     Podman machine no está activa. Iniciando..." -ForegroundColor Yellow
    podman machine start

    if (-not (Test-PodmanApi)) {
        throw "Podman no respondió después del arranque. Ejecuta 'podman ps' para validar el socket antes de reintentar."
    }
} else {
    Write-Host "     Podman API: OK" -ForegroundColor Green
}

# ---------- 2. Levantar solo el servicio postgres ----------
Write-Host "`n[2/3] Levantando contenedor stc_postgres..." -ForegroundColor Cyan
Set-Location $composeDir
$containerExists = podman ps -a --filter "name=stc_postgres" --format "{{.Names}}" 2>$null
$containerRunning = podman ps --filter "name=stc_postgres" --format "{{.Names}}" 2>$null

if ($containerRunning) {
    Write-Host "     stc_postgres ya estaba corriendo." -ForegroundColor Green
} elseif ($containerExists) {
    podman start stc_postgres | Out-Null
    Write-Host "     stc_postgres iniciado con podman start." -ForegroundColor Green
} else {
    Write-Host "     stc_postgres no existe todavía. Creando con compose..." -ForegroundColor Yellow
    podman compose up -d postgres
}

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
  Puerto:   5433
  BD:       stc_produccion
  Usuario:  stc_user
  Password: stc_password_2026
============================================================
"@ -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] El contenedor no alcanzó estado 'healthy' en $maxWait s." -ForegroundColor Red
    Write-Host "Revisa los logs con:  podman logs stc_postgres" -ForegroundColor Yellow
    exit 1
}
