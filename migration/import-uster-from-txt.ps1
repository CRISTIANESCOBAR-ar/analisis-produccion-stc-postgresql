# =====================================================
# Importar datos de USTER desde archivos TXT de Oracle
# =====================================================

param(
    [string]$ParFile = "C:\STC\USTER_PAR.TXT",
    [string]$TblFile = "C:\STC\USTER_TBL.TXT"
)

Write-Host "🔄 Iniciando importación de datos USTER..."
Write-Host ""

# Verificar que los archivos existen
if (-not (Test-Path $ParFile)) {
    Write-Host "❌ No se encontró el archivo: $ParFile"
    exit 1
}

if (-not (Test-Path $TblFile)) {
    Write-Host "❌ No se encontró el archivo: $TblFile"
    exit 1
}

Write-Host "📁 Archivos encontrados:"
Write-Host "   PAR: $ParFile"
Write-Host "   TBL: $TblFile"
Write-Host ""

# Función para convertir líneas INSERT de Oracle a PostgreSQL
function Convert-OracleToPostgres {
    param([string]$Line)
    
    # Cambiar esquema SYSTEM.USTER_PAR a tb_uster_par (minúsculas)
    $Line = $Line -replace "Insert into SYSTEM\.USTER_PAR", "INSERT INTO tb_uster_par"
    $Line = $Line -replace "Insert into SYSTEM\.USTER_TBL", "INSERT INTO tb_uster_tbl"
    
    # Convertir to_timestamp de Oracle a formato PostgreSQL
    # Oracle: to_timestamp('03/11/25 11:19:38,525000000','DD/MM/RR HH24:MI:SSXFF')
    # PostgreSQL: '2025-11-03 11:19:38.525'::timestamp
    $Line = $Line -replace "to_timestamp\('(\d{2})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})\d*','DD/MM/RR HH24:MI:SSXFF'\)", "'20`$3-`$2-`$1 `$4:`$5:`$6.`$7'::timestamp"
    
    # Reemplazar comas por puntos en números decimales (entre comillas simples)
    # Esto es para valores como '12,5' → '12.5'
    $Line = $Line -replace ",'(\d+),(\d+)'", ",'`$1.`$2'"
    
    return $Line
}

