# =====================================================
# Script de Backup Automático de PostgreSQL
# =====================================================
# Ejecutar diariamente con Task Scheduler o manualmente

$BACKUP_DIR = "C:\stc-produccion-v2\backups"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_FILE = "$BACKUP_DIR\stc_produccion_$DATE.sql"
$CONTAINER_NAME = "stc_postgres"

# Crear directorio de backups si no existe
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Write-Host "✅ Directorio de backups creado: $BACKUP_DIR"
}

Write-Host "🔄 Iniciando backup de base de datos..."
Write-Host "📁 Archivo: $BACKUP_FILE"

# Ejecutar pg_dump dentro del contenedor
try {
    podman exec $CONTAINER_NAME pg_dump -U stc_user -d stc_produccion --clean --if-exists | Out-File -FilePath $BACKUP_FILE -Encoding UTF8
    
    $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host "✅ Backup completado exitosamente!"
    Write-Host "📊 Tamaño: $([math]::Round($fileSize, 2)) MB"
    
    # Mantener solo los últimos 7 backups
    $oldBackups = Get-ChildItem $BACKUP_DIR -Filter "stc_produccion_*.sql" | Sort-Object CreationTime -Descending | Select-Object -Skip 7
    if ($oldBackups) {
        Write-Host "🗑️  Eliminando backups antiguos: $($oldBackups.Count)"
        $oldBackups | Remove-Item -Force
    }
    
    Write-Host "✅ Proceso de backup finalizado"
} catch {
    Write-Host "❌ Error en el backup: $_"
    exit 1
}
