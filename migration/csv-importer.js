import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Pool } = pkg;

// Mapeo de archivos CSV a tablas PostgreSQL
export const CSV_TABLE_MAPPING = {
  'fichaArtigo.csv': 'tb_FICHAS',
  'rptAcompDiarioPBI.csv': 'tb_PRODUCCION',
  'rptProducaoMaquina.csv': 'tb_CALIDAD',
  'rptPrdTestesFisicos.csv': 'tb_TESTES',
  'rptDefPeca.csv': 'tb_DEFECTOS',
  'rptProducaoOE.csv': 'tb_PRODUCCION_OE',
  'rptParadaMaquinaPRD.csv': 'tb_PARADAS',
  'RelResIndigo.csv': 'tb_RESIDUOS_INDIGO',
  'rptResiduosPorSetor.csv': 'tb_RESIDUOS_POR_SECTOR',
  'rpsPosicaoEstoquePRD.csv': 'tb_PROCESSO',
  'rptMovimMP.csv': 'tb_CALIDAD_FIBRA'
};

/**
 * Renombra headers duplicados en el CSV agregando sufijos _2, _3, etc.
 */
export function renameduplicateHeaders(headers) {
  const seenColumns = {};
  const renamedHeaders = [];
  
  for (const header of headers) {
    if (seenColumns[header]) {
      seenColumns[header]++;
      renamedHeaders.push(`${header}_${seenColumns[header]}`);
    } else {
      seenColumns[header] = 1;
      renamedHeaders.push(header);
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
  const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  // Renombrar headers duplicados
  const renamedHeaders = renameduplicateHeaders(originalHeaders);
  
  // Reemplazar primera línea con headers renombrados
  lines[0] = renamedHeaders.join(',');
  const csvContentWithRenamedHeaders = lines.join('\n');
  
  // Parsear CSV
  const records = parse(csvContentWithRenamedHeaders, {
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
  const extraInCSV = csvHeaders.filter(h => 
    h && !pgColumns.some(pg => pg.toLowerCase() === h.toLowerCase())
  );
  
  const missingInCSV = pgColumns.filter(pg => 
    !csvHeaders.some(h => h.toLowerCase() === pg.toLowerCase())
  );
  
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
  
  // Limpiar tabla
  await client.query(`TRUNCATE TABLE ${tableName.toLowerCase()}`);
  
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