# Función para extraer valores de INSERT de Oracle para USTER_PAR
function Convert-UsterParLine {
    param([string]$Line)
    
    # Extraer valores usando regex
    if ($Line -match "values \((.+)\);") {
        $values = $matches[1]
        
        # Parsear los valores (esto es simplificado, podría necesitar mejoras)
        # Columnas Oracle: TESTNR,CATALOG,TIME_STAMP,LOTE,SORTIMENT,ARTICLE,MASCHNR,MATCLASS,NOMCOUNT,NOMTWIST,USCODE,FB_MIC,FB_TIPO,FB_LONG,FB_PORC,LABORANT,TUNAME,GROUPS,WITHIN,TOTAL,SPEED,TESTTIME,SLOT,ABSORBERPRESSURE,CREATED_AT,ESTIRAJE,PASADOR
        # Indices:         0        1       2          3    4         5       6       7        8        9        10     11     12      13      14     15       16     17     18     19    20    21       22   23                24         25       26
        
        # Dividir por comas respetando comillas
        $parts = @()
        $current = ""
        $inQuote = $false
        $parenCount = 0
        
        for ($i = 0; $i -lt $values.Length; $i++) {
            $char = $values[$i]
            
            if ($char -eq "'" -and ($i -eq 0 -or $values[$i-1] -ne '\')) {
                $inQuote = -not $inQuote
                $current += $char
            }
            elseif ($char -eq '(' -and -not $inQuote) {
                $parenCount++
                $current += $char
            }
            elseif ($char -eq ')' -and -not $inQuote) {
                $parenCount--
                $current += $char
            }
            elseif ($char -eq ',' -and -not $inQuote -and $parenCount -eq 0) {
                $parts += $current.Trim()
                $current = ""
            }
            else {
                $current += $char
            }
        }
        if ($current) {
            $parts += $current.Trim()
        }
        
        # Mapear a columnas PostgreSQL: testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs, created_at
        $testnr = $parts[0]      # TESTNR
        $nomcount = $parts[8]    # NOMCOUNT
        $maschnr = $parts[6]     # MASCHNR  
        $lote = $parts[3]        # LOTE
        $laborant = $parts[15]   # LABORANT
        $time_stamp = $parts[2]  # TIME_STAMP
        $matclass = $parts[7]    # MATCLASS
        $estiraje = $parts[25]   # ESTIRAJE
        $pasador = $parts[26]    # PASADOR
        $created_at = $parts[24] # CREATED_AT
        
        # Convertir to_timestamp
        $created_at = $created_at -replace "to_timestamp\('(\d{2})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})\d*','DD/MM/RR HH24:MI:SSXFF'\)", "'20`$3-`$2-`$1 `$4:`$5:`$6.`$7'::timestamp"
        
        # Reemplazar comas por puntos en números
        $nomcount = $nomcount -replace ",'(\d+),(\d+)'", ",'`$1.`$2'"
        $nomcount = $nomcount -replace "'(\d+),(\d+)'", "'`$1.`$2'"
        
        return "INSERT INTO tb_uster_par (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, created_at) VALUES ($testnr, $nomcount, $maschnr, $lote, $laborant, $time_stamp, $matclass, $estiraje, $pasador, $created_at);"
    }
    
    return $null
}

# Crear archivo temporal para PostgreSQL - USTER_PAR
Write-Host "🔄 Procesando USTER_PAR..."
$tempParFile = "$env:TEMP\uster_par_postgres.sql"
$parLines = Get-Content $ParFile
$insertCount = 0

# Escribir encabezado
@"
-- Importación de USTER_PAR desde Oracle
-- Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

BEGIN;

-- Limpiar tabla
TRUNCATE TABLE tb_uster_par CASCADE;

"@ | Out-File -FilePath $tempParFile -Encoding UTF8

foreach ($line in $parLines) {
    if ($line -match "^Insert into SYSTEM\.USTER_PAR") {
        $converted = Convert-OracleToPostgres -Line $line
        # Remover las columnas que no existen en PostgreSQL
        $converted = $converted -replace "\(ID,TESTNR,", "(TESTNR,"
        $converted = $converted -replace " values\s*\('\d+',", " VALUES ("
        $converted | Out-File -FilePath $tempParFile -Append -Encoding UTF8
        $insertCount++
    }
}

"COMMIT;" | Out-File -FilePath $tempParFile -Append -Encoding UTF8
Write-Host "   ✅ $insertCount registros procesados"

# Crear archivo temporal para PostgreSQL - USTER_TBL
Write-Host "🔄 Procesando USTER_TBL..."
$tempTblFile = "$env:TEMP\uster_tbl_postgres.sql"
$tblLines = Get-Content $TblFile
$insertCount = 0

# Escribir encabezado
@"
-- Importación de USTER_TBL desde Oracle
-- Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

BEGIN;

-- Limpiar tabla
DELETE FROM tb_uster_tbl;

"@ | Out-File -FilePath $tempTblFile -Encoding UTF8

foreach ($line in $tblLines) {
    if ($line -match "^Insert into SYSTEM\.USTER_TBL") {
        $converted = Convert-OracleToPostgres -Line $line
        # Remover la columna ID (es SERIAL en PostgreSQL)
        $converted = $converted -replace "\(ID,TESTNR,", "(TESTNR,"
        $converted = $converted -replace " values\s*\('\d+',", " VALUES ("
        $converted | Out-File -FilePath $tempTblFile -Append -Encoding UTF8
        $insertCount++
    }
}

"COMMIT;" | Out-File -FilePath $tempTblFile -Append -Encoding UTF8
Write-Host "   ✅ $insertCount registros procesados"
Write-Host ""

# Importar a PostgreSQL
Write-Host "📤 Importando a PostgreSQL..."
Write-Host ""

Write-Host "1️⃣  Importando USTER_PAR..."
try {
    Get-Content $tempParFile | podman exec -i stc_postgres psql -U stc_user -d stc_produccion
    Write-Host "   ✅ USTER_PAR importado correctamente"
} catch {
    Write-Host "   ❌ Error importando USTER_PAR: $_"
    exit 1
}

Write-Host ""
Write-Host "2️⃣  Importando USTER_TBL..."
try {
    Get-Content $tempTblFile | podman exec -i stc_postgres psql -U stc_user -d stc_produccion
    Write-Host "   ✅ USTER_TBL importado correctamente"
} catch {
    Write-Host "   ❌ Error importando USTER_TBL: $_"
    exit 1
}

Write-Host ""
Write-Host "🔍 Verificando datos importados..."
podman exec stc_postgres psql -U stc_user -d stc_produccion -c "
    SELECT 
        'tb_uster_par' as tabla, 
        COUNT(*) as registros 
    FROM tb_uster_par
    UNION ALL
    SELECT 
        'tb_uster_tbl' as tabla, 
        COUNT(*) as registros 
    FROM tb_uster_tbl;
"

Write-Host ""
Write-Host "✅ Importación completada!"
Write-Host ""
Write-Host "Archivos temporales generados:"
Write-Host "   $tempParFile"
Write-Host "   $tempTblFile"
