# =====================================================
# recover-csv-history-safe.ps1
# =====================================================
# Restaura SOLO tablas CSV historicas a una base temporal,
# compara contra la base actual y genera un merge aditivo.
#
# Seguridad:
# - Nunca toca tb_uster_* ni tb_tensorapid_*.
# - Si se usa -ApplyMerge, primero hace backup preventivo de
#   tablas CSV + USTER + TENSORAPID.
# - El merge inserta solo filas que no existan segun columnas
#   comparables. No elimina ni actualiza registros.
# =====================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$DumpFile = "C:\stc-produccion-v2\backups\sync\stc_backup.dump",

    [Parameter(Mandatory=$false)]
    [string]$CurrentDb = "stc_produccion",

    [Parameter(Mandatory=$false)]
    [string]$ContainerName = "stc_postgres",

    [Parameter(Mandatory=$false)]
    [string]$OutputRoot = "C:\stc-produccion-v2\backups\csv-recovery",

    [Parameter(Mandatory=$false)]
    [string]$TempDbName,

    [Parameter(Mandatory=$false)]
    [string]$CutoffDate,

    [switch]$ApplyMerge,
    [switch]$CleanupTempDb
)

$ErrorActionPreference = 'Stop'
if ($null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$TargetTables = @('tb_calidad', 'tb_defectos', 'tb_produccion')
$ProtectedTables = @('tb_uster_par', 'tb_uster_tbl', 'tb_tensorapid_par', 'tb_tensorapid_tbl')
$SafetyBackupTables = $TargetTables + $ProtectedTables
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'

if (-not $TempDbName) {
    $TempDbName = "stc_csv_audit_$Timestamp"
}

$RunDir = Join-Path $OutputRoot $Timestamp
$HostExportDir = Join-Path $RunDir 'exports'
$HostSchemaDir = Join-Path $RunDir 'schemas'
$ReportPath = Join-Path $RunDir 'recovery-report.md'
$MergeSqlPath = Join-Path $RunDir 'merge-missing-history.sql'
$SafetyBackupPath = Join-Path $RunDir 'premerge-safety-backup.sql'
$RemoteWorkDir = "/tmp/csv_recovery_$Timestamp"
$RemoteDumpFile = "$RemoteWorkDir/stc_backup.dump"
$CutoffDateValue = $null

if ($CutoffDate) {
    try {
        $CutoffDateValue = [datetime]::ParseExact($CutoffDate, 'dd/MM/yyyy', [System.Globalization.CultureInfo]::InvariantCulture)
    } catch {
        throw "CutoffDate invalida. Usa formato dd/MM/yyyy"
    }
}

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $HostExportDir | Out-Null
New-Item -ItemType Directory -Force -Path $HostSchemaDir | Out-Null

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Invoke-External {
    param(
        [scriptblock]$Command,
        [string]$ErrorMessage
    )

    $output = & $Command 2>&1
    if ($LASTEXITCODE -ne 0) {
        $detail = ($output | Out-String).Trim()
        if ($detail) {
            throw "$ErrorMessage`n$detail"
        }
        throw $ErrorMessage
    }
    return $output
}

function Invoke-Psql {
    param(
        [string]$Database,
        [string]$Sql,
        [switch]$TuplesOnly
    )

    $args = @('exec', '-i', $ContainerName, 'psql', '-U', 'stc_user', '-d', $Database, '-v', 'ON_ERROR_STOP=1')
    if ($TuplesOnly) {
        $args += @('-At', '-F', '|')
    } else {
        $args += @('-P', 'pager=off')
    }

    $output = $Sql | & podman @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        $detail = ($output | Out-String).Trim()
        throw "Error ejecutando SQL en $Database`n$detail"
    }
    return $output
}

function Quote-Ident {
    param([string]$Name)
    return '"' + $Name.Replace('"', '""') + '"'
}

