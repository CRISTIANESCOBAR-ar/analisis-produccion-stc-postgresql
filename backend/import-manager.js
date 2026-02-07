import fs from 'fs';
import path from 'path';
import { parse as parseSync } from 'csv-parse/sync';
import { parse as parseStream } from 'csv-parse';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { from as copyFrom } from 'pg-copy-streams';
import pkg from 'pg';
const { Pool } = pkg;

const FULL_TRUNCATE_TABLES = new Set([
  'tb_fichas',
  'tb_calidad_fibra',
  'tb_proceso'
]);

// Tablas con estrategia incremental: borrar solo fechas presentes en el CSV
// (Basado en la estrategia del proyecto anterior analisis-produccion-stc)
const TABLE_DATE_COLUMN = {
  tb_produccion: 'DT_BASE_PRODUCAO',
  tb_produccion_oe: 'data_producao',
  tb_testes: 'dt_prod',
  tb_paradas: 'data_base',
  tb_residuos_por_sector: 'DT_MOV',
  tb_residuos_indigo: 'DT_MOV',
  tb_calidad: 'DAT_PROD',
  tb_defectos: 'data_prod'
};

const MAX_DISTINCT_DATES_FOR_DELETE = 31;

function safeTableName(tableName) {
  const t = String(tableName ?? '').toLowerCase().trim();
  if (!/^[a-z0-9_]+$/u.test(t)) {
    throw new Error(`Nombre de tabla no seguro: ${tableName}`);
  }
  return t;
}

function quoteIdent(name) {
  return `"${String(name ?? '').replace(/"/g, '""')}"`;
}

function parseDateToISO(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  // dd/mm/yyyy
  const m1 = s.match(/^([0-3]\d)\/([0-1]\d)\/(\d{4})$/u);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // yyyy-mm-dd (o yyyy-mm-dd HH:..)
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2})/u);
  if (m2) return m2[1];
  return null;
}

