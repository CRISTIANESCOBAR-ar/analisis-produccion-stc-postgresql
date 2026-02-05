/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { parse } from 'csv-parse/sync'
import fs from 'fs/promises'
import path from 'path'

const { Pool } = pg
const app = express()

// =====================================================
// CONFIGURACIÓN DATABASE
// =====================================================
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Helper: query wrapper
async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log(`✓ Query executed in ${duration}ms`)
  return res
}

// Helper: obtener cliente para transacciones
async function getClient() {
  return await pool.connect()
}

// Helper: convertir claves a mayúsculas (compatibilidad Oracle/carga-datos-docker)
function uppercaseKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(uppercaseKeys)
  const result = {}
  for (const key of Object.keys(obj)) {
    result[key.toUpperCase()] = obj[key]
  }
  return result
}

// Helper: formatear números
function formatNumber(val) {
  if (val === null || val === undefined || val === '') return val
  const num = parseFloat(val)
  if (isNaN(num)) return val
  return String(parseFloat(num.toFixed(2)))
}

// =====================================================
// MIDDLEWARE
// =====================================================
const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || /^http:\/\/localhost(:\d+)?$/,
  credentials: true
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 3001

// =====================================================
// HEALTH CHECK
// =====================================================
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// =====================================================
// ENDPOINTS USTER
// =====================================================

// USTER: Check status
app.post('/api/uster/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || testnrs.length === 0) {
    return res.status(400).json({ error: 'testnrs must be a non-empty array' })
  }
  try {
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_uster_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(row => row.testnr) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' })
  }
})