function Normalize-ColumnKey {
    param([string]$Name)
    if ($null -eq $Name) {
        return ''
    }

    $value = $Name.Trim().ToUpperInvariant()
    $value = [regex]::Replace($value, '\s+', ' ')
    return $value
}

function Get-TableSchema {
    param(
        [string]$Database,
        [string]$TableName
    )

    $sql = @"
SELECT ordinal_position, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '$TableName'
ORDER BY ordinal_position;
"@

    $rows = Invoke-Psql -Database $Database -Sql $sql -TuplesOnly
    $schema = @()
    foreach ($row in $rows) {
        if ([string]::IsNullOrWhiteSpace($row)) {
            continue
        }
        $parts = $row -split '\|', 3
        $schema += [pscustomobject]@{
            Ordinal = [int]$parts[0]
            ColumnName = $parts[1]
            DataType = $parts[2]
            Key = Normalize-ColumnKey $parts[1]
        }
    }
    return $schema
}

function Get-RowCount {
    param(
        [string]$Database,
        [string]$TableName
    )

    $sql = "SELECT COUNT(*) FROM public.$TableName;"
    $result = Invoke-Psql -Database $Database -Sql $sql -TuplesOnly
    return [int64]($result | Select-Object -First 1)
}

function Get-DateColumn {
    param(
        [string]$Database,
        [string]$TableName,
        [string[]]$Candidates
    )

    foreach ($candidate in $Candidates) {
        $sql = @"
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '$TableName'
  AND lower(column_name) = lower('$candidate')
ORDER BY ordinal_position
LIMIT 1;
"@
        $result = Invoke-Psql -Database $Database -Sql $sql -TuplesOnly | Select-Object -First 1
        if (-not [string]::IsNullOrWhiteSpace($result)) {
            return $result.Trim()
        }
    }

    return $null
}

function Get-DateCounts {
    param(
        [string]$Database,
        [string]$TableName,
        [string]$DateColumn
    )

    if (-not $DateColumn) {
        return @{}
    }

    $quotedDateColumn = Quote-Ident $DateColumn
    $sql = @"
SELECT left(trim($quotedDateColumn), 10) AS fecha, COUNT(*)::bigint AS n
FROM public.$TableName
WHERE coalesce(trim($quotedDateColumn), '') <> ''
GROUP BY 1
ORDER BY 1;
"@

    $rows = Invoke-Psql -Database $Database -Sql $sql -TuplesOnly
    $map = @{}
    foreach ($row in $rows) {
        if ([string]::IsNullOrWhiteSpace($row)) {
            continue
        }
        $parts = $row -split '\|', 2
        if ($parts.Count -eq 2) {
            if ($CutoffDateValue) {
                try {
                    $dateValue = [datetime]::ParseExact($parts[0], 'dd/MM/yyyy', [System.Globalization.CultureInfo]::InvariantCulture)
                } catch {
                    continue
                }
                if ($dateValue -gt $CutoffDateValue) {
                    continue
                }
            }
            $map[$parts[0]] = [int64]$parts[1]
        }
    }
    return $map
}

function Test-DateWithinCutoff {
    param([string]$RawDate)

    if (-not $CutoffDateValue) {
        return $true
    }

    if ([string]::IsNullOrWhiteSpace($RawDate) -or $RawDate -eq '\N') {
        return $false
    }

    try {
        $parsed = [datetime]::ParseExact($RawDate.Trim(), 'dd/MM/yyyy', [System.Globalization.CultureInfo]::InvariantCulture)
    } catch {
        return $false
    }

    return $parsed -le $CutoffDateValue
}

function Build-ColumnMapping {
    param(
        [object[]]$CurrentSchema,
        [object[]]$TempSchema
    )

    $tempByKey = @{}
    foreach ($column in $TempSchema) {
        if (-not $tempByKey.ContainsKey($column.Key)) {
            $tempByKey[$column.Key] = $column
        }
    }

    $mappings = @()
    foreach ($column in $CurrentSchema) {
        $tempColumn = $null
        if ($tempByKey.ContainsKey($column.Key)) {
            $tempColumn = $tempByKey[$column.Key]
        }

        $mappings += [pscustomobject]@{
            Current = $column
            Temp = $tempColumn
            IsMatched = $null -ne $tempColumn
        }
    }

    return $mappings
}

