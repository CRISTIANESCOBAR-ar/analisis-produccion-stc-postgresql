 
param(
    [string]$ExcelPath = "C:\STC\rpsPosicaoEstoquePRD.xlsx",
    [string]$AccessPath = "C:\STC\rptProdTec.accdb",
    [string]$TableName = "tb_PROCESO",
    [switch]$Replace,
    [string]$FichaExcelPath = "C:\STC\fichaArtigo.xlsx",
    [string]$FichaTableName = "tb_FICHAS",
    [bool]$IncludeFicha = $true,
    [string]$RptProducaoPath = "C:\STC\rptProducaoMaquina.xlsx",
    [string]$RptProducaoSheet = "rptProdMaq$",
    [string]$ProducaoTableName = "tb_PRODUCCION",
    [string]$ProducaoDateField = "DT_BASE_PRODUCAO",
    [bool]$ProcessProducao = $true,
    [bool]$UseStaging = $true,
    [switch]$DryRun,
    [switch]$KeepTemp,
    [bool]$BackupAccdb = $true,
    [string]$BackupDir = "C:\STC\backups"
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

    # --- Procesar tb_PRODUCCION: obtener fechas desde el XLSX y actualizar tb_PRODUCCION sin crear tabla temporal ---
    if ($ProcessProducao) {
        if (-not (Test-Path $RptProducaoPath)) {
            Write-Warning "Omitiendo actualización de ${ProducaoTableName}: no se encontró '$RptProducaoPath'."
        } else {
            Write-Host "Procesando archivo de producción para actualizar $ProducaoTableName..."

            try {
                # Usar la conexión interna de Access (evita dependencia OLEDB/bitness)
                $conn = $access.CurrentProject.Connection

                # Cadena IN para conectar al archivo Excel (.xlsx)
                $excelIn = "'" + $RptProducaoPath + "' 'Excel 12.0 Xml;HDR=Yes;IMEX=1;'"
                $sheetToken = "[" + $RptProducaoSheet + "]"

                # 1) Obtener fechas distintas desde el archivo Excel (formateadas como Short Date)
                $sqlDates = "SELECT DISTINCTROW Format`$(" + $sheetToken + ".[" + $ProducaoDateField + "],'Short Date') AS FECHA " +
                            "FROM " + $sheetToken + " IN " + $excelIn + " " +
                            "GROUP BY Format`$(" + $sheetToken + ".[" + $ProducaoDateField + "],'Short Date') " +
                            "ORDER BY Format`$(" + $sheetToken + ".[" + $ProducaoDateField + "],'Short Date');"

                $rs = $conn.Execute($sqlDates)
                while (-not $rs.EOF) {
                    $fecha = $rs.Fields.Item("FECHA").Value
                    if ($null -ne $fecha) {
                        $fechaStr = $fecha.ToString()
                        $deleteSql = "DELETE * FROM [" + $ProducaoTableName + "] WHERE (((Format`$(" + "[" + $ProducaoTableName + "]" + ".[" + $ProducaoDateField + "],'Short Date'))='" + $fechaStr + "'))"
                        Write-Host "Eliminando filas en $ProducaoTableName con fecha: $fechaStr"
                        $conn.Execute($deleteSql) | Out-Null
                    }
                    $rs.MoveNext()
                }
                try { $rs.Close() } catch {}

                # 2) Insertar directamente desde la hoja Excel a la tabla definitiva
                $insertSql = "INSERT INTO [" + $ProducaoTableName + "] SELECT * FROM " + $sheetToken + " IN " + $excelIn
                Write-Host "Insertando registros desde $RptProducaoPath a $ProducaoTableName..."
                $conn.Execute($insertSql) | Out-Null
                } catch {
                Write-Error "Error actualizando ${ProducaoTableName}: $_"
            }
        }
    }
        # --- Procesar tb_PRODUCCION: staging + dry-run + backup ---
        if ($ProcessProducao) {
            if (-not (Test-Path $RptProducaoPath)) {
                Write-Warning "Omitiendo actualización de ${ProducaoTableName}: no se encontró '$RptProducaoPath'."
            } else {
                Write-Host "Procesando archivo de producción para actualizar $ProducaoTableName..."

                try {
                    # Backup del archivo .accdb antes de modificar
                    if ($BackupAccdb) {
                        try {
                            if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
                            $ts = Get-Date -Format "yyyyMMdd_HHmmss"
                            $accdbName = [System.IO.Path]::GetFileNameWithoutExtension($AccessPath)
                            $backupFile = Join-Path $BackupDir ("${accdbName}_$ts.accdb")
                            Copy-Item -Path $AccessPath -Destination $backupFile -Force
                            Write-Host "Backup creado: $backupFile"
                        } catch {
                            Write-Warning "No se pudo crear backup del .accdb: $_"
                        }
                    }

                    $tempTable = $ProducaoTableName + "_TEMP"

                    if ($UseStaging) {
                        # Importar Excel a tabla temporal (elimina tabla temporal previa si existe)
                        try {
                            $access.DoCmd.SetWarnings($false)
                            $access.DoCmd.RunSQL("DROP TABLE [" + $tempTable + "]")
                            $access.DoCmd.SetWarnings($true)
                        } catch {
                            $access.DoCmd.SetWarnings($true)
                        }

                        try {
                            $access.DoCmd.TransferSpreadsheet($transferType, $spreadsheetType, $tempTable, $RptProducaoPath, $hasFieldNames, $RptProducaoSheet)
                            Write-Host "Importado a tabla temporal: $tempTable"
                        } catch {
                            Write-Error "Error importando Excel a tabla temporal: $_"
                            throw $_
                        }

                        # Usar la conexión interna de Access para validación/borrado/inserción
                        $conn = $access.CurrentProject.Connection

                        # Intentar normalizar fechas en la temporal (donde IsDate es true)
                        try {
                            $convSql = "UPDATE [" + $tempTable + "] SET [" + $ProducaoDateField + "] = CDate([" + $ProducaoDateField + "]) WHERE IsDate([" + $ProducaoDateField + "])"
                            $conn.Execute($convSql) | Out-Null
                        } catch {
                            Write-Warning "No se pudo convertir automáticamente todas las fechas en ${tempTable}: $_"
                        }

                        # Obtener fechas distintas y conteos desde la temporal
                        $sqlDates = "SELECT Format`$([" + $ProducaoDateField + "],'Short Date') AS FECHA, COUNT(*) AS CNT FROM [" + $tempTable + "] GROUP BY Format`$([" + $ProducaoDateField + "],'Short Date') ORDER BY Format`$([" + $ProducaoDateField + "],'Short Date')"
                        $rsDates = $conn.Execute($sqlDates)
                        $datesToDelete = @()
                        while (-not $rsDates.EOF) {
                            $d = @{}
                            $d.FECHA = $rsDates.Fields.Item("FECHA").Value
                            $d.CNT = $rsDates.Fields.Item("CNT").Value
                            $datesToDelete += $d
                            $rsDates.MoveNext()
                        }
                        if ($rsDates.State -ne $null) { try { $rsDates.Close() } catch {} }

                        if ($DryRun) {
                            Write-Host "DRY-RUN: Fechas encontradas en ${tempTable}:"
                            foreach ($d in $datesToDelete) {
                                Write-Host ("  {0} -> {1} registros" -f $d.FECHA, $d.CNT)
                            }
                            if (-not $KeepTemp) {
                                try { $access.DoCmd.RunSQL("DROP TABLE [" + $tempTable + "]") } catch { }
                            }
                        } else {
                            # borrar por fechas
                            foreach ($d in $datesToDelete) {
                                $fechaStr = $d.FECHA
                                Write-Host "Eliminando filas en $ProducaoTableName con fecha: $fechaStr"
                                $deleteSql = "DELETE * FROM [" + $ProducaoTableName + "] WHERE (((Format`$(" + "[" + $ProducaoTableName + "]" + ".[" + $ProducaoDateField + "],'Short Date'))='" + $fechaStr + "'))"
                                $conn.Execute($deleteSql) | Out-Null
                            }

                            # calcular columnas comunes
                            $rsTempFld = $conn.Execute("SELECT * FROM [" + $tempTable + "] WHERE 1=0")
                            $tempCols = @(); for ($i=0;$i -lt $rsTempFld.Fields.Count;$i++) { $tempCols += $rsTempFld.Fields.Item($i).Name }
                            $rsTempFld.Close()
                            $rsDestFld = $conn.Execute("SELECT * FROM [" + $ProducaoTableName + "] WHERE 1=0")
                            $destCols = @(); for ($i=0;$i -lt $rsDestFld.Fields.Count;$i++) { $destCols += $rsDestFld.Fields.Item($i).Name }
                            $rsDestFld.Close()

                            $common = @()
                            foreach ($c in $destCols) {
                                if ($tempCols -contains $c) { $common += $c }
                            }
                            if (-not $common.Count) {
                                Write-Warning "No hay columnas en común entre $tempTable y $ProducaoTableName. Abortando insert."
                            } else {
                                $colList = ($common | ForEach-Object { '[' + $_ + ']' }) -join ','
                                $insertSql = "INSERT INTO [" + $ProducaoTableName + "] (" + $colList + ") SELECT " + $colList + " FROM [" + $tempTable + "]"
                                Write-Host "Insertando registros comunes (columnas: $($common -join ', '))..."
                                $conn.Execute($insertSql) | Out-Null
                                Write-Host "Insert completado."
                            }
                            if (-not $KeepTemp) { try { $access.DoCmd.RunSQL("DROP TABLE [" + $tempTable + "]") } catch { } }
                        }
                    } else {
                        # fallback directo (sin staging)
                        try {
                            $ado = New-Object -ComObject ADODB.Connection
                            $ado.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$AccessPath;")
                            $excelIn = "'" + $RptProducaoPath + "' 'Excel 12.0 Xml;HDR=Yes;IMEX=1;'"
                            $sheetToken = "[" + $RptProducaoSheet + "]"
                            $sqlDates = "SELECT DISTINCTROW Format`$(" + $sheetToken + ".[" + $ProducaoDateField + "],'Short Date') AS FECHA FROM " + $sheetToken + " IN " + $excelIn + " GROUP BY Format`$(" + $sheetToken + ".[" + $ProducaoDateField + "],'Short Date') ORDER BY Format`$(" + $sheetToken + ".[" + $ProducaoDateField + "],'Short Date');"
                            $rs = $ado.Execute($sqlDates)
                            $datesToDelete = @()
                            while (-not $rs.EOF) { $datesToDelete += $rs.Fields.Item("FECHA").Value; $rs.MoveNext() }
                            foreach ($fechaStr in $datesToDelete) {
                                $ado.Execute("DELETE * FROM [" + $ProducaoTableName + "] WHERE (((Format`$([" + $ProducaoTableName + "].[" + $ProducaoDateField + "],'Short Date'))='" + $fechaStr + "'))") | Out-Null
                            }
                            $insertSql = "INSERT INTO [" + $ProducaoTableName + "] SELECT * FROM " + $sheetToken + " IN " + $excelIn
                            $ado.Execute($insertSql) | Out-Null
                            $ado.Close(); $ado = $null
                        } catch { Write-Error "Error proceso directo: $_" }
                    }

                } catch {
                    Write-Error "Error actualizando ${ProducaoTableName}: $_"
                }
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

Write-Host "Listo. Revisa las tablas importadas y '${ProducaoTableName}' en la base: $AccessPath"