// USTER: Get PAR
app.get('/api/uster/par', async (req, res) => {
  try {
    const result = await query(`SELECT testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs FROM tb_uster_par ORDER BY testnr`)
    // Formatear nomcount para eliminar decimales innecesarios
    const rows = result.rows.map(row => {
      const formatted = uppercaseKeys(row)
      if (formatted.NOMCOUNT != null) {
        const num = parseFloat(formatted.NOMCOUNT)
        if (!isNaN(num)) {
          formatted.NOMCOUNT = parseFloat(num.toFixed(2)) // Elimina .00 y .50 innecesarios
        }
      }
      return formatted
    })
    res.json({ rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get TBL
app.get('/api/uster/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tb_uster_tbl WHERE testnr = $1 ORDER BY seqno` 
      : `SELECT * FROM tb_uster_tbl ORDER BY testnr, seqno`
    const result = await query(sql, testnr ? [testnr] : [])
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get husos
app.post('/api/uster/husos', async (req, res) => {
  const { testnr } = req.body
  if (!testnr) return res.status(400).json({ error: 'testnr is required' })
  try {
    const result = await query(`SELECT no_ FROM tb_uster_tbl WHERE testnr = $1 ORDER BY seqno`, [testnr])
    res.json({ husos: result.rows.map(r => r.no_).filter(Boolean) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Husos' })
  }
})

// USTER: Upload
app.post('/api/uster/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing PAR data or TESTNR' })
  
  // Support both TIME (from frontend) and TIME_STAMP (legacy)
  const timeStamp = par.TIME_STAMP || par.TIME || null
  
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tb_uster_par (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (testnr) DO UPDATE SET 
        nomcount=EXCLUDED.nomcount, 
        maschnr=EXCLUDED.maschnr, 
        lote=EXCLUDED.lote, 
        laborant=EXCLUDED.laborant, 
        time_stamp=EXCLUDED.time_stamp, 
        matclass=EXCLUDED.matclass, 
        estiraje=EXCLUDED.estiraje, 
        pasador=EXCLUDED.pasador, 
        obs=EXCLUDED.obs
    `, [par.TESTNR, par.NOMCOUNT, par.MASCHNR, par.LOTE, par.LABORANT, timeStamp, par.MATCLASS, par.ESTIRAJE, par.PASADOR, par.OBS])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tb_uster_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO tb_uster_tbl (
            testnr, seqno, no_, u_percent, cvm_percent, indice_percent,
            cvm_1m_percent, cvm_3m_percent, cvm_10m_percent, titulo, titulo_rel_perc,
            h, sh, sh_1m, sh_3m, sh_10m, delg_minus30_km, delg_minus40_km,
            delg_minus50_km, delg_minus60_km, grue_35_km, grue_50_km, grue_70_km,
            grue_100_km, neps_140_km, neps_200_km, neps_280_km, neps_400_km
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
          )`,
          [
            par.TESTNR, i+1, r.NO, 
            parseFloat(r['U%_%'])||null, parseFloat(r['CVM_%'])||null, parseFloat(r['INDICE_%'])||null,
            parseFloat(r['CVM_1M_%'])||null, parseFloat(r['CVM_3M_%'])||null, parseFloat(r['CVM_10M_%'])||null,
            parseFloat(r.TITULO)||null, parseFloat(r['TITULO_REL_±_%'])||null,
            parseFloat(r.H)||null, parseFloat(r.SH)||null, parseFloat(r.SH_1M)||null, parseFloat(r.SH_3M)||null, parseFloat(r.SH_10M)||null,
            parseFloat(r['DELG_-30%_KM'])||null, parseFloat(r['DELG_-40%_KM'])||null,
            parseFloat(r['DELG_-50%_KM'])||null, parseFloat(r['DELG_-60%_KM'])||null,
            parseFloat(r['GRUE_35%_KM'])||null, parseFloat(r['GRUE_50%_KM'])||null, parseFloat(r['GRUE_70%_KM'])||null,
            parseFloat(r['GRUE_100%_KM'])||null,
            parseFloat(r['NEPS_140%_KM'])||null, parseFloat(r['NEPS_200%_KM'])||null, parseFloat(r['NEPS_280%_KM'])||null, parseFloat(r['NEPS_400%_KM'])||null
          ]
        )
      }
    }
    
    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR, tblRows: tbl?.length || 0 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error uploading Uster:', err)
    res.status(500).json({ error: err.message })
  } finally { 
    client.release() 
  }
})

// USTER: Delete
app.delete('/api/uster/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_uster_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// ENDPOINTS TENSORAPID
// =====================================================

// TENSORAPID: Status
app.post('/api/tensorapid/status', async (req, res) => {
  const { testnrs } = req.body
  if (!Array.isArray(testnrs) || !testnrs.length) {
    return res.status(400).json({ error: 'testnrs required' })
  }
  try {
    const placeholders = testnrs.map((_, i) => `$${i + 1}`).join(',')
    const result = await query(`SELECT testnr FROM tb_tensorapid_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(r => r.testnr) })
  } catch (err) { 
    res.status(500).json({ error: 'Failed' }) 
  }
})

// TENSORAPID: Get PAR
app.get('/api/tensorapid/par', async (req, res) => {
  try {
    const result = await query(`
      SELECT testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type,
             uster_testnr, nomcount, maschnr, laborant, matclass
      FROM tb_tensorapid_par 
      ORDER BY testnr
    `)
    // Formatear nomcount para eliminar decimales innecesarios
    const rows = result.rows.map(row => {
      const formatted = uppercaseKeys(row)
      if (formatted.NOMCOUNT != null) {
        const num = parseFloat(formatted.NOMCOUNT)
        if (!isNaN(num)) {
          formatted.NOMCOUNT = parseFloat(num.toFixed(2))
        }
      }
      return formatted
    })
    res.json({ rows })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// TENSORAPID: Get TBL
app.get('/api/tensorapid/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tb_tensorapid_tbl WHERE testnr = $1 ORDER BY id` 
      : `SELECT * FROM tb_tensorapid_tbl ORDER BY testnr, id`
    const result = await query(sql, testnr ? [testnr] : [])
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// TENSORAPID: Upload
app.post('/api/tensorapid/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing data' })
  
  // Support both TIME (from frontend) and TIME_STAMP (legacy)
  const timeStamp = par.TIME_STAMP || par.TIME || null
  // Support USTER_TESTNR for linking with Uster tests
  const usterTestnr = par.USTER_TESTNR || par.USTER_TESTLOT || null
  
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR (including uster_testnr)
    await client.query(`
      INSERT INTO tb_tensorapid_par (testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, nomcount, maschnr, laborant)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) 
      ON CONFLICT (testnr) DO UPDATE SET 
        ne_titulo=EXCLUDED.ne_titulo, 
        titulo=EXCLUDED.titulo, 
        comment_text=EXCLUDED.comment_text, 
        long_prueba=EXCLUDED.long_prueba, 
        time_stamp=EXCLUDED.time_stamp, 
        lote=EXCLUDED.lote, 
        ne_titulo_type=EXCLUDED.ne_titulo_type,
        uster_testnr=EXCLUDED.uster_testnr,
        nomcount=EXCLUDED.nomcount,
        maschnr=EXCLUDED.maschnr,
        laborant=EXCLUDED.laborant
    `, [par.TESTNR, par.NE_TITULO, par.TITULO, par.COMMENT_TEXT, par.LONG_PRUEBA, timeStamp, par.LOTE, par.NE_TITULO_TYPE, usterTestnr, par.NOMCOUNT, par.MASCHNR, par.LABORANT])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tb_tensorapid_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO tb_tensorapid_tbl (
            testnr, huso_number, tiempo_rotura, fuerza_b, elongacion, tenacidad, trabajo, huso_ensayos
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          par.TESTNR, 
          r.HUSO_NUMBER, 
          parseFloat(r.TIEMPO_ROTURA)||null, 
          parseFloat(r.FUERZA_B)||null, 
          parseFloat(r.ELONGACION)||null, 
          parseFloat(r.TENACIDAD)||null, 
          parseFloat(r.TRABAJO)||null, 
          r.HUSO_ENSAYOS
        ])
      }
    }
    
    await client.query('COMMIT')
    res.json({ success: true, testnr: par.TESTNR })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error uploading TensoRapid:', err)
    res.status(500).json({ error: err.message })
  } finally { 
    client.release() 
  }
})