function Build-ExportSelectList {
    param([object[]]$Mappings)

    $parts = @()
    foreach ($mapping in $Mappings) {
        $currentQuoted = Quote-Ident $mapping.Current.ColumnName
        if ($mapping.IsMatched) {
            $tempQuoted = Quote-Ident $mapping.Temp.ColumnName
            $parts += "$tempQuoted AS $currentQuoted"
        } else {
            $parts += "NULL::text AS $currentQuoted"
        }
    }
    return ($parts -join ', ')
}

function Get-OnlyColumns {
    param(
        [object[]]$Left,
        [object[]]$Right
    )

    $rightKeys = @{}
    foreach ($column in $Right) {
        $rightKeys[$column.Key] = $true
    }

    $result = @()
    foreach ($column in $Left) {
        if (-not $rightKeys.ContainsKey($column.Key)) {
            $result += $column.ColumnName
        }
    }
    return $result
}

function Test-OrderMatches {
    param(
        [object[]]$CurrentSchema,
        [object[]]$TempSchema
    )

    $currentKeys = @($CurrentSchema | ForEach-Object { $_.Key })
    $tempKeys = @($TempSchema | ForEach-Object { $_.Key })
    if ($currentKeys.Count -ne $tempKeys.Count) {
        return $false
    }
    for ($i = 0; $i -lt $currentKeys.Count; $i++) {
        if ($currentKeys[$i] -ne $tempKeys[$i]) {
            return $false
        }
    }
    return $true
}

function Export-CompatibleTableData {
    param(
        [string]$TableName,
        [string]$TempDatabase,
        [string]$HostFile,
        [object[]]$Mappings
    )

    $hostRawFile = Join-Path $HostExportDir "$TableName.raw.tsv"

    & podman exec $ContainerName psql -U stc_user -d $TempDatabase -v ON_ERROR_STOP=1 -q -c "COPY public.$TableName TO STDOUT" | Set-Content -Path $hostRawFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo exportar $TableName desde $TempDatabase"
    }

    $encoding = New-Object System.Text.UTF8Encoding($false)
    $reader = New-Object System.IO.StreamReader($hostRawFile)
    $writer = New-Object System.IO.StreamWriter($HostFile, $false, $encoding)

    try {
        $dateMapping = $null
        if ($CutoffDateValue) {
            $dateMapping = $Mappings | Where-Object { $_.Temp -and $_.Temp.ColumnName -eq $script:ActiveTempDateColumn } | Select-Object -First 1
        }

        while (($line = $reader.ReadLine()) -ne $null) {
            $values = $line -split "`t", -1

            if ($dateMapping) {
                $dateIndex = $dateMapping.Temp.Ordinal - 1
                $rawDate = if ($dateIndex -lt $values.Length) { $values[$dateIndex] } else { $null }
                if (-not (Test-DateWithinCutoff -RawDate $rawDate)) {
                    continue
                }
            }

            $outValues = New-Object System.Collections.Generic.List[string]

            foreach ($mapping in $Mappings) {
                if ($mapping.IsMatched) {
                    $tempIndex = $mapping.Temp.Ordinal - 1
                    if ($tempIndex -lt $values.Length) {
                        $outValues.Add($values[$tempIndex])
                    } else {
                        $outValues.Add('\N')
                    }
                } else {
                    $outValues.Add('\N')
                }
            }

            $writer.WriteLine(($outValues.ToArray() -join "`t"))
        }
    } finally {
        $reader.Dispose()
        $writer.Dispose()
    }
}

function Join-Lines {
    param([string[]]$Lines)
    return ($Lines -join [Environment]::NewLine)
}

function Build-MergeSql {
    param(
        [hashtable]$TableState,
        [string]$RemoteDir
    )

    $lines = @(
        '\set ON_ERROR_STOP on',
        'SET client_min_messages = warning;',
        '',
        'BEGIN;',
        'CREATE SCHEMA IF NOT EXISTS audit_recovery;',
        ''
    )

    foreach ($tableName in $TargetTables) {
        $state = $TableState[$tableName]
        $stageTable = "audit_recovery.${tableName}_stage"
        $remoteFile = "$RemoteDir/$tableName.tsv"
        $excludedComparableColumns = @($state.OnlyInCurrent)
        $hasExcludedComparableColumns = $excludedComparableColumns.Count -gt 0
        $excludedJsonArray = if ($hasExcludedComparableColumns) {
            'ARRAY[' + (($excludedComparableColumns | ForEach-Object { "'$_'" }) -join ', ') + ']'
        } else {
            $null
        }

        $insertBody = if ($hasExcludedComparableColumns) {
            @(
                '  missing AS (',
                '      SELECT s.*',
                "      FROM $stageTable s",
                '      WHERE NOT EXISTS (',
                "        SELECT 1 FROM public.$tableName c",
                "        WHERE (to_jsonb(c) - $excludedJsonArray) = (to_jsonb(s) - $excludedJsonArray)",
                '      )',
                '    )',
                '  , inserted AS (',
                "      INSERT INTO public.$tableName",
                '      SELECT * FROM missing',
                '      RETURNING 1',
                '    )'
            )
        } else {
            @(
                '  missing AS (',
                "      SELECT * FROM $stageTable",
                '      EXCEPT',
                "      SELECT * FROM public.$tableName",
                '    )',
                '  , inserted AS (',
                "      INSERT INTO public.$tableName",
                '      SELECT * FROM missing',
                '      RETURNING 1',
                '    )'
            )
        }

        $lines += @(
            "\echo $tableName",
            "DROP TABLE IF EXISTS $stageTable;",
            "CREATE TABLE $stageTable (LIKE public.$tableName);",
            "\copy $stageTable FROM '$remoteFile' WITH (FORMAT text)",
            'WITH',
            $insertBody,
            "SELECT '$tableName' AS tabla, COUNT(*) AS inserted_rows FROM inserted;",
            ''
        )
    }

    $lines += @(
        'COMMIT;',
        ''
    )

    return (Join-Lines -Lines $lines)
}

