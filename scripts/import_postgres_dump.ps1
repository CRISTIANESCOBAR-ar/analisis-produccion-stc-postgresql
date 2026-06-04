<#
.SYNOPSIS
    Restaura un volcado SQL en un contenedor Postgres (Podman) en la máquina destino (Windows).

.DESCRIPTION
    Restaura desde un archivo .sql (o .zip que contenga .sql) hacia un contenedor Postgres nuevo o existente.

.EXAMPLE
    .\import_postgres_dump.ps1 -BackupDir C:\backups\pg -PostgresPassword 'mi_pass' -ForceReplace
#>

param(
    [string]$BackupDir = "C:\stc_backups\stc_postgres",
    [string]$DumpFile = "",
    [string]$ContainerName = "stc_postgres",
    [int]$Port = 5432,
    [string]$PostgresVersion = "15",
    [string]$PostgresPassword = "mi_pass_segura",
    [switch]$ForceReplace
)

function Write-Log { param($m) Write-Host "[INFO] $m" }
function Write-Err { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    Write-Err "podman no está instalado o no está en PATH. Instala Podman/Podman Desktop.";
    exit 10
}

if (-not (Test-Path $BackupDir)) { Write-Err "BackupDir $BackupDir no existe."; exit 11 }

if ($DumpFile -eq "") {
    $candidate = Get-ChildItem -Path $BackupDir -File -Include "*.sql","*.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $candidate) { Write-Err "No se encontraron archivos .sql o .zip en $BackupDir"; exit 12 }
    $DumpFile = $candidate.FullName
}

# Si es zip, extraer a temp
$tempSql = $null
if ($DumpFile.ToLower().EndsWith('.zip')) {
    $tmpDir = Join-Path $env:TEMP ("pg_restore_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
    Write-Log "Extrayendo $DumpFile a $tmpDir ..."
    try { Expand-Archive -LiteralPath $DumpFile -DestinationPath $tmpDir -Force } catch { Write-Err "Error extrayendo zip: $_"; exit 13 }
    $sql = Get-ChildItem -Path $tmpDir -Filter "*.sql" -File | Select-Object -First 1
    if (-not $sql) { Write-Err "No se encontró archivo .sql dentro del zip."; exit 14 }
    $tempSql = $sql.FullName
    $dumpToUse = $tempSql
} else {
    $dumpToUse = $DumpFile
}

Write-Log "Usando volcado: $dumpToUse"

Write-Log "Descargando/asegurando imagen postgres:$PostgresVersion ..."
& podman pull docker.io/library/postgres:$PostgresVersion

# Si existe contenedor
& podman container exists $ContainerName
if ($LASTEXITCODE -eq 0) {
    if ($ForceReplace) {
        Write-Log "Deteniendo y eliminando contenedor existente $ContainerName ..."
        & podman stop $ContainerName | Out-Null
        & podman rm $ContainerName | Out-Null
    } else {
        Write-Err "Contenedor $ContainerName ya existe. Use -ForceReplace para reemplazarlo."; exit 21
    }
}

Write-Log "Creando contenedor Postgres ($ContainerName) ..."
& podman run -d --name $ContainerName -e POSTGRES_PASSWORD=$PostgresPassword -p $Port:5432 docker.io/library/postgres:$PostgresVersion
if ($LASTEXITCODE -ne 0) { Write-Err "Error creando contenedor Postgres."; exit 22 }

# Esperar a que Postgres esté listo
$tries = 0
$ready = $false
while ($tries -lt 30 -and -not $ready) {
    Start-Sleep -Seconds 2
    & podman exec $ContainerName pg_isready -U postgres > $null 2>&1
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    $tries++
}
if (-not $ready) { Write-Err "Postgres no respondió en el contenedor dentro del tiempo esperado."; exit 23 }

Write-Log "Copiando volcado al contenedor..."
& podman cp $dumpToUse "$ContainerName:/tmp/pg_dump.sql"
if ($LASTEXITCODE -ne 0) { Write-Err "Error copiando el volcado al contenedor."; exit 24 }

Write-Log "Restaurando base de datos dentro del contenedor... (esto puede tardar)"
& podman exec -i $ContainerName psql -U postgres -f /tmp/pg_dump.sql
if ($LASTEXITCODE -ne 0) { Write-Err "Error durante la restauración (psql devolvió error)."; exit 25 }

Write-Log "Restauración completada."

if ($tempSql) {
    Write-Log "Limpiando archivos temporales..."
    Remove-Item -Recurse -Force (Split-Path -Path $tempSql -Parent)
}

*** End Patch