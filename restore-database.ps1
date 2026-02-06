# =====================================================
# Script de Restauración de PostgreSQL
# =====================================================
# Uso: .\restore-database.ps1 [archivo_backup.sql]

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile
)

$BACKUP_DIR = "C:\stc-produccion-v2\backups"
$CONTAINER_NAME = "stc_postgres"

# Si no se especifica archivo, mostrar lista
if (-not $BackupFile) {
    Write-Host "📋 Backups disponibles:"
    Write-Host ""
    $backups = Get-ChildItem $BACKUP_DIR -Filter "stc_produccion_*.sql" | Sort-Object CreationTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "❌ No hay backups disponibles en $BACKUP_DIR"
        exit 1
    }
    
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $backup = $backups[$i]
        $size = [math]::Round($backup.Length / 1MB, 2)
        Write-Host "[$($i+1)] $($backup.Name) - $size MB - $($backup.CreationTime)"
    }
    
    Write-Host ""
    $selection = Read-Host "Seleccione el número de backup a restaurar (1-$($backups.Count))"
    $BackupFile = $backups[$selection - 1].FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ Archivo no encontrado: $BackupFile"
    exit 1
}

Write-Host ""
Write-Host "⚠️  ADVERTENCIA: Esta operación SOBRESCRIBIRÁ la base de datos actual"
Write-Host "📁 Archivo a restaurar: $BackupFile"
$confirm = Read-Host "¿Desea continuar? (escriba 'SI' para confirmar)"

if ($confirm -ne "SI") {
    Write-Host "❌ Restauración cancelada"
    exit 0
}

Write-Host ""
Write-Host "🔄 Restaurando base de datos..."

try {
    # Restaurar desde el archivo SQL
    Get-Content $BackupFile | podman exec -i $CONTAINER_NAME psql -U stc_user -d stc_produccion
    
    Write-Host "✅ Base de datos restaurada exitosamente!"
    Write-Host ""
    Write-Host "Verificando tablas..."
    podman exec $CONTAINER_NAME psql -U stc_user -d stc_produccion -c "\dt"
} catch {
    Write-Host "❌ Error en la restauración: $_"
    exit 1
}