function Build-Report {
    param([hashtable]$TableState)

    $lines = @(
        '# Recuperacion segura de historico CSV',
        '',
        "- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "- Dump: $DumpFile",
        "- Base actual: $CurrentDb",
        "- Base temporal: $TempDbName",
        "- Fecha de corte: $(if ($CutoffDate) { $CutoffDate } else { 'sin corte' })",
        "- Aplica merge: $ApplyMerge",
        "- Tablas protegidas (no tocadas): $($ProtectedTables -join ', ')",
        ''
    )

    foreach ($tableName in $TargetTables) {
        $state = $TableState[$tableName]
        $onlyInCurrent = if ($state.OnlyInCurrent.Count -gt 0) { $state.OnlyInCurrent -join ', ' } else { '(ninguna)' }
        $onlyInTemp = if ($state.OnlyInTemp.Count -gt 0) { $state.OnlyInTemp -join ', ' } else { '(ninguna)' }
        $currentOnlyDates = if ($state.DatesOnlyInCurrent.Count -gt 0) { ($state.DatesOnlyInCurrent | Select-Object -First 10) -join ', ' } else { '(ninguna)' }
        $tempOnlyDates = if ($state.DatesOnlyInTemp.Count -gt 0) { ($state.DatesOnlyInTemp | Select-Object -First 10) -join ', ' } else { '(ninguna)' }
        $filledNullColumns = @($state.Mappings | Where-Object { -not $_.IsMatched } | ForEach-Object { $_.Current.ColumnName })
        $filledNullText = if ($filledNullColumns.Count -gt 0) { $filledNullColumns -join ', ' } else { '(ninguna)' }

        $lines += @(
            "## $tableName",
            '',
            "- Filas actuales: $($state.CurrentCount)",
            "- Filas en dump temporal: $($state.TempCount)",
            "- Columnas actuales: $($state.CurrentSchema.Count)",
            "- Columnas en dump: $($state.TempSchema.Count)",
            "- Orden coincide case-insensitive: $($state.OrderMatches)",
            "- Solo en actual: $onlyInCurrent",
            "- Solo en dump: $onlyInTemp",
            "- Columnas que entran como NULL al recuperar: $filledNullText",
            "- Fechas solo en actual (muestra): $currentOnlyDates",
            "- Fechas solo en dump (muestra): $tempOnlyDates",
            '',
            '| Fecha | Actual | Dump |',
            '| --- | ---: | ---: |'
        )

        foreach ($date in @('29/04/2026', '30/04/2026', '13/05/2026')) {
            $currentValue = if ($state.CurrentDateCounts.ContainsKey($date)) { $state.CurrentDateCounts[$date] } else { 0 }
            $tempValue = if ($state.TempDateCounts.ContainsKey($date)) { $state.TempDateCounts[$date] } else { 0 }
            $lines += "| $date | $currentValue | $tempValue |"
        }

        $lines += ''
    }

    return (Join-Lines -Lines $lines)
}

function Backup-SafetyTables {
    param([string]$OutputFile)

    $dumpArgs = @('exec', $ContainerName, 'pg_dump', '-U', 'stc_user', '-d', $CurrentDb, '--clean', '--if-exists')
    foreach ($tableName in $SafetyBackupTables) {
        $dumpArgs += @('-t', $tableName)
    }

    $output = & podman @dumpArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        $detail = ($output | Out-String).Trim()
        throw "No se pudo generar el backup preventivo`n$detail"
    }

    $output | Out-File -FilePath $OutputFile -Encoding utf8
}

function Remove-TempArtifacts {
    param([bool]$DropTempDb)

    try {
        Invoke-External -ErrorMessage "No se pudo limpiar directorio remoto temporal" -Command {
            podman exec $ContainerName sh -lc "rm -rf '$RemoteWorkDir'"
        } | Out-Null
    } catch {
        Write-Warning $_
    }

    if ($DropTempDb) {
        try {
            Invoke-External -ErrorMessage "No se pudo borrar base temporal $TempDbName" -Command {
                podman exec $ContainerName dropdb -U stc_user --if-exists $TempDbName
            } | Out-Null
        } catch {
            Write-Warning $_
        }
    }
}

if (-not (Test-Path $DumpFile)) {
    throw "Dump no encontrado: $DumpFile"
}

Write-Step "Validando contenedor y preparando espacio temporal"
Invoke-External -ErrorMessage "El contenedor $ContainerName no esta disponible" -Command {
    podman exec $ContainerName pg_isready -U stc_user -d $CurrentDb
} | Out-Null

Invoke-External -ErrorMessage "No se pudo preparar el directorio temporal remoto" -Command {
    podman exec $ContainerName sh -lc "rm -rf '$RemoteWorkDir' && mkdir -p '$RemoteWorkDir'"
} | Out-Null

Invoke-External -ErrorMessage "No se pudo copiar el dump al contenedor" -Command {
    podman cp $DumpFile "${ContainerName}:$RemoteDumpFile"
} | Out-Null

Write-Step "Creando base temporal y restaurando solo tablas CSV"
Invoke-External -ErrorMessage "No se pudo crear la base temporal $TempDbName" -Command {
    podman exec $ContainerName createdb -U stc_user $TempDbName
} | Out-Null