async function getTableColumnType(client, tableName, columnName) {
  const query = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND lower(column_name) = lower($2)
    LIMIT 1
  `;
  const res = await client.query(query, [safeTableName(tableName), String(columnName ?? '')]);
  if (!res.rows?.[0]) return { column_name: null, data_type: null };
  return { column_name: res.rows[0].column_name, data_type: res.rows[0].data_type };
}

async function scanCsvDistinctDates(csvPath, desiredDateColumn) {
  const headerLine = readFirstLine(csvPath);
  const originalHeaders = headerLine.split(',').map(normalizeHeaderName);
  const headers = renameduplicateHeaders(originalHeaders);

  const desiredKey = canonicalColumnKey(desiredDateColumn);
  const csvHeader =
    headers.find((h) => canonicalColumnKey(h) === desiredKey) ||
    headers.find((h) => h.toLowerCase() === String(desiredDateColumn).toLowerCase());

  if (!csvHeader) {
    return { dates: new Set(), csvHeader: null, headers };
  }

  const dates = new Set();

  const parser = parseStream({
    columns: headers,
    from_line: 2,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true
  });

  parser.on('data', (record) => {
    const raw = record?.[csvHeader];
    // Filtrar filas de header repetido
    if (raw === csvHeader) return;
    const iso = parseDateToISO(raw);
    if (!iso) return;
    dates.add(iso);
    if (dates.size > MAX_DISTINCT_DATES_FOR_DELETE) {
      parser.destroy(
        new Error(
          `Demasiadas fechas distintas (${dates.size}) en ${path.basename(csvPath)} para date_delete (límite ${MAX_DISTINCT_DATES_FOR_DELETE})`
        )
      );
    }
  });

  await pipeline(fs.createReadStream(csvPath), parser);
  return { dates, csvHeader, headers };
}

async function applyImportStrategy(client, tableName, csvPath) {
  const safeTable = safeTableName(tableName);

  if (FULL_TRUNCATE_TABLES.has(safeTable)) {
    console.log(`[IMPORT] TRUNCATE TABLE ${safeTable} (strategy=truncate)`);
    await client.query(`TRUNCATE TABLE ${safeTable}`);
    return {
      strategy: 'truncate',
      dateColumn: null,
      deletedDates: 0,
      deletedRows: null,
      deleteDates: []
    };
  }

  const dateColumn = TABLE_DATE_COLUMN[safeTable];
  if (!dateColumn) {
    console.log(`[IMPORT] TRUNCATE TABLE ${safeTable} (strategy=truncate; no dateColumn)`);
    await client.query(`TRUNCATE TABLE ${safeTable}`);
    return {
      strategy: 'truncate',
      dateColumn: null,
      deletedDates: 0,
      deletedRows: null,
      deleteDates: []
    };
  }

  const colInfo = await getTableColumnType(client, safeTable, dateColumn);
  const resolvedDateColumn = colInfo.column_name;
  if (!resolvedDateColumn) {
    console.log(
      `[IMPORT] TRUNCATE TABLE ${safeTable} (strategy=truncate; dateColumn no existe: ${dateColumn})`
    );
    await client.query(`TRUNCATE TABLE ${safeTable}`);
    return {
      strategy: 'truncate',
      dateColumn: null,
      deletedDates: 0,
      deletedRows: null,
      deleteDates: []
    };
  }

  const { dates } = await scanCsvDistinctDates(csvPath, resolvedDateColumn);
  const deleteDates = Array.from(dates).sort();
  if (deleteDates.length === 0) {
    return {
      strategy: 'date_delete',
      dateColumn: resolvedDateColumn,
      deletedDates: 0,
      deletedRows: 0,
      deleteDates
    };
  }

  const dataType = colInfo.data_type || 'text';
  const qcol = quoteIdent(resolvedDateColumn);

  let dateExpr;
  if (dataType === 'date') {
    dateExpr = `${qcol}`;
  } else if (dataType.includes('timestamp')) {
    dateExpr = `DATE(${qcol})`;
  } else {
    // TEXT u otros: soportar DD/MM/YYYY y YYYY-MM-DD(+hora)
    dateExpr = `(
      CASE
        WHEN ${qcol} IS NULL OR ${qcol} = '' THEN NULL
        WHEN ${qcol} ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring(${qcol} from 1 for 10), 'DD/MM/YYYY')
        WHEN ${qcol} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${qcol} from 1 for 10)::date
        ELSE NULL
      END
    )`;
  }

  const delSql = `DELETE FROM ${safeTable} WHERE ${dateExpr} = ANY($1::date[])`;
  const delRes = await client.query(delSql, [deleteDates]);

  return {
    strategy: 'date_delete',
    dateColumn: resolvedDateColumn,
    deletedDates: deleteDates.length,
    deletedRows: delRes?.rowCount ?? null,
    deleteDates
  };
}

function normalizeHeaderName(header) {
  return String(header ?? '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalColumnKey(name) {
  // Canoniza para comparar nombres entre CSV/PG aunque difieran en acentos/puntuación/espacios.
  // Ejemplos que deben equivaler:
  // - "PRODUÇÃO" ~ "PRODUCAO"
  // - "COD. RETALHO" ~ "COD# RETALHO"
  // - "SAP 1" ~ "SAP1"
  // - "MOTIVO 1" ~ "motivo1"
  let s = normalizeHeaderName(name)

  // Quitar sufijos aclaratorios entre paréntesis: "OBSERVACAO (DO TESTE)" -> "OBSERVACAO"
  s = s.replace(/\s*\([^)]*\)\s*/gu, ' ').replace(/\s+/g, ' ').trim()

  // Normalizar prefijos con +: "+b" -> "PLUS b"
  s = s.replace(/^\+\s*([0-9A-Za-z]+)/u, 'PLUS $1')

  // Alinear columnas duplicadas cuando el esquema usa sufijos _2, _3... y el CSV usa " 1", " 2"...
  // Ej: "FORNECEDOR_2" (PG) debe equivaler a "FORNECEDOR 1" (CSV deduplicado)
  s = s.replace(/_(\d+)$/u, (_m, nRaw) => {
    const n = Number(nRaw)
    if (!Number.isFinite(n) || n < 2) return `_${nRaw}`
    return ` ${n - 1}`
  })
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch {
    // ignore: older runtimes
  }
  // Eliminar el espacio antes de sufijo numérico ("X 1" -> "X1")
  s = s.replace(/\s+(\d+)$/u, '$1')
  // Unificar separadores/puntuación a espacios
  s = s.replace(/[^0-9A-Za-z]+/gu, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s.toLowerCase()
}

function readFirstLine(csvPath) {
  const fd = fs.openSync(csvPath, 'r');
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const chunk = buffer.toString('utf-8', 0, bytesRead);
    const nl = chunk.indexOf('\n');
    const line = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/\r$/u, '');
    return line;
  } finally {
    fs.closeSync(fd);
  }
}

function toCsvField(value) {
  if (value == null) return '';
  const s = String(value);
  if (s === '') return '';
  if (/[\n\r,"]/u.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isCopyEnabled() {
  const v = (process.env.IMPORT_COPY_ENABLED ?? '').toString().trim().toLowerCase();
  if (v === '') return true;
  return !(v === '0' || v === 'false' || v === 'no');
}

/**
 * Renombra headers duplicados agregando sufijos con ESPACIO (adaptado para schema PostgreSQL)
 * Schema real: "TOTAL MINUTOS TUR", "TOTAL MINUTOS TUR 1", "TOTAL MINUTOS TUR 2"
 */
export function renameduplicateHeaders(headers) {
  const seenColumns = {};
  const renamedHeaders = [];
  
  for (const header of headers) {
    const key = normalizeHeaderName(header);
    if (seenColumns[key]) {
      seenColumns[key] += 1;
      // Primera duplicación (contador=2): " 1"
      // Segunda duplicación (contador=3): " 2", etc.
      renamedHeaders.push(`${key} ${seenColumns[key] - 1}`);
    } else {
      seenColumns[key] = 1;
      renamedHeaders.push(key);
    }
  }
  
  return renamedHeaders;
}

/**
 * Lee un CSV y retorna los headers y registros parseados
 */
export function readCSV(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Archivo no encontrado: ${csvPath}`);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const originalHeaders = lines[0].split(',').map(normalizeHeaderName);
  
  // Renombrar headers duplicados
  const renamedHeaders = renameduplicateHeaders(originalHeaders);
  
  // Reemplazar primera línea con headers renombrados
  lines[0] = renamedHeaders.join(',');
  const csvContentWithRenamedHeaders = lines.join('\n');
  
  // Parsear CSV
  const records = parseSync(csvContentWithRenamedHeaders, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
  
  return {
    headers: renamedHeaders,
    records,
    totalRecords: records.length
  };
}

