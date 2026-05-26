<#
.SYNOPSIS
    Importa un archivo .xlsx a una base de datos Access (.accdb) usando Automation COM (DoCmd.TransferSpreadsheet).

.DESCRIPTION
    Script ligero para importar el libro Excel a la tabla especificada en la base Access.
    Requiere Microsoft Access (o Access Database Engine) instalado. Si Access es 32-bit,
    ejecuta PowerShell x86 (SysWOW64) para evitar errores COM.

.PARAMETER ExcelPath
    Ruta al archivo .xlsx (por defecto C:\STC\rpsPosicaoEstoquePRD.xlsx)

.PARAMETER AccessPath
    Ruta al archivo .accdb (por defecto C:\STC\rptProdTec.accdb)

.PARAMETER TableName
    Nombre de la tabla destino en Access (por defecto tb_PROCESO)

.PARAMETER Replace
    Si se especifica, intenta eliminar la tabla destino antes de importar.

.EXAMPLE
    .\import-excel-to-access.ps1
    .\import-excel-to-access.ps1 -Replace
    .\import-excel-to-access.ps1 -ExcelPath 'C:\STC\otro.xlsx' -AccessPath 'C:\DB\mi.accdb' -TableName datos
#>

param(
    [string]$ExcelPath = "C:\STC\rpsPosicaoEstoquePRD.xlsx",
    [string]$AccessPath = "C:\STC\rptProdTec.accdb",
    [string]$TableName = "tb_PROCESO",
    [switch]$Replace,
    [string]$FichaExcelPath = "C:\STC\fichaArtigo.xlsx",
    [string]$FichaTableName = "tb_FICHAS",
    [bool]$IncludeFicha = $true
)

function Release-ComObject($com) {
    try { if ($com) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($com) | Out-Null } } catch { }
}

Write-Host "Importando a '$AccessPath'"

if (-not (Test-Path $AccessPath)) {
    Write-Error "No se encontró la base Access: $AccessPath"
    exit 1
}

# Crear instancia COM de Access
try {
    $access = New-Object -ComObject Access.Application
} catch {
    Write-Error "No se pudo crear Access.Application. Asegúrate de tener Microsoft Access o Access Database Engine instalado. Detalle: $_"
    exit 1
}

try {
    $access.OpenCurrentDatabase($AccessPath)

    # Definir mapeos a importar
    $mappings = @()
    $mappings += @{ ExcelPath = $ExcelPath; TableName = $TableName; Desc = 'tb_PROCESO' }
    if ($IncludeFicha) {
        $mappings += @{ ExcelPath = $FichaExcelPath; TableName = $FichaTableName; Desc = 'tb_FICHAS' }
    }

    # Parámetros de TransferSpreadsheet
    $transferType = 0
    $spreadsheetType = 10
    $hasFieldNames = $true

    foreach ($m in $mappings) {
        $src = $m.ExcelPath
        $tbl = $m.TableName
        $desc = $m.Desc

        if (-not (Test-Path $src)) {
            Write-Warning "Omitiendo importación: no se encontró '$src' para tabla '$tbl'."
            continue
        }

        if ($Replace) {
            Write-Host "Opción -Replace: intentando eliminar tabla existente '$tbl' (si existe)..."
            try {
                $dropSql = "DROP TABLE [$tbl]"
                $access.DoCmd.SetWarnings($false)
                $access.DoCmd.RunSQL($dropSql)
                $access.DoCmd.SetWarnings($true)
                Write-Host "Tabla '$tbl' eliminada (si existía)."
            } catch {
                Write-Host "Advertencia: no se pudo eliminar la tabla '$tbl' (puede que no exista o haya dependencias): $_"
                $access.DoCmd.SetWarnings($true)
            }
        }

        Write-Host "Importando '$src' → tabla '$tbl'..."
        try {
            $access.DoCmd.TransferSpreadsheet($transferType, $spreadsheetType, $tbl, $src, $hasFieldNames)
            Write-Host "Importación a '$tbl' completada."
        } catch {
            Write-Error "Error importando '$src' a '$tbl': $_"
        }
    }

} catch {
    Write-Error "Error durante la importación: $_"
} finally {
    try {
        $access.CloseCurrentDatabase()
    } catch { }
    try { $access.Quit() } catch { }
    Release-ComObject $access
    Remove-Variable access -ErrorAction SilentlyContinue
}

Write-Host "Listo. Revisa la tabla '$TableName' en la base: $AccessPath"
