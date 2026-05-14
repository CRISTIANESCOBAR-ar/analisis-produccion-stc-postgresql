# =====================================================
# sync-import.ps1  — Importación incremental (Notebook)
# =====================================================
# Aplica el archivo generado por sync-export.ps1.
# Solo inserta filas que NO existen en esta base de datos.
# Las filas existentes NO se tocan.
#
# Uso:
#   .\sync-import.ps1                          <- muestra lista de archivos sync
#   .\sync-import.ps1 "C:\ruta\sync_xxx.sql"  <- importa archivo específico
# =====================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$SyncFile
)

$CONTAINER_NAME = "stc_postgres"
$SYNC_DIR       = "C:\stc-produccion-v2\backups\sync"

# ----- Selección del archivo -----
if (-not $SyncFile) {
    if (-not (Test-Path $SYNC_DIR)) {
        Write-Host "No existe el directorio de sync: $SYNC_DIR"
        Write-Host "Indica la ruta completa: .\sync-import.ps1 'C:\ruta\sync_xxx.sql'"
        exit 1
    }

    $archivos = Get-ChildItem $SYNC_DIR -Filter "sync_*.sql" | Sort-Object CreationTime -Descending

    if ($archivos.Count -eq 0) {
        Write-Host "No hay archivos de sync en $SYNC_DIR"
        Write-Host "Copia primero el archivo generado por sync-export.ps1"
        exit 1
    }

    Write-Host "Archivos de sincronización disponibles:"
    Write-Host ""
    for ($i = 0; $i -lt $archivos.Count; $i++) {
        $f    = $archivos[$i]
        $size = [math]::Round($f.Length / 1KB, 1)
        Write-Host "  [$($i+1)] $($f.Name)  ($size KB)  —  $($f.CreationTime)"
    }

    Write-Host ""
    $sel = Read-Host "Seleccione el número a importar (1-$($archivos.Count))"
    $SyncFile = $archivos[[int]$sel - 1].FullName
}

# ----- Validaciones -----
if (-not (Test-Path $SyncFile)) {
    Write-Host "ERROR: Archivo no encontrado: $SyncFile"
    exit 1
}

$fileInfo = Get-Item $SyncFile
$sizeKB   = [math]::Round($fileInfo.Length / 1KB, 1)

# ----- Confirmación -----
Write-Host ""
Write-Host "Archivo    : $SyncFile"
Write-Host "Tamaño     : $sizeKB KB"
Write-Host "Estrategia : INSERT ON CONFLICT DO NOTHING (no toca datos existentes)"
Write-Host ""
$confirm = Read-Host "¿Confirmar importación? (escriba 'SI')"

if ($confirm -ne "SI") {
    Write-Host "Cancelado."
    exit 0
}

# ----- Verificar contenedor -----
$running = podman ps --format "{{.Names}}" 2>&1 | Where-Object { $_ -eq $CONTAINER_NAME }
if (-not $running) {
    Write-Host "ERROR: El contenedor '$CONTAINER_NAME' no está corriendo."
    Write-Host "Inicia Podman y el contenedor antes de importar."
    exit 1
}

# ----- Importar -----
Write-Host ""
Write-Host "Importando... (puede tardar varios minutos según el tamaño)"

$startTime = Get-Date

try {
    # Copiar al contenedor para evitar corrupción de encoding en el pipe de PowerShell
    $remotePath = "/tmp/sync_import_$([System.IO.Path]::GetFileName($SyncFile))"
    podman cp $SyncFile "${CONTAINER_NAME}:${remotePath}" 2>&1 | Out-Null

    podman exec $CONTAINER_NAME psql -U stc_user -d stc_produccion -v ON_ERROR_STOP=0 -f $remotePath 2>&1

    # Limpiar archivo temporal en el contenedor
    podman exec $CONTAINER_NAME rm -f $remotePath 2>&1 | Out-Null

    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    Write-Host ""
    Write-Host "OK: Importación completada en $elapsed segundos"
    Write-Host ""

    # Contar filas en tablas clave como verificación rápida
    Write-Host "Verificación rápida de filas:"
    $checkTables = @("tb_uster_par","tb_hvi_ensayos","tb_produccion","tb_calidad")
    foreach ($t in $checkTables) {
        $count = podman exec $CONTAINER_NAME psql -U stc_user -d stc_produccion -tAc "SELECT COUNT(*) FROM $t" 2>&1
        Write-Host "  $t : $count filas"
    }

} catch {
    Write-Host "ERROR durante la importación: $_"
    exit 1
}

Write-Host ""
Write-Host "Listo. Solo se insertaron filas que no existían previamente."
