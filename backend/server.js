/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'

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
  return await pool.getClient()
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
    const result = await query(`SELECT testnr FROM uster_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(row => row.testnr) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' })
  }
})

// USTER: Get PAR
app.get('/api/uster/par', async (req, res) => {
  try {
    const result = await query(`SELECT testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs FROM uster_par ORDER BY testnr`)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// USTER: Get TBL
app.get('/api/uster/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM uster_tbl WHERE testnr = $1 ORDER BY seqno` 
      : `SELECT * FROM uster_tbl ORDER BY testnr, seqno`
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
    const result = await query(`SELECT no_ FROM uster_tbl WHERE testnr = $1 ORDER BY seqno`, [testnr])
    res.json({ husos: result.rows.map(r => r.no_).filter(Boolean) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Husos' })
  }
})

// USTER: Upload
app.post('/api/uster/upload', async (req, res) => {
  const { par, tbl } = req.body
  if (!par?.TESTNR) return res.status(400).json({ error: 'Missing PAR data or TESTNR' })
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO uster_par (testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs)
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
    `, [par.TESTNR, par.NOMCOUNT, par.MASCHNR, par.LOTE, par.LABORANT, par.TIME_STAMP, par.MATCLASS, par.ESTIRAJE, par.PASADOR, par.OBS])
    
    // Delete existing TBL records
    await client.query('DELETE FROM uster_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO uster_tbl (
            testnr, seqno, no_, u_percent, cvm_percent, indice_percent,
            cvm_1m_percent, cvm_3m_percent, cvm_10m_percent, titulo, titulo_rel_perc,
            h, sh, sh_1m, sh_3m, sh_10m, delg_minus30_km, delg_minus40_km,
            delg_minus50_km, delg_minus60_km, grue_35_km, grue_50_km, grue_70_km,
            grue_100_km, neps_140_km, neps_200_km, neps_280_km, neps_400_km
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
          )`,
          [
            par.TESTNR, i+1, r.NO_, 
            parseFloat(r.U_PERCENT)||null, parseFloat(r.CVM_PERCENT)||null, parseFloat(r.INDICE_PERCENT)||null,
            parseFloat(r.CVM_1M_PERCENT)||null, parseFloat(r.CVM_3M_PERCENT)||null, parseFloat(r.CVM_10M_PERCENT)||null,
            parseFloat(r.TITULO)||null, parseFloat(r.TITULO_REL_PERC)||null,
            parseFloat(r.H)||null, parseFloat(r.SH)||null, parseFloat(r.SH_1M)||null, parseFloat(r.SH_3M)||null, parseFloat(r.SH_10M)||null,
            parseFloat(r.DELG_MINUS30_KM)||null, parseFloat(r.DELG_MINUS40_KM)||null,
            parseFloat(r.DELG_MINUS50_KM)||null, parseFloat(r.DELG_MINUS60_KM)||null,
            parseFloat(r.GRUE_35_KM)||null, parseFloat(r.GRUE_50_KM)||null, parseFloat(r.GRUE_70_KM)||null,
            parseFloat(r.GRUE_100_KM)||null,
            parseFloat(r.NEPS_140_KM)||null, parseFloat(r.NEPS_200_KM)||null, parseFloat(r.NEPS_280_KM)||null, parseFloat(r.NEPS_400_KM)||null
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
    const result = await query('DELETE FROM uster_par WHERE testnr = $1', [req.params.testnr])
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
    const result = await query(`SELECT testnr FROM tensorapid_par WHERE testnr IN (${placeholders})`, testnrs)
    res.json({ existing: result.rows.map(r => r.testnr) })
  } catch (err) { 
    res.status(500).json({ error: 'Failed' }) 
  }
})

// TENSORAPID: Get PAR
app.get('/api/tensorapid/par', async (req, res) => {
  try {
    const result = await query(`
      SELECT testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type 
      FROM tensorapid_par 
      ORDER BY testnr
    `)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// TENSORAPID: Get TBL
app.get('/api/tensorapid/tbl', async (req, res) => {
  const testnr = req.query.testnr
  try {
    const sql = testnr 
      ? `SELECT * FROM tensorapid_tbl WHERE testnr = $1 ORDER BY id` 
      : `SELECT * FROM tensorapid_tbl ORDER BY testnr, id`
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
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tensorapid_par (testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) 
      ON CONFLICT (testnr) DO UPDATE SET 
        ne_titulo=EXCLUDED.ne_titulo, 
        titulo=EXCLUDED.titulo, 
        comment_text=EXCLUDED.comment_text, 
        long_prueba=EXCLUDED.long_prueba, 
        time_stamp=EXCLUDED.time_stamp, 
        lote=EXCLUDED.lote, 
        ne_titulo_type=EXCLUDED.ne_titulo_type
    `, [par.TESTNR, par.NE_TITULO, par.TITULO, par.COMMENT_TEXT, par.LONG_PRUEBA, par.TIME_STAMP, par.LOTE, par.NE_TITULO_TYPE])
    
    // Delete existing TBL records
    await client.query('DELETE FROM tensorapid_tbl WHERE testnr = $1', [par.TESTNR])
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        await client.query(`
          INSERT INTO tensorapid_tbl (
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
    const result = await query('DELETE FROM tensorapid_par WHERE testnr = $1', [req.params.testnr])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// =====================================================
// INICIAR SERVIDOR
// =====================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ========================================')
  console.log(`🚀 STC Backend API v2 - PostgreSQL`)
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
  console.log(`🚀 Database: ${process.env.PG_DATABASE || 'stc_produccion'}`)
  console.log(`🚀 Health check: http://localhost:${PORT}/api/health`)
  console.log('🚀 ========================================')
})