// TENSORAPID: Delete
app.delete('/api/tensorapid/delete/:testnr', async (req, res) => {
  try {
    const result = await query('DELETE FROM tb_tensorapid_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// ENDPOINTS PRODUCCIÓN (ImportControl)
// =====================================================

// Definición de tablas y archivos CSV
const TABLE_DEFINITIONS = [
  { table: 'tb_FICHAS', filename: 'fichaArtigo.csv' },
  { table: 'tb_RESIDUOS_INDIGO', filename: 'RelResIndigo.csv' },
  { table: 'tb_RESIDUOS_POR_SECTOR', filename: 'rptResiduosPorSetor.csv' },
  { table: 'tb_TESTES', filename: 'rptPrdTestesFisicos.csv' },
  { table: 'tb_PARADAS', filename: 'rptParadaMaquinaPRD.csv' },
  { table: 'tb_PRODUCCION', filename: 'rptProducaoMaquina.csv' },
  { table: 'tb_CALIDAD', filename: 'rptAcompDiarioPBI.csv' },
  { table: 'tb_PROCESO', filename: 'rpsPosicaoEstoquePRD.csv' },
  { table: 'tb_DEFECTOS', filename: 'rptDefPeca.csv' },
  { table: 'tb_CALIDAD_FIBRA', filename: 'rptMovimMP.csv' },
  { table: 'tb_PRODUCCION_OE', filename: 'rptProducaoOE.csv' }
]

// Helper: Leer y parsear archivo CSV
async function readCSV(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    })
    return records
  } catch (err) {
    console.error(`Error reading CSV ${filePath}:`, err.message)
    throw err
  }
}

// Helper: Obtener columnas de una tabla PostgreSQL
async function getTableColumns(tableName) {
  const result = await query(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_name = $1 
     AND table_schema = 'public'
     ORDER BY ordinal_position`,
    [tableName.toLowerCase()]
  )
  return result.rows.map(r => r.column_name)
}

// Helper: Importar datos CSV a tabla PostgreSQL
async function importCSVToTable(tableName, csvPath) {
  const startTime = Date.now()
  console.log(`📥 Importando ${tableName} desde ${csvPath}...`)
  
  // Leer CSV
  const records = await readCSV(csvPath)
  if (records.length === 0) {
    console.log(`⚠️  ${tableName}: CSV vacío`)
    return { success: true, rows: 0, duration: Date.now() - startTime }
  }
  
  // Obtener columnas de la tabla
  const tableColumns = await getTableColumns(tableName)
  
  // Filtrar columnas: solo las que existen en la tabla (excluir id, created_at, updated_at)
  const dataColumns = tableColumns.filter(col => !['id', 'created_at', 'updated_at'].includes(col))
  
  // Obtener columnas del CSV (normalizar a lowercase)
  const csvColumns = Object.keys(records[0]).map(col => col.toLowerCase())
  
  console.log(`📋 ${tableName}: CSV columnas:`, Object.keys(records[0]).slice(0, 10), '...')
  console.log(`📋 ${tableName}: Tabla columnas:`, dataColumns.slice(0, 10), '...')
  
  // Mapear columnas CSV → Tabla (comparar en lowercase)
  const mappedColumns = dataColumns.filter(col => csvColumns.includes(col.toLowerCase()))
  
  if (mappedColumns.length === 0) {
    throw new Error(`No se encontraron columnas coincidentes entre CSV y tabla ${tableName}`)
  }
  
  console.log(`📋 ${tableName}: ${records.length} registros, ${mappedColumns.length} columnas mapeadas`)
  
  // Escapar nombres de columnas con comillas dobles para manejar espacios y caracteres especiales
  const escapedColumns = mappedColumns.map(col => `"${col}"`)
  
  // Dividir en lotes para evitar límite de parámetros de PostgreSQL (~65K)
  const BATCH_SIZE = 100
  const batches = []
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE))
  }
  
  console.log(`📦 Dividiendo en ${batches.length} lotes de máximo ${BATCH_SIZE} registros`)
  
  // Ejecutar transacción
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Truncar tabla antes de insertar (importación limpia)
    await client.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`)
    
    let totalInserted = 0
    
    // Insertar cada lote
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const placeholderRows = []
      const values = []
      let paramIndex = 1
      
      for (const record of batch) {
        const rowPlaceholders = []
        for (const col of mappedColumns) {
          rowPlaceholders.push(`$${paramIndex}`)
          // Obtener valor del CSV (case-insensitive)
          const csvKey = Object.keys(record).find(k => k.toLowerCase() === col.toLowerCase())
          let value = record[csvKey]
          
          // Convertir valores vacíos a NULL
          if (value === '' || value === undefined || value === null) {
            value = null
          }
          
          values.push(value)
          paramIndex++
        }
        placeholderRows.push(`(${rowPlaceholders.join(', ')})`)
      }
      
      // Construir query INSERT para este lote
      const insertQuery = `
        INSERT INTO ${tableName} (${escapedColumns.join(', ')})
        VALUES ${placeholderRows.join(', ')}
        ON CONFLICT DO NOTHING
      `
      
      // Insertar lote
      const result = await client.query(insertQuery, values)
      totalInserted += result.rowCount
      
      if ((batchIndex + 1) % 10 === 0) {
        console.log(`  ⏳ Lote ${batchIndex + 1}/${batches.length} completado (${totalInserted} registros)`)
      }
    }
    
    await client.query('COMMIT')
    
    const duration = Date.now() - startTime
    console.log(`✓ ${tableName}: ${totalInserted} registros importados en ${duration}ms`)
    
    // Guardar metadatos de importación
    await query(`
      INSERT INTO import_metadata (table_name, last_import_date, rows_imported, import_duration_ms, updated_at)
      VALUES ($1, NOW(), $2, $3, NOW())
      ON CONFLICT (table_name) DO UPDATE SET
        last_import_date = NOW(),
        rows_imported = $2,
        import_duration_ms = $3,
        updated_at = NOW()
    `, [tableName, totalInserted, duration])
    
    return { success: true, rows: totalInserted, duration, timeMs: duration }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`❌ Error importando ${tableName}:`, err.message)
    throw err
  } finally {
    client.release()
  }
}

