<#
.SYNOPSIS
    Exporta un volcado SQL desde un contenedor Postgres gestionado por Podman (Windows).

.DESCRIPTION
    Crea un volcado (pg_dumpall) desde el contenedor y opcionalmente lo comprime
    y copia a una carpeta remota (UNC). Pensado para ejecutarse en la máquina origen (Win11).

.EXAMPLE
    .\export_postgres_dump.ps1 -ContainerName stc_postgres -BackupDir C:\backups\pg -DestinationShare \\WIN10\C$\backups -Compress
#>

param(
    [string]$ContainerName = "stc_postgres",
    [string]$BackupDir = "C:\stc_backups\stc_postgres",
    [string]$DestinationShare = "",
    [switch]$Compress,
    [switch]$Verbose
)

function Write-Log { param($m) Write-Host "[INFO] $m" }
function Write-Err { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
    Write-Err "podman no está instalado o no está en PATH. Instala Podman/Podman Desktop.";
    exit 10
}

Try { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null } Catch { Write-Err "No se pudo crear $BackupDir: $_"; exit 11 }

& podman container exists $ContainerName
if ($LASTEXITCODE -ne 0) {
    Write-Err "Contenedor '$ContainerName' no encontrado."; exit 12
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile = Join-Path $BackupDir ("pg_dumpall_$timestamp.sql")
Write-Log "Creando volcado en $dumpFile (puede tardar según tamaño de la BD)..."

try {
    & podman exec -i $ContainerName pg_dumpall -U postgres | Out-File -FilePath $dumpFile -Encoding UTF8
} catch {
    Write-Err "Error creando volcado: $_"; exit 20
}

$finalPath = $dumpFile
if ($Compress) {
    $zipPath = "$dumpFile.zip"
    Write-Log "Comprimiendo a $zipPath..."
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    try { Compress-Archive -Path $dumpFile -DestinationPath $zipPath -Force } catch { Write-Err "Error comprimiendo: $_"; exit 21 }
    $finalPath = $zipPath
}

if ($DestinationShare -ne "") {
    Write-Log "Copiando $finalPath a $DestinationShare ..."
    try {
        if (-not (Test-Path $DestinationShare)) {
            Write-Log "Destino no existe. Intentando crear carpeta remota (si las credenciales/permiso lo permiten)..."
            New-Item -ItemType Directory -Path $DestinationShare -Force | Out-Null
        }
        Copy-Item -Path $finalPath -Destination $DestinationShare -Force
        Write-Log "Copia completada."
    } catch {
        Write-Err "Error al copiar a $DestinationShare: $_"; exit 30
    }
}

Write-Log "Volcado finalizado: $finalPath"
Write-Log "Siguientes pasos: transferir este archivo al equipo destino y ejecutar el script de import."
