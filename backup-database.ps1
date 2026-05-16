# =====================================================
# Script de Backup Automatico de PostgreSQL
# =====================================================
# Ejecutar diariamente con Task Scheduler o manualmente

param(
    [ValidateSet('Full', 'Focused')]
    [string]$Mode = 'Full',
    [string]$Reason = ''
)

$BACKUP_DIR = "C:\stc-produccion-v2\backups"
$BACKUP_DIR_D = "D:\Backups-STC"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_FILENAME = "stc_produccion_$DATE.sql"
$BACKUP_FILE = "$BACKUP_DIR\$BACKUP_FILENAME"
$CONTAINER_NAME = "stc_postgres"
$MIN_SIZE_MB = 10
$FOCUSED_FILENAME = "ensayos_criticos_$DATE.sql"
$FOCUSED_FILE = "$BACKUP_DIR\$FOCUSED_FILENAME"
$FOCUSED_TABLES = @(
    'tb_uster_par',
    'tb_uster_tbl',
    'tb_uster_carda_par',
    'tb_uster_carda_tbl',
    'tb_tensorapid_par',
    'tb_tensorapid_tbl',
    'tb_hvi_ensayos',
    'tb_hvi_detalles'
)

function Copy-ToSecondaryDisk {
    param(
        [string]$SourceFile
    )

    if ((Test-Path "D:\") -and (Test-Path $SourceFile)) {
        Copy-Item $SourceFile "$BACKUP_DIR_D\$(Split-Path $SourceFile -Leaf)"
        Write-Host "Copia guardada en: $BACKUP_DIR_D\$(Split-Path $SourceFile -Leaf)"
    }
}

function Invoke-PgDumpToFile {
    param(
        [string]$DestinationFile,
        [string[]]$ExtraArgs = @()
    )

    $dumpArgs = @('exec', $CONTAINER_NAME, 'pg_dump', '-U', 'stc_user', '-d', 'stc_produccion', '--clean', '--if-exists') + $ExtraArgs
    & podman @dumpArgs | Out-File -FilePath $DestinationFile -Encoding UTF8
}

function Remove-OldBackups {
    param(
        [string]$Directory,
        [string]$Filter,
        [int]$Keep,
        [string]$Label
    )

    if (-not (Test-Path $Directory)) { return }
    $oldBackups = Get-ChildItem $Directory -Filter $Filter | Sort-Object CreationTime -Descending | Select-Object -Skip $Keep
    if ($oldBackups) {
        Write-Host "Eliminando backups antiguos en ${Label}: $($oldBackups.Count)"
        $oldBackups | Remove-Item -Force
    }
}

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
Write-Host "Modo: $Mode"
if ($Reason) { Write-Host "Motivo: $Reason" }
if ($Mode -eq 'Full') {
    Write-Host "Archivo full: $BACKUP_FILE"
}
Write-Host "Archivo enfocado: $FOCUSED_FILE"

# Ejecutar pg_dump dentro del contenedor
try {
    if ($Mode -eq 'Full') {
        Invoke-PgDumpToFile -DestinationFile $BACKUP_FILE

        $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
        $fileSizeRounded = [math]::Round($fileSize, 2)

        if ($fileSize -lt $MIN_SIZE_MB) {
            Write-Host "ERROR: Backup muy pequeno ($fileSizeRounded MB) - puede estar vacio. Se elimina."
            Remove-Item $BACKUP_FILE -Force
            exit 1
        }

        Write-Host "OK: Backup full completado: $fileSizeRounded MB"
        Copy-ToSecondaryDisk -SourceFile $BACKUP_FILE
        Remove-OldBackups -Directory $BACKUP_DIR -Filter 'stc_produccion_*.sql' -Keep 7 -Label 'C:'
        Remove-OldBackups -Directory $BACKUP_DIR_D -Filter 'stc_produccion_*.sql' -Keep 14 -Label 'D:'
    }

    $focusedArgs = @()
    foreach ($tableName in $FOCUSED_TABLES) {
        $focusedArgs += @('-t', $tableName)
    }
    Invoke-PgDumpToFile -DestinationFile $FOCUSED_FILE -ExtraArgs $focusedArgs

    $focusedSize = (Get-Item $FOCUSED_FILE).Length / 1KB
    $focusedSizeRounded = [math]::Round($focusedSize, 1)
    Write-Host "Backup enfocado: $FOCUSED_FILENAME ($focusedSizeRounded KB)"
    Copy-ToSecondaryDisk -SourceFile $FOCUSED_FILE
    Remove-OldBackups -Directory $BACKUP_DIR -Filter 'ensayos_criticos_*.sql' -Keep 30 -Label 'C:'
    Remove-OldBackups -Directory $BACKUP_DIR_D -Filter 'ensayos_criticos_*.sql' -Keep 60 -Label 'D:'

    Write-Host "Backup finalizado correctamente."

} catch {
    Write-Host "ERROR en el backup: $_"
    exit 1
}