// GET: Estado de importación
app.get('/api/produccion/import-status', async (req, res) => {
  try {
    const csvFolder = req.query.csvFolder || 'C:\\STC'
    
    // Obtener metadatos de todas las tablas de una vez
    const metadataResult = await query(`
      SELECT table_name, last_import_date, rows_imported 
      FROM import_metadata
    `)
    const metadataMap = new Map()
    metadataResult.rows.forEach(row => {
      metadataMap.set(row.table_name, {
        lastImportDate: row.last_import_date,
        rows: row.rows_imported
      })
    })
    
    const statusList = []
    
    for (const def of TABLE_DEFINITIONS) {
      const filePath = path.join(csvFolder, def.filename)
      let fileModified = null
      let fileExists = false
      
      try {
        const stats = await fs.stat(filePath)
        fileModified = stats.mtime
        fileExists = true
      } catch (err) {
        // Archivo no encontrado
      }
      
      // Obtener metadatos de esta tabla
      const metadata = metadataMap.get(def.table)
      const lastImportDate = metadata?.lastImportDate || null
      const rowCount = metadata?.rows || 0
      
      // Determinar estado comparando fechas
      let status = 'NOT_IMPORTED'
      
      if (!fileExists) {
        status = 'MISSING_FILE'
      } else if (!lastImportDate) {
        // Nunca se ha importado
        status = 'NOT_IMPORTED'
      } else {
        // Comparar fecha del archivo con fecha de última importación
        const fileDate = new Date(fileModified)
        const importDate = new Date(lastImportDate)
        
        if (fileDate > importDate) {
          status = 'OUTDATED'
        } else {
          status = 'UP_TO_DATE'
        }
      }
      
      statusList.push({
        table: def.table,
        file: filePath,
        filename: def.filename,
        status,
        file_modified: fileModified ? fileModified.toISOString() : null,
        last_import_date: lastImportDate ? new Date(lastImportDate).toISOString() : null,
        rows_imported: rowCount
      })
    }
    
    res.json(statusList)
  } catch (err) {
    console.error('Error getting import status:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST: Forzar importación de una tabla
app.post('/api/produccion/import/force-table', async (req, res) => {
  try {
    const { table, csvFolder } = req.body
    
    if (!table) {
      return res.status(400).json({ error: 'Missing table parameter' })
    }
    
    const tableDef = TABLE_DEFINITIONS.find(t => t.table === table)
    if (!tableDef) {
      return res.status(404).json({ error: 'Table not found in definitions' })
    }
    
    const folder = csvFolder || 'C:\\STC'
    const csvPath = path.join(folder, tableDef.filename)
    
    // Ejecutar importación
    const result = await importCSVToTable(table, csvPath)
    
    res.json({ 
      success: result.success, 
      message: `${table} importada correctamente`,
      rows: result.rows,
      duration: result.duration
    })
  } catch (err) {
    console.error('Error forcing table import:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST: Forzar importación de TODAS las tablas
app.post('/api/produccion/import/force-all', async (req, res) => {
  try {
    const { csvFolder } = req.body
    const folder = csvFolder || 'C:\\STC'
    const startTime = Date.now()
    const results = []
    
    for (const tableDef of TABLE_DEFINITIONS) {
      const csvPath = path.join(folder, tableDef.filename)
      
      try {
        const result = await importCSVToTable(tableDef.table, csvPath)
        results.push({ table: tableDef.table, ...result })
      } catch (err) {
        console.error(`❌ Error importando ${tableDef.table}:`, err.message)
        results.push({ table: tableDef.table, success: false, error: err.message })
      }
    }
    
    const totalDuration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    
    res.json({ 
      success: successCount === TABLE_DEFINITIONS.length,
      message: `${successCount}/${TABLE_DEFINITIONS.length} tablas importadas correctamente`,
      timings: { totalMs: totalDuration },
      results
    })
  } catch (err) {
    console.error('Error forcing all tables import:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Estado de la base de datos
app.get('/api/produccion/status', async (req, res) => {
  try {
    // Obtener tamaño de la base de datos
    const sizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) / (1024 * 1024) as size_mb
    `)
    
    const sizeMB = sizeResult.rows[0]?.size_mb || 0
    
    res.json({
      sizeMB: Math.round(sizeMB),
      size: sizeResult.rows[0]?.size || 'N/A',
      database: 'stc_produccion'
    })
  } catch (err) {
    console.error('Error getting DB status:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Historial de importaciones
app.get('/api/produccion/import-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    
    const result = await query(`
      SELECT id, table_name, last_import_date, rows_imported, import_duration_ms
      FROM import_metadata
      ORDER BY last_import_date DESC
      LIMIT $1
    `, [limit])
    
    res.json({ history: result.rows })
  } catch (err) {
    console.error('Error getting import history:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST: Actualizar tablas desactualizadas
app.post('/api/produccion/import/update-outdated', async (req, res) => {
  try {
    const { tables, csvFolder } = req.body
    
    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: 'Missing tables parameter' })
    }
    
    const folder = csvFolder || 'C:\\STC'
    const startTime = Date.now()
    const results = []
    
    for (const tableName of tables) {
      const tableDef = TABLE_DEFINITIONS.find(t => t.table === tableName)
      if (!tableDef) {
        console.warn(`⚠️  Tabla ${tableName} no encontrada en definiciones`)
        continue
      }
      
      const csvPath = path.join(folder, tableDef.filename)
      
      try {
        const result = await importCSVToTable(tableName, csvPath)
        results.push({ table: tableName, ...result })
      } catch (err) {
        console.error(`❌ Error importando ${tableName}:`, err.message)
        results.push({ table: tableName, success: false, error: err.message })
      }
    }
    
    const totalDuration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    
    res.json({ 
      success: successCount === tables.length,
      message: `${successCount}/${tables.length} tablas importadas correctamente`,
      timings: { totalMs: totalDuration },
      results
    })
  } catch (err) {
    console.error('Error updating outdated tables:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// HISTORIAL DE COLUMNAS Y SINCRONIZACIONES
// =====================================================

// GET: Obtener warnings de columnas (diferencias CSV vs DB)
app.get('/api/produccion/import/column-warnings', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, table_name, extra_columns, missing_columns, detected_at, csv_path
      FROM column_warnings
      WHERE resolved = false
      ORDER BY detected_at DESC
      LIMIT 50
    `)
    
    // Transformar al formato esperado por el frontend
    const warnings = result.rows.map(row => ({
      id: row.id,
      table: row.table_name,
      extraColumns: row.extra_columns || [],
      missingColumns: row.missing_columns || [],
      timestamp: row.detected_at,
      csvPath: row.csv_path,
      hasDifferences: (row.extra_columns?.length > 0) || (row.missing_columns?.length > 0)
    }))
    
    res.json({ warnings })
  } catch (err) {
    // Si la tabla no existe aún, devolver array vacío
    if (err.code === '42P01') {
      return res.json({ warnings: [] })
    }
    console.error('Error getting column warnings:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Historial de warnings de columnas
app.get('/api/produccion/import/warnings-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    
    const result = await query(`
      SELECT id, table_name, extra_columns, missing_columns, detected_at
      FROM column_warnings
      ORDER BY detected_at DESC
      LIMIT $1
    `, [limit])
    
    res.json({ history: result.rows })
  } catch (err) {
    if (err.code === '42P01') {
      return res.json({ history: [] })
    }
    console.error('Error getting warnings history:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST: Sincronizar columnas (agregar columnas nuevas del CSV a PostgreSQL)
app.post('/api/produccion/schema/sync-columns', async (req, res) => {
  try {
    const { table, csvPath, reimport } = req.body
    
    if (!table) {
      return res.status(400).json({ error: 'Missing table parameter' })
    }
    
    // Obtener columnas del CSV
    const csvColumns = await getCSVColumns(csvPath)
    
    // Obtener columnas actuales de la tabla
    const dbColumnsResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table.toLowerCase()])
    
    const dbColumns = dbColumnsResult.rows.map(r => r.column_name.toLowerCase())
    
    // Encontrar columnas que faltan en la DB
    const columnsToAdd = csvColumns.filter(col => !dbColumns.includes(col.toLowerCase()))
    
    const addedColumns = []
    const errors = []
    
    // Agregar cada columna nueva
    for (const col of columnsToAdd) {
      try {
        const sanitizedCol = col.replace(/[^a-zA-Z0-9_]/g, '_')
        await query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${sanitizedCol}" TEXT`)
        addedColumns.push(sanitizedCol)
      } catch (err) {
        errors.push({ column: col, error: err.message })
      }
    }
    
    // Registrar el cambio en el historial
    if (addedColumns.length > 0) {
      await query(`
        INSERT INTO schema_changes (table_name, change_type, columns_added, reimported, applied_at)
        VALUES ($1, 'ADD_COLUMNS', $2, $3, NOW())
      `, [table, addedColumns, reimport || false])
      
      // Marcar warning como resuelto
      await query(`
        UPDATE column_warnings SET resolved = true WHERE table_name = $1 AND resolved = false
      `, [table])
    }
    
    // Re-importar si se solicitó
    let reimportResult = null
    if (reimport && addedColumns.length > 0) {
      try {
        const tableDef = TABLE_DEFINITIONS.find(t => t.table === table)
        if (tableDef) {
          const folder = path.dirname(csvPath)
          const result = await importCSVToTable(table, csvPath)
          reimportResult = { success: result.success, rows: result.rows }
        }
      } catch (err) {
        reimportResult = { success: false, error: err.message }
      }
    }
    
    res.json({
      success: errors.length === 0,
      columnsAdded: addedColumns.length,
      addedColumns,
      errors,
      reimportResult
    })
  } catch (err) {
    console.error('Error syncing columns:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Historial de cambios de esquema (sincronizaciones aplicadas)
app.get('/api/produccion/schema/changes-log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    
    const result = await query(`
      SELECT id, table_name, change_type, columns_added, reimported, applied_at
      FROM schema_changes
      ORDER BY applied_at DESC
      LIMIT $1
    `, [limit])
    
    res.json({ changes: result.rows })
  } catch (err) {
    if (err.code === '42P01') {
      return res.json({ changes: [] })
    }
    console.error('Error getting schema changes log:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS CALIDAD - CONTROL DE CALIDAD
// =====================================================

// Helper: Convertir fecha ISO (YYYY-MM-DD) a DD/MM/YYYY
function isoToLocal(isoDate) {
  if (!isoDate) return null
  if (isoDate.includes('/')) return isoDate // Ya está en formato local
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

// GET: Revisión CQ - Resumen por revisor
app.get('/api/produccion/calidad/revision-cq', async (req, res) => {
  try {
    const { startDate, endDate, tramas } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate y endDate son requeridos' })
    }
    
    // Convertir fechas a formato DD/MM/YYYY para comparar con la tabla
    const startDateLocal = isoToLocal(startDate)
    const endDateLocal = isoToLocal(endDate)
    
    let tramaFilter = ''
    const params = [startDateLocal, endDateLocal]
    
    // Filtro por trama basado en primer carácter de ARTIGO:
    // A = ALG 100%, Y = P + E, P = POL 100%
    if (tramas && tramas !== 'Todas') {
      const tramaMap = { 'ALG 100%': 'A', 'P + E': 'Y', 'POL 100%': 'P' }
      const artigoPrefix = tramaMap[tramas]
      if (artigoPrefix) {
        tramaFilter = ' AND LEFT("ARTIGO", 1) = $3'
        params.push(artigoPrefix)
      }
    }
    
    const sql = `
      SELECT 
        "REVISOR FINAL" as "Revisor",
        COUNT(DISTINCT "ETIQUETA") as "Rollos_1era",
        SUM(CAST(REPLACE(COALESCE(NULLIF("METRAGEM", ''), '0'), ',', '.') AS NUMERIC)) as "Mts_Total",
        COUNT(DISTINCT CASE WHEN CAST(REPLACE(COALESCE(NULLIF("PONTUACAO", ''), '0'), ',', '.') AS NUMERIC) = 0 THEN "ETIQUETA" END) as "Rollos_Sin_Pts",
        CASE 
          WHEN COUNT(DISTINCT "ETIQUETA") > 0 
          THEN ROUND(COUNT(DISTINCT CASE WHEN CAST(REPLACE(COALESCE(NULLIF("PONTUACAO", ''), '0'), ',', '.') AS NUMERIC) = 0 THEN "ETIQUETA" END)::NUMERIC / 
               COUNT(DISTINCT "ETIQUETA") * 100, 2)
          ELSE 0 
        END as "Perc_Sin_Pts",
        CASE 
          WHEN SUM(CAST(REPLACE(COALESCE(NULLIF("METRAGEM", ''), '0'), ',', '.') AS NUMERIC)) > 0
          THEN ROUND(SUM(CAST(REPLACE(COALESCE(NULLIF("PONTUACAO", ''), '0'), ',', '.') AS NUMERIC)) / 
               (SUM(CAST(REPLACE(COALESCE(NULLIF("METRAGEM", ''), '0'), ',', '.') AS NUMERIC)) / 100), 2)
          ELSE 0 
        END as "Pts_100m2",
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN "ETIQUETA" END) > 0
          THEN ROUND(COUNT(DISTINCT CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN "ETIQUETA" END)::NUMERIC / 
               COUNT(DISTINCT "ETIQUETA") * 100, 2)
          ELSE 0 
        END as "Calidad_Perc"
      FROM tb_calidad
      WHERE "DAT_PROD" >= $1 
        AND "DAT_PROD" <= $2
        AND "REVISOR FINAL" IS NOT NULL 
        AND "REVISOR FINAL" != ''
        ${tramaFilter}
      GROUP BY "REVISOR FINAL"
      ORDER BY "Mts_Total" DESC
    `
    
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Error en revision-cq:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Detalle por revisor
app.get('/api/produccion/calidad/revisor-detalle', async (req, res) => {
  try {
    const { startDate, endDate, revisor, tramas } = req.query
    
    if (!startDate || !revisor) {
      return res.status(400).json({ error: 'startDate y revisor son requeridos' })
    }
    
    // Convertir fechas a formato DD/MM/YYYY
    const startDateLocal = isoToLocal(startDate)
    const endDateLocal = isoToLocal(endDate || startDate)
    
    let tramaFilter = ''
    const params = [startDateLocal, endDateLocal, revisor]
    
    // Filtro por trama basado en primer carácter de ARTIGO
    if (tramas && tramas !== 'Todas') {
      const tramaMap = { 'ALG 100%': 'A', 'P + E': 'Y', 'POL 100%': 'P' }
      const artigoPrefix = tramaMap[tramas]
      if (artigoPrefix) {
        tramaFilter = ' AND LEFT("ARTIGO", 1) = $4'
        params.push(artigoPrefix)
      }
    }
    
    const sql = `
      SELECT 
        "PARTIDA" as "Partidas",
        MIN("HORA") as "HoraInicio",
        "NM MERC" as "NombreArticulo",
        "ARTIGO",
        "COR",
        "TEAR" as "Telar",
        COUNT(DISTINCT "ETIQUETA") as "TotalRollos",
        SUM(CAST(REPLACE(COALESCE(NULLIF("METRAGEM", ''), '0'), ',', '.') AS NUMERIC)) as "MetrosRevisados",
        COUNT(DISTINCT CASE WHEN CAST(REPLACE(COALESCE(NULLIF("PONTUACAO", ''), '0'), ',', '.') AS NUMERIC) = 0 THEN "ETIQUETA" END) as "SinPuntos",
        CASE 
          WHEN COUNT(DISTINCT "ETIQUETA") > 0 
          THEN ROUND(COUNT(DISTINCT CASE WHEN CAST(REPLACE(COALESCE(NULLIF("PONTUACAO", ''), '0'), ',', '.') AS NUMERIC) = 0 THEN "ETIQUETA" END)::NUMERIC / 
               COUNT(DISTINCT "ETIQUETA") * 100, 2)
          ELSE 0 
        END as "SinPuntosPct",
        CASE 
          WHEN SUM(CAST(REPLACE(COALESCE(NULLIF("METRAGEM", ''), '0'), ',', '.') AS NUMERIC)) > 0
          THEN ROUND(SUM(CAST(REPLACE(COALESCE(NULLIF("PONTUACAO", ''), '0'), ',', '.') AS NUMERIC)) / 
               (SUM(CAST(REPLACE(COALESCE(NULLIF("METRAGEM", ''), '0'), ',', '.') AS NUMERIC)) / 100), 2)
          ELSE 0 
        END as "Pts100m2",
        CASE 
          WHEN COUNT(DISTINCT "ETIQUETA") > 0
          THEN ROUND(COUNT(DISTINCT CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN "ETIQUETA" END)::NUMERIC / 
               COUNT(DISTINCT "ETIQUETA") * 100, 2)
          ELSE 0 
        END as "CalidadPct",
        0 as "EficienciaPct",
        0 as "RU105",
        0 as "RT105"
      FROM tb_calidad
      WHERE "DAT_PROD" >= $1 
        AND "DAT_PROD" <= $2
        AND "REVISOR FINAL" = $3
        ${tramaFilter}
      GROUP BY "PARTIDA", "NM MERC", "ARTIGO", "COR", "TEAR"
      ORDER BY MIN("HORA")
    `
    
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Error en revisor-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Detalle de partida
app.get('/api/produccion/calidad/partida-detalle', async (req, res) => {
  try {
    const { fecha, partida, revisor } = req.query
    
    if (!partida) {
      return res.status(400).json({ error: 'partida es requerido' })
    }
    
    const params = [partida]
    let dateFilter = ''
    let revisorFilter = ''
    
    if (fecha) {
      dateFilter = ' AND "DAT_PROD" = $2'
      params.push(isoToLocal(fecha))
    }
    
    if (revisor) {
      revisorFilter = ` AND "REVISOR FINAL" = $${params.length + 1}`
      params.push(revisor)
    }
    
    const sql = `
      SELECT 
        "GRP_DEF",
        "COD_DE",
        "DEFEITO",
        "METRAGEM",
        "QUALIDADE",
        "HORA",
        "EMENDAS",
        "PEÇA" as "PEÇA",
        "ETIQUETA",
        "LARGURA",
        "PONTUACAO",
        "ARTIGO",
        "COR",
        "NM MERC",
        "TRAMA",
        "PARTIDA"
      FROM tb_calidad
      WHERE "PARTIDA" = $1
        ${dateFilter}
        ${revisorFilter}
      ORDER BY "HORA", "PEÇA"
    `
    
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Error en partida-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Defectos detallados de una pieza (por etiqueta)
app.get('/api/produccion/calidad/defectos-detalle', async (req, res) => {
  try {
    const { etiqueta } = req.query
    
    if (!etiqueta) {
      return res.status(400).json({ error: 'etiqueta es requerido' })
    }
    
    // Query tb_DEFECTOS (from rptDefPeca.csv) - tabla específica de defectos
    const sql = `
      SELECT 
        "PARTIDA",
        "PECA",
        "ETIQUETA",
        "COD_DEF",
        "DESC_DEFEITO",
        "PONTOS",
        "QUALIDADE",
        "DATA_PROD"
      FROM tb_DEFECTOS
      WHERE TRIM("ETIQUETA") = TRIM($1)
      ORDER BY "COD_DEF"
    `
    
    const result = await query(sql, [etiqueta])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en defectos-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Fechas disponibles con datos de calidad
app.get('/api/produccion/calidad/available-dates', async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT DAT_PROD 
      FROM tb_CALIDAD 
      WHERE DAT_PROD IS NOT NULL
      ORDER BY DAT_PROD DESC
      LIMIT 365
    `
    const result = await query(sql)
    res.json(result.rows.map(r => r.dat_prod))
  } catch (err) {
    console.error('Error en available-dates:', err)
    res.status(500).json({ error: err.message })
  }
})

// Función auxiliar para obtener columnas de un CSV
async function getCSVColumns(csvPath) {
  return new Promise((resolve, reject) => {
    const columns = []
    fs.createReadStream(csvPath)
      .pipe(csv({ separator: ';', headers: false }))
      .on('data', (row) => {
        // La primera fila contiene los headers
        const headers = Object.values(row)
        columns.push(...headers)
      })
      .once('data', () => {
        // Solo necesitamos la primera fila
      })
      .on('error', reject)
      .on('end', () => resolve(columns))
    
    // Timeout por si el archivo es muy grande
    setTimeout(() => {
      if (columns.length === 0) {
        reject(new Error('Timeout leyendo headers del CSV'))
      }
    }, 5000)
  })
}

// =====================================================
// INICIAR SERVIDOR
// =====================================================

// Crear tabla de metadatos de importación si no existe
async function initImportMetadata() {
  try {
    // Tabla de metadatos de importación
    await query(`
      CREATE TABLE IF NOT EXISTS import_metadata (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) UNIQUE NOT NULL,
        last_import_date TIMESTAMP WITH TIME ZONE,
        rows_imported INTEGER DEFAULT 0,
        import_duration_ms INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('✓ Tabla import_metadata verificada')
    
    // Tabla de warnings de columnas (diferencias CSV vs DB)
    await query(`
      CREATE TABLE IF NOT EXISTS column_warnings (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        extra_columns TEXT[] DEFAULT '{}',
        missing_columns TEXT[] DEFAULT '{}',
        csv_path TEXT,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved BOOLEAN DEFAULT false
      )
    `)
    console.log('✓ Tabla column_warnings verificada')
    
    // Tabla de historial de cambios de esquema
    await query(`
      CREATE TABLE IF NOT EXISTS schema_changes (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        columns_added TEXT[] DEFAULT '{}',
        reimported BOOLEAN DEFAULT false,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('✓ Tabla schema_changes verificada')
  } catch (err) {
    console.error('Error creando tablas de metadatos:', err.message)
  }
}

async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect()
    console.log('✓ Conexión a PostgreSQL exitosa')
    client.release()
    
    // Inicializar tabla de metadatos
    await initImportMetadata()
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 ========================================')
      console.log(`🚀 STC Backend API v2 - PostgreSQL`)
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
      console.log(`🚀 Database: ${process.env.PG_DATABASE || 'stc_produccion'}`)
      console.log(`🚀 Health check: http://localhost:${PORT}/api/health`)
      console.log('🚀 ========================================')
    })
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err.message)
    process.exit(1)
  }
}

startServer()