/**
 * Obtiene las columnas de una tabla en PostgreSQL
 */
export async function getTableColumns(client, tableName) {
  const query = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position
  `;
  const result = await client.query(query, [tableName.toLowerCase()]);
  return result.rows.map(r => r.column_name);
}

/**
 * Compara columnas del CSV vs PostgreSQL
 */
export function compareColumns(csvHeaders, pgColumns) {
  const pgKeySet = new Set(pgColumns.map((c) => canonicalColumnKey(c)))
  const csvKeySet = new Set(csvHeaders.map((h) => canonicalColumnKey(h)))

  const extraInCSV = csvHeaders.filter((h) => h && !pgKeySet.has(canonicalColumnKey(h)))

  const missingInCSV = pgColumns.filter((pg) => !csvKeySet.has(canonicalColumnKey(pg)))
  
  return {
    extraInCSV, // Columnas nuevas en CSV que no están en PostgreSQL
    missingInCSV, // Columnas en PostgreSQL que no están en CSV
    hasDifferences: extraInCSV.length > 0 || missingInCSV.length > 0
  };
}

/**
 * Agrega columnas nuevas a una tabla PostgreSQL
 */
export async function addColumnsToTable(client, tableName, columns) {
  if (columns.length === 0) return { added: 0, columns: [] };
  
  const addedColumns = [];
  
  for (const columnName of columns) {
    if (!columnName || columnName.trim() === '') continue;
    
    try {
      const alterQuery = `ALTER TABLE ${tableName.toLowerCase()} ADD COLUMN IF NOT EXISTS "${columnName}" TEXT`;
      await client.query(alterQuery);
      addedColumns.push(columnName);
    } catch (err) {
      console.error(`Error agregando columna ${columnName} a ${tableName}:`, err.message);
      throw err;
    }
  }
  
  return {
    added: addedColumns.length,
    columns: addedColumns
  };
}

/**
 * Registra una operación en el historial
 */
export async function logSyncHistory(client, data) {
  const insertQuery = `
    INSERT INTO tb_sync_history (
      operation_type,
      table_name,
      description,
      columns_added,
      columns_count,
      rows_affected,
      success,
      error_message,
      execution_time_ms,
      user_action
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;
  
  const values = [
    data.operation_type,
    data.table_name,
    data.description || null,
    data.columns_added || [],
    data.columns_count || 0,
    data.rows_affected || 0,
    data.success !== false,
    data.error_message || null,
    data.execution_time_ms || 0,
    data.user_action || 'MANUAL'
  ];
  
  const result = await client.query(insertQuery, values);
  return result.rows[0].id;
}

/**
 * Importa datos desde CSV a PostgreSQL con mapeo de columnas
 */
export async function importCSVToTable(client, csvPath, tableName, columnMapping = null) {
  const startTime = Date.now();
  
  // Leer CSV
  const { headers, records } = readCSV(csvPath);
  
  // Obtener columnas de PostgreSQL
  const pgColumns = await getTableColumns(client, tableName);
  
  // Si hay mapeo de columnas, usarlo; si no, mapeo directo
  const getColumnValue = (record, csvCol, pgCol) => {
    if (columnMapping && columnMapping[csvCol]) {
      return record[csvCol] || null;
    }
    // Buscar coincidencia exacta (case-insensitive)
    const matchingKey = Object.keys(record).find(k => k.toLowerCase() === pgCol.toLowerCase());
    return matchingKey ? record[matchingKey] : null;
  };
  
  let imported = 0;
  let skipped = 0;
  
  for (const record of records) {
    // Filtrar headers duplicados y filas vacías
    const firstCol = Object.values(record)[0];
    if (!firstCol || firstCol.trim() === '' || firstCol === Object.keys(record)[0]) {
      skipped++;
      continue;
    }
    
    // Construir valores para inserción
    const values = {};
    for (const pgCol of pgColumns) {
      // Intentar encontrar la columna correspondiente en el CSV
      const matchingHeader = headers.find(h => h.toLowerCase() === pgCol.toLowerCase());
      if (matchingHeader) {
        values[pgCol] = record[matchingHeader] || null;
      } else if (columnMapping) {
        // Buscar en el mapeo
        const csvKey = Object.keys(columnMapping).find(k => columnMapping[k] === pgCol);
        if (csvKey) {
          values[pgCol] = record[csvKey] || null;
        } else {
          values[pgCol] = null;
        }
      } else {
        values[pgCol] = null;
      }
    }
    
    // Insertar registro
    const columns = Object.keys(values).map(c => `"${c}"`).join(', ');
    const placeholders = Object.keys(values).map((_, i) => `$${i + 1}`).join(', ');
    const valuesList = Object.values(values);
    
    const insertQuery = `INSERT INTO ${tableName.toLowerCase()} (${columns}) VALUES (${placeholders})`;
    
    try {
      await client.query(insertQuery, valuesList);
      imported++;
    } catch (err) {
      console.error(`Error insertando registro ${imported + 1}:`, err.message);
      throw err;
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  return {
    imported,
    skipped,
    totalRecords: records.length,
    executionTime
  };
}

async function importCSVToTableCopyRaw(client, csvPath, tableName) {
  const startTime = Date.now();

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Archivo no encontrado: ${csvPath}`);
  }

  const headerLine = readFirstLine(csvPath);
  const originalHeaders = headerLine.split(',').map(normalizeHeaderName);
  const headers = renameduplicateHeaders(originalHeaders);

  const pgColumns = await getTableColumns(client, tableName);
  const pgByLower = new Map(pgColumns.map((c) => [c.toLowerCase(), c]));
  const pgByKey = new Map();
  for (const c of pgColumns) {
    const k = canonicalColumnKey(c);
    if (!pgByKey.has(k)) pgByKey.set(k, c);
  }

  const resolvePgColumn = (header) => {
    if (!header) return undefined;
    const lower = header.toLowerCase();
    if (pgByLower.has(lower)) return pgByLower.get(lower);
    return pgByKey.get(canonicalColumnKey(header));
  };

  const unknownHeaders = headers.filter((h) => !resolvePgColumn(h));
  if (unknownHeaders.length > 0) {
    const sample = unknownHeaders.slice(0, 5).join(', ');
    throw new Error(
      `COPY_RAW no aplicable: CSV tiene ${unknownHeaders.length} columnas no presentes en PG (ej: ${sample})`
    );
  }

  const copyColumns = headers.map((h) => resolvePgColumn(h));
  const quotedCols = copyColumns.map((c) => `"${c}"`).join(', ');
  const copySql = `COPY ${tableName.toLowerCase()} (${quotedCols}) FROM STDIN WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"', NULL '')`;

  const copyStream = client.query(copyFrom(copySql));
  await pipeline(fs.createReadStream(csvPath), copyStream);

  const executionTime = Date.now() - startTime;
  return {
    imported: null,
    skipped: null,
    totalRecords: null,
    executionTime,
    mode: 'copy_raw'
  };
}

async function importCSVToTableCopyTransformed(client, csvPath, tableName) {
  const startTime = Date.now();

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Archivo no encontrado: ${csvPath}`);
  }

  const headerLine = readFirstLine(csvPath);
  const originalHeaders = headerLine.split(',').map(normalizeHeaderName);
  const headers = renameduplicateHeaders(originalHeaders);

  const pgColumns = await getTableColumns(client, tableName);
  const csvHeaderByLower = new Map(headers.map((h) => [h.toLowerCase(), h]));
  const csvHeaderByKey = new Map(headers.map((h) => [canonicalColumnKey(h), h]));

  const resolveCsvHeaderForPg = (pgCol) => {
    if (!pgCol) return undefined;
    const lower = pgCol.toLowerCase();
    if (csvHeaderByLower.has(lower)) return csvHeaderByLower.get(lower);
    return csvHeaderByKey.get(canonicalColumnKey(pgCol));
  };

  const copyColumns = pgColumns.filter((pgCol) => resolveCsvHeaderForPg(pgCol));
  if (copyColumns.length === 0) {
    throw new Error(`No hay columnas compatibles para COPY en ${tableName}`);
  }

  const quotedCols = copyColumns.map((c) => `"${c}"`).join(', ');
  const copySql = `COPY ${tableName.toLowerCase()} (${quotedCols}) FROM STDIN WITH (FORMAT csv, DELIMITER ',', QUOTE '"', ESCAPE '"', NULL '')`;

  let imported = 0;
  let skipped = 0;

  const parser = parseStream({
    columns: headers,
    from_line: 2,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true
  });

  const transformer = new Transform({
    writableObjectMode: true,
    transform(record, _enc, cb) {
      try {
        const firstKey = headers[0];
        const firstCol = firstKey ? record[firstKey] : undefined;
        if (!firstCol || String(firstCol).trim() === '' || String(firstCol) === firstKey) {
          skipped += 1;
          cb();
          return;
        }

        const line =
          copyColumns
            .map((pgCol) => {
              const csvKey = resolveCsvHeaderForPg(pgCol);
              return toCsvField(csvKey ? record[csvKey] : '');
            })
            .join(',') + '\n';

        imported += 1;
        cb(null, line);
      } catch (err) {
        cb(err);
      }
    }
  });

  const copyStream = client.query(copyFrom(copySql));
  await pipeline(fs.createReadStream(csvPath), parser, transformer, copyStream);

  const executionTime = Date.now() - startTime;
  return {
    imported,
    skipped,
    totalRecords: imported + skipped,
    executionTime,
    mode: 'copy_transformed'
  };
}

// ======================================================================
// FUNCIONES ADAPTADAS PARA EL BACKEND API
// ======================================================================

// Mapeo de archivos CSV → Tablas PostgreSQL (nombres reales de C:\STC\CSV)
const CSV_TO_TABLE_MAP = {
  'rptProducaoMaquina.csv': 'tb_PRODUCCION',
  'rptProducaoOE.csv': 'tb_PRODUCCION_OE',
  'rptPrdTestesFisicos.csv': 'tb_TESTES',
  'rptParadaMaquinaPRD.csv': 'tb_PARADAS',
  'fichaArtigo.csv': 'tb_FICHAS',
  'rptResiduosPorSetor.csv': 'tb_RESIDUOS_POR_SECTOR',
  'RelResIndigo.csv': 'tb_RESIDUOS_INDIGO',
  'rptAcompDiarioPBI.csv': 'tb_calidad',
  'rptMovimMP.csv': 'tb_calidad_fibra',
  'rpsPosicaoEstoquePRD.csv': 'tb_proceso',
  'rptDefPeca.csv': 'tb_defectos'  // Minúsculas como está en PostgreSQL
}

/**
 * Asegurar que la tabla de metadata existe
 */
async function ensureMetadataTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tb_import_metadata (
      table_name TEXT PRIMARY KEY,
      last_import_date TIMESTAMP,
      file_mtime TIMESTAMP,
      rows_imported INTEGER,
      csv_file TEXT,
      last_mode TEXT,
      last_error TEXT,
      last_duration_ms INTEGER,
      last_skipped INTEGER,
      last_mode_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Backfill columnas si la tabla ya existía (por compatibilidad)
  await pool.query(`ALTER TABLE tb_import_metadata ADD COLUMN IF NOT EXISTS last_mode TEXT`)
  await pool.query(`ALTER TABLE tb_import_metadata ADD COLUMN IF NOT EXISTS last_error TEXT`)
  await pool.query(`ALTER TABLE tb_import_metadata ADD COLUMN IF NOT EXISTS last_duration_ms INTEGER`)
  await pool.query(`ALTER TABLE tb_import_metadata ADD COLUMN IF NOT EXISTS last_skipped INTEGER`)
  await pool.query(`ALTER TABLE tb_import_metadata ADD COLUMN IF NOT EXISTS last_mode_reason TEXT`)
}

/**
 * Obtener estado de importación para todos los CSVs
 */
export async function getImportStatus(pool, csvFolderPath) {
  const status = []
  await ensureMetadataTable(pool)
  
  for (const [csvFile, tableName] of Object.entries(CSV_TO_TABLE_MAP)) {
    try {
      const csvPath = path.join(csvFolderPath, csvFile)
      
      if (!fs.existsSync(csvPath)) {
        status.push({
          table: tableName,
          csvFile,
          csv_file: csvFile,
          xlsx_sheet: 'CSV',
          csvPath,
          status: 'MISSING_FILE',
          last_import_date: null,
          file_mtime: null,
          csv_modified: null,
          rows_imported: 0
        })
        continue
      }
      
      const stats = fs.statSync(csvPath)
      const fileMtime = stats.mtime
      
      const metadataQuery = await pool.query(
        'SELECT last_import_date, rows_imported, file_mtime FROM tb_import_metadata WHERE table_name = $1',
        [tableName]
      )
      
      let importStatus = 'NOT_IMPORTED'
      let lastImportDate = null
      let rowsImported = 0
      
      if (metadataQuery.rows.length > 0) {
        const metadata = metadataQuery.rows[0]
        lastImportDate = metadata.last_import_date
        rowsImported = metadata.rows_imported || 0
        
        const lastImportMtime = new Date(metadata.file_mtime)
        if (fileMtime > lastImportMtime) {
          importStatus = 'OUTDATED'
        } else {
          importStatus = 'UP_TO_DATE'
        }
      }
      
      status.push({
        table: tableName,
        csvFile,
        csv_file: csvFile,
        xlsx_sheet: 'CSV',
        csvPath,
        status: importStatus,
        last_import_date: lastImportDate,
        file_mtime: fileMtime,
        csv_modified: fileMtime,
        rows_imported: rowsImported
      })
      
    } catch (error) {
      console.error(`Error checking ${csvFile}:`, error.message)
      status.push({
        table: tableName,
        csvFile,
        csv_file: csvFile,
        xlsx_sheet: 'CSV',
        csvPath: null,
        status: 'ERROR',
        error: error.message,
        last_import_date: null,
        file_mtime: null,
        csv_modified: null,
        rows_imported: 0
      })
    }
  }
  
  return status
}

/**
 * Importar un CSV específico
 */
export async function importCSV(pool, tableName, csvPath) {
  await ensureMetadataTable(pool)
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    const strategyInfo = await applyImportStrategy(client, tableName, csvPath)
    
    const stats = fs.statSync(csvPath)
    const fileMtime = stats.mtime
    
    let result
    let modeReason = null
    let copyError = null

    if (!isCopyEnabled()) {
      modeReason = 'COPY deshabilitado por IMPORT_COPY_ENABLED'
      result = await importCSVToTable(client, csvPath, tableName, null)
      result.mode = 'insert'
    } else {
      try {
        // Intentar el COPY más rápido posible (stream directo del archivo)
        result = await importCSVToTableCopyRaw(client, csvPath, tableName)

        // Para registrar rows_imported, consultamos COUNT(*) (sin parsear el CSV)
        const countRes = await client.query(`SELECT COUNT(*)::int AS c FROM ${tableName.toLowerCase()}`)
        result.imported = countRes.rows?.[0]?.c ?? null
        result.skipped = 0
      } catch (errRaw) {
        try {
          // Segundo intento: COPY transformado (filtra filas vacías/headers repetidos y permite subset de columnas)
          modeReason = errRaw?.message || 'COPY_RAW no aplicable'
          result = await importCSVToTableCopyTransformed(client, csvPath, tableName)
        } catch (errTransformed) {
          copyError = errTransformed
          console.warn(`[IMPORT] COPY falló para ${tableName}, usando fallback INSERT: ${errTransformed.message}`)
          await client.query('ROLLBACK')
          await client.query('BEGIN')
          result = await importCSVToTable(client, csvPath, tableName, null)
          result.mode = 'insert'
          modeReason = modeReason || errRaw?.message || null
        }
      }
    }

    const strategySuffix =
      strategyInfo.strategy === 'date_delete'
        ? `; strategy=date_delete(${strategyInfo.dateColumn}) fechas=${strategyInfo.deletedDates} rows_deleted=${strategyInfo.deletedRows ?? 'NA'}`
        : `; strategy=truncate`

    modeReason = (modeReason ? `${modeReason} | ` : '') + strategySuffix
    
    // Actualizar metadata
    await client.query(`
      INSERT INTO tb_import_metadata (table_name, last_import_date, file_mtime, rows_imported, csv_file, updated_at)
      VALUES ($1, NOW(), $2, $3, $4, NOW())
      ON CONFLICT (table_name) DO UPDATE 
      SET last_import_date = NOW(),
          file_mtime = $2,
          rows_imported = $3,
          csv_file = $4,
          updated_at = NOW()
    `, [tableName, fileMtime, result.imported, path.basename(csvPath)])

    // Registrar detalles del último import (auditoría de performance / por qué no fue raw)
    await client.query(`
      UPDATE tb_import_metadata
      SET last_mode = $2,
          last_error = $3,
          last_duration_ms = $4,
          last_skipped = $5,
          last_mode_reason = $6,
          updated_at = NOW()
      WHERE table_name = $1
    `, [
      tableName,
      result.mode || 'insert',
      copyError ? copyError.message : null,
      result.executionTime ?? null,
      result.skipped ?? null,
      modeReason
    ])
    
    await client.query('COMMIT')
    
    console.log(`[IMPORT] ✓ ${tableName}: ${result.imported} registros importados (${result.mode || 'insert'})`)
    
    return {
      success: true,
      table: tableName,
      rows: result.imported,
      mode: result.mode || 'insert',
      copyError: copyError ? copyError.message : null,
      modeReason,
      skipped: result.skipped ?? null,
      executionTimeMs: result.executionTime ?? null,
      file_mtime: fileMtime
    }
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`[IMPORT] ❌ Error en ${tableName}:`, error.message)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Importar tablas específicas
 */
export async function importSpecificTables(pool, tableNames, csvFolderPath) {
  const status = await getImportStatus(pool, csvFolderPath)
  const toImport = status.filter(s => tableNames.includes(s.table))
  
  const results = []
  
  for (const item of toImport) {
    try {
      const startTime = Date.now()
      const result = await importCSV(pool, item.table, item.csvPath)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      
      results.push({
        ...result,
        time: elapsed
      })
    } catch (error) {
      results.push({
        success: false,
        table: item.table,
        error: error.message
      })
    }
  }
  
  return results
}

/**
 * Importar todos los CSVs desactualizados
 */
export async function importAll(pool, csvFolderPath) {
  const status = await getImportStatus(pool, csvFolderPath)
  const toImport = status.filter(s => s.status === 'OUTDATED' || s.status === 'NOT_IMPORTED')
  
  const results = []
  
  for (const item of toImport) {
    try {
      const startTime = Date.now()
      const result = await importCSV(pool, item.table, item.csvPath)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      
      results.push({
        ...result,
        time: elapsed
      })
    } catch (error) {
      results.push({
        success: false,
        table: item.table,
        error: error.message
      })
    }
  }
  
  return results
}

/**
 * Forzar importación de TODAS las tablas mapeadas (ignora estado).
 * Se salta únicamente archivos faltantes o items con ERROR.
 */
export async function importForceAll(pool, csvFolderPath) {
  const status = await getImportStatus(pool, csvFolderPath)
  const toImport = status.filter(
    (s) => s.status !== 'MISSING_FILE' && s.status !== 'ERROR' && s.csvPath
  )

  const results = []

  for (const item of toImport) {
    try {
      const startTime = Date.now()
      const result = await importCSV(pool, item.table, item.csvPath)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

      results.push({
        ...result,
        time: elapsed
      })
    } catch (error) {
      results.push({
        success: false,
        table: item.table,
        error: error.message
      })
    }
  }

  return results
}