Invoke-External -ErrorMessage "No se pudo restaurar tablas CSV en $TempDbName" -Command {
    podman exec $ContainerName pg_restore -U stc_user -d $TempDbName --no-owner --no-privileges -t tb_calidad -t tb_defectos -t tb_produccion $RemoteDumpFile
} | Out-Null

$tableState = @{}
$dateCandidates = @{
    tb_calidad = @('DAT_PROD', 'dat_prod')
    tb_defectos = @('DATA_PROD', 'data_prod')
    tb_produccion = @('DT_BASE_PRODUCAO', 'dt_base_producao')
}

Write-Step "Comparando esquema y fechas entre base actual y dump"
foreach ($tableName in $TargetTables) {
    $currentSchema = Get-TableSchema -Database $CurrentDb -TableName $tableName
    $tempSchema = Get-TableSchema -Database $TempDbName -TableName $tableName
    $mappings = Build-ColumnMapping -CurrentSchema $currentSchema -TempSchema $tempSchema

    $currentDateColumn = Get-DateColumn -Database $CurrentDb -TableName $tableName -Candidates $dateCandidates[$tableName]
    $tempDateColumn = Get-DateColumn -Database $TempDbName -TableName $tableName -Candidates $dateCandidates[$tableName]

    $currentDateCounts = Get-DateCounts -Database $CurrentDb -TableName $tableName -DateColumn $currentDateColumn
    $tempDateCounts = Get-DateCounts -Database $TempDbName -TableName $tableName -DateColumn $tempDateColumn

    $currentDates = @($currentDateCounts.Keys | Sort-Object)
    $tempDates = @($tempDateCounts.Keys | Sort-Object)

    $tableState[$tableName] = [pscustomobject]@{
        CurrentSchema = $currentSchema
        TempSchema = $tempSchema
        Mappings = $mappings
        OnlyInCurrent = Get-OnlyColumns -Left $currentSchema -Right $tempSchema
        OnlyInTemp = Get-OnlyColumns -Left $tempSchema -Right $currentSchema
        OrderMatches = Test-OrderMatches -CurrentSchema $currentSchema -TempSchema $tempSchema
        CurrentCount = if ($CutoffDateValue) { ($currentDateCounts.Values | Measure-Object -Sum).Sum } else { Get-RowCount -Database $CurrentDb -TableName $tableName }
        TempCount = if ($CutoffDateValue) { ($tempDateCounts.Values | Measure-Object -Sum).Sum } else { Get-RowCount -Database $TempDbName -TableName $tableName }
        CurrentDateCounts = $currentDateCounts
        TempDateCounts = $tempDateCounts
        DatesOnlyInCurrent = @($currentDates | Where-Object { -not $tempDateCounts.ContainsKey($_) })
        DatesOnlyInTemp = @($tempDates | Where-Object { -not $currentDateCounts.ContainsKey($_) })
    }
}

Write-Step "Exportando staging compatible y generando SQL de merge"
foreach ($tableName in $TargetTables) {
    $remoteFile = "$RemoteWorkDir/$tableName.tsv"
    $hostFile = Join-Path $HostExportDir "$tableName.tsv"
    $script:ActiveTempDateColumn = $dateCandidates[$tableName] | ForEach-Object {
        Get-DateColumn -Database $TempDbName -TableName $tableName -Candidates @($_)
    } | Where-Object { $_ } | Select-Object -First 1
    Export-CompatibleTableData -TableName $tableName -TempDatabase $TempDbName -HostFile $hostFile -Mappings $tableState[$tableName].Mappings
    Invoke-External -ErrorMessage "No se pudo copiar export de $tableName al host" -Command {
        podman cp $hostFile "${ContainerName}:$remoteFile"
    } | Out-Null

    $schemaLines = @(
        "# $tableName",
        '',
        '## Actual',
        ''
    )
    $schemaLines += @($tableState[$tableName].CurrentSchema | ForEach-Object { "- $($_.Ordinal): $($_.ColumnName)" })
    $schemaLines += @('', '## Dump', '')
    $schemaLines += @($tableState[$tableName].TempSchema | ForEach-Object { "- $($_.Ordinal): $($_.ColumnName)" })
    Set-Content -Path (Join-Path $HostSchemaDir "$tableName.md") -Value (Join-Lines -Lines $schemaLines) -Encoding utf8
}

