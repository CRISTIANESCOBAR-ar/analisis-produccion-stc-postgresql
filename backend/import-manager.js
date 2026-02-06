/* eslint-env node */
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

// =====================================================
// CSV IMPORTS - Sistema de importación automática
// =====================================================

// Mapeo de archivos CSV → Tablas PostgreSQL
const CSV_TO_TABLE_MAP = {
  'rptProducaoMaquina.csv': 'tb_PRODUCCION',
  'rptProducaoMaquinaOE.csv': 'tb_PRODUCCION_OE',
  'rptQualidade.csv': 'tb_QUALIDADE',
  'rptQualidadesFibra.csv': 'tb_QUALIDADE_FIBRA',
  'rptDefeitosPadrao.csv': 'tb_DEFEITOS',
  'rptParadas.csv': 'tb_PARADAS',
  'rptFichaTecnica.csv': 'tb_FICHAS',
  'rptProcesso.csv': 'tb_PROCESSO',
  'rptTestesFios.csv': 'tb_TESTES',
  'rptResiduosSector.csv': 'tb_RESIDUOS_POR_SECTOR',
  'rptResiduosIndigo.csv': 'tb_RESIDUOS_INDIGO'
}

// Obtener estado de importación para todos los CSVs
export async function getImportStatus(pool, csvFolderPath) {
  const status = []
  
  // Asegurar que la tabla de metadata existe
  await ensureMetadataTable(pool)
  
  for (const [csvFile, tableName] of Object.entries(CSV_TO_TABLE_MAP)) {
    try {
      const csvPath = path.join(csvFolderPath, csvFile)
      
      // Verificar si el archivo existe
      if (!fs.existsSync(csvPath)) {
        status.push({
          table: tableName,
          csvFile,
          csvPath,
          status: 'MISSING_FILE',
          last_import_date: null,
          file_mtime: null,
          rows_imported: 0
        })
        continue
      }
      
      // Obtener fecha de modificación del archivo
      const stats = fs.statSync(csvPath)
      const fileMtime = stats.mtime
      
      // Obtener metadata de importación
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
        
        // Comparar fechas: si el archivo es más nuevo que la última importación, está desactualizado
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
        csvPath,
        status: importStatus,
        last_import_date: lastImportDate,
        file_mtime: fileMtime,
        rows_imported: rowsImported
      })
      
    } catch (error) {
      console.error(`Error checking ${csvFile}:`, error.message)
      status.push({
        table: tableName,
        csvFile,
        csvPath: null,
        status: 'ERROR',
        error: error.message,
        last_import_date: null,
        file_mtime: null,
        rows_imported: 0
      })
    }
  }
  
  return status
}

// Crear tabla de metadata si no existe
async function ensureMetadataTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tb_import_metadata (
      table_name VARCHAR(100) PRIMARY KEY,
      last_import_date TIMESTAMP,
      file_mtime TIMESTAMP,
      rows_imported INTEGER,
      csv_file VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

// Importar un CSV específico
export async function importCSV(pool, tableName, csvPath) {
  const client = await pool.connect()
  
  try {
    console.log(`[IMPORT] Iniciando importación de ${tableName} desde ${csvPath}`)
    
    // Leer archivo CSV
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo no encontrado: ${csvPath}`)
    }
    
    const stats = fs.statSync(csvPath)
    const fileMtime = stats.mtime
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    
    // Renombrar headers duplicados (igual que en los scripts de migration/)
    const lines = csvContent.split('\n')
    const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    const seenColumns = {}
    const renamedHeaders = []
    
    for (const header of originalHeaders) {
      if (seenColumns[header]) {
        seenColumns[header]++
        renamedHeaders.push(`${header}_${seenColumns[header]}`)
      } else {
        seenColumns[header] = 1
        renamedHeaders.push(header)
      }
    }
    
    lines[0] = renamedHeaders.join(',')
    const csvContentWithRenamedHeaders = lines.join('\n')
    
    // Parsear CSV
    const records = parse(csvContentWithRenamedHeaders, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    })
    
    console.log(`[IMPORT] CSV leído: ${records.length} registros`)
    
    // Iniciar transacción
    await client.query('BEGIN')
    
    // Limpiar tabla
    console.log(`[IMPORT] Limpiando ${tableName}...`)
    await client.query(`TRUNCATE TABLE ${tableName} CASCADE`)
    
    // Insertar datos en batches
    let imported = 0
    const BATCH_SIZE = 200
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      
      if (batch.length === 0) continue
      
      // Obtener columnas del primer registro
      const columns = Object.keys(batch[0]).map(c => `"${c}"`).join(', ')
      const batchCols = Object.keys(batch[0]).length
      
      // Construir placeholders
      const valuePlaceholders = []
      const allValues = []
      
      batch.forEach((record, idx) => {
        const offset = idx * batchCols
        const placeholders = Array.from({ length: batchCols }, (_, colIdx) => `$${offset + colIdx + 1}`)
        valuePlaceholders.push(`(${placeholders.join(', ')})`)
        allValues.push(...Object.values(record))
      })
      
      // Insertar batch
      const query = `INSERT INTO ${tableName} (${columns}) VALUES ${valuePlaceholders.join(', ')}`
      await client.query(query, allValues)
      
      imported += batch.length
    }
    
    // Actualizar metadata
    await client.query(`
      INSERT INTO tb_import_metadata (table_name, last_import_date, file_mtime, rows_imported, csv_file)
      VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4)
      ON CONFLICT (table_name) 
      DO UPDATE SET 
        last_import_date = CURRENT_TIMESTAMP,
        file_mtime = $2,
        rows_imported = $3,
        csv_file = $4,
        updated_at = CURRENT_TIMESTAMP
    `, [tableName, fileMtime, imported, path.basename(csvPath)])
    
    await client.query('COMMIT')
    
    console.log(`[IMPORT] ✅ ${tableName}: ${imported} registros importados`)
    
    return {
      success: true,
      table: tableName,
      rows: imported,
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

// Importar todos los CSVs desactualizados
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
