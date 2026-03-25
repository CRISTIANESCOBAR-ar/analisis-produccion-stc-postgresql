# =====================================================
# Script de Backup Automatico de PostgreSQL
# =====================================================
# Ejecutar diariamente con Task Scheduler o manualmente

$BACKUP_DIR = "C:\stc-produccion-v2\backups"
$BACKUP_DIR_D = "D:\Backups-STC"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_FILENAME = "stc_produccion_$DATE.sql"
$BACKUP_FILE = "$BACKUP_DIR\$BACKUP_FILENAME"
$CONTAINER_NAME = "stc_postgres"
$MIN_SIZE_MB = 10

# Crear directorios si no existen
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Write-Host "Directorio de backups creado: $BACKUP_DIR"
}
if (Test-Path "D:\") {
    if (-not (Test-Path $BACKUP_DIR_D)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR_D | Out-Null
    }
}

Write-Host "Iniciando backup de base de datos..."
Write-Host "Archivo: $BACKUP_FILE"

# Ejecutar pg_dump dentro del contenedor
try {
    podman exec $CONTAINER_NAME pg_dump -U stc_user -d stc_produccion --clean --if-exists | Out-File -FilePath $BACKUP_FILE -Encoding UTF8

    $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
    $fileSizeRounded = [math]::Round($fileSize, 2)

    # Verificar que el backup tiene contenido real
    if ($fileSize -lt $MIN_SIZE_MB) {
        Write-Host "ERROR: Backup muy pequeno ($fileSizeRounded MB) - puede estar vacio. Se elimina."
        Remove-Item $BACKUP_FILE -Force
        exit 1
    }

    Write-Host "OK: Backup completado: $fileSizeRounded MB"

    # Copiar al disco D si esta disponible
    if (Test-Path "D:\") {
        Copy-Item $BACKUP_FILE "$BACKUP_DIR_D\$BACKUP_FILENAME"
        Write-Host "Copia guardada en: $BACKUP_DIR_D\$BACKUP_FILENAME"
    }

    # Mantener solo los ultimos 7 backups en C:\
    $oldBackups = Get-ChildItem $BACKUP_DIR -Filter "stc_produccion_*.sql" | Sort-Object CreationTime -Descending | Select-Object -Skip 7
    if ($oldBackups) {
        Write-Host "Eliminando backups antiguos en C: $($oldBackups.Count)"
        $oldBackups | Remove-Item -Force
    }

    # Mantener solo los ultimos 14 backups en D:\
    if (Test-Path $BACKUP_DIR_D) {
        $oldBackupsD = Get-ChildItem $BACKUP_DIR_D -Filter "stc_produccion_*.sql" | Sort-Object CreationTime -Descending | Select-Object -Skip 14
        if ($oldBackupsD) {
            Write-Host "Eliminando backups antiguos en D: $($oldBackupsD.Count)"
            $oldBackupsD | Remove-Item -Force
        }
    }

    Write-Host "Backup finalizado correctamente."

    # -------------------------------------------------------
    # Backup critico: solo tb_uster_par y tb_uster_tbl
    # Archivo pequeno, facil de copiar a cualquier lado
    # -------------------------------------------------------
    $USTER_FILENAME = "uster_ensayos_$DATE.sql"
    $USTER_FILE = "$BACKUP_DIR\$USTER_FILENAME"

    podman exec $CONTAINER_NAME pg_dump -U stc_user -d stc_produccion --clean --if-exists -t tb_uster_par -t tb_uster_tbl | Out-File -FilePath $USTER_FILE -Encoding UTF8

    $usterSize = (Get-Item $USTER_FILE).Length / 1KB
    $usterSizeRounded = [math]::Round($usterSize, 1)
    Write-Host "Backup Uster: $USTER_FILENAME ($usterSizeRounded KB)"

    # Copiar al disco D si esta disponible
    if (Test-Path "D:\") {
        Copy-Item $USTER_FILE "$BACKUP_DIR_D\$USTER_FILENAME"
        Write-Host "Copia Uster en D: $BACKUP_DIR_D\$USTER_FILENAME"
    }

    # Mantener solo los ultimos 30 backups Uster en C:\ (son pequenos)
    $oldUster = Get-ChildItem $BACKUP_DIR -Filter "uster_ensayos_*.sql" | Sort-Object CreationTime -Descending | Select-Object -Skip 30
    if ($oldUster) { $oldUster | Remove-Item -Force }

    if (Test-Path $BACKUP_DIR_D) {
        $oldUsterD = Get-ChildItem $BACKUP_DIR_D -Filter "uster_ensayos_*.sql" | Sort-Object CreationTime -Descending | Select-Object -Skip 60
        if ($oldUsterD) { $oldUsterD | Remove-Item -Force }
    }

} catch {
    Write-Host "ERROR en el backup: $_"
    exit 1
}