$mergeSql = Build-MergeSql -TableState $tableState -RemoteDir $RemoteWorkDir
Set-Content -Path $MergeSqlPath -Value $mergeSql -Encoding utf8

$report = Build-Report -TableState $tableState
Set-Content -Path $ReportPath -Value $report -Encoding utf8

if ($ApplyMerge) {
    Write-Step "Generando backup preventivo de tablas CSV + USTER + TENSORAPID"
    Backup-SafetyTables -OutputFile $SafetyBackupPath

    Write-Step "Aplicando merge aditivo sobre tablas CSV"
    $remoteMergeSql = "$RemoteWorkDir/merge-missing-history.sql"
    Invoke-External -ErrorMessage "No se pudo copiar SQL de merge al contenedor" -Command {
        podman cp $MergeSqlPath "${ContainerName}:$remoteMergeSql"
    } | Out-Null

    Invoke-External -ErrorMessage "No se pudo aplicar el merge SQL" -Command {
        podman exec $ContainerName psql -U stc_user -d $CurrentDb -v ON_ERROR_STOP=1 -f $remoteMergeSql
    } | Out-Null

    Write-Step "Verificando que USTER y TENSORAPID sigan intactos"
    $verifySql = @"
SELECT 'tb_uster_par' AS tabla, COUNT(*) AS n FROM tb_uster_par
UNION ALL
SELECT 'tb_uster_tbl', COUNT(*) FROM tb_uster_tbl
UNION ALL
SELECT 'tb_tensorapid_par', COUNT(*) FROM tb_tensorapid_par
UNION ALL
SELECT 'tb_tensorapid_tbl', COUNT(*) FROM tb_tensorapid_tbl
ORDER BY 1;
"@
    $verification = Invoke-Psql -Database $CurrentDb -Sql $verifySql -TuplesOnly
    $targetVerifySql = @"
SELECT 'tb_calidad' AS tabla, COUNT(*) AS n FROM tb_calidad
UNION ALL
SELECT 'tb_defectos', COUNT(*) FROM tb_defectos
UNION ALL
SELECT 'tb_produccion', COUNT(*) FROM tb_produccion
ORDER BY 1;
"@
    $targetVerification = Invoke-Psql -Database $CurrentDb -Sql $targetVerifySql -TuplesOnly

    Add-Content -Path $ReportPath -Value '' -Encoding utf8
    Add-Content -Path $ReportPath -Value '## Verificacion post-merge' -Encoding utf8
    Add-Content -Path $ReportPath -Value '' -Encoding utf8
    foreach ($line in $targetVerification) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            $parts = $line -split '\|', 2
            Add-Content -Path $ReportPath -Value "- $($parts[0]): $($parts[1])" -Encoding utf8
        }
    }
    Add-Content -Path $ReportPath -Value '' -Encoding utf8
    Add-Content -Path $ReportPath -Value '### Tablas protegidas' -Encoding utf8
    Add-Content -Path $ReportPath -Value '' -Encoding utf8
    foreach ($line in $verification) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            $parts = $line -split '\|', 2
            Add-Content -Path $ReportPath -Value "- $($parts[0]): $($parts[1])" -Encoding utf8
        }
    }
}

Write-Step "Finalizado"
Write-Host "Reporte: $ReportPath"
Write-Host "SQL merge: $MergeSqlPath"
if ($ApplyMerge) {
    Write-Host "Backup preventivo: $SafetyBackupPath"
}

Remove-TempArtifacts -DropTempDb:$CleanupTempDb