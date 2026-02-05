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

// Helper: convertir fecha ISO (YYYY-MM-DD) a formato local (DD/MM/YYYY)
function isoToLocal(isoDate) {
  if (!isoDate) return null
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
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
    `, [par.TESTNR, par.NOMCOUNT, par.MASCHNR, par.LOTE, par.LABORANT, par.TIME_STAMP, par.MATCLASS, par.ESTIRAJE, par.PASADOR, par.OBS])
    
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
      SELECT testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type 
      FROM tb_tensorapid_par 
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
  const client = await getClient()
  try {
    await client.query('BEGIN')
    
    // Insert or update PAR
    await client.query(`
      INSERT INTO tb_tensorapid_par (testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type)
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
// ENDPOINTS CONTROL DE CALIDAD - MESA DE TEST
// =====================================================

// GET: Lista de artículos para Mesa de Test
app.get('/api/produccion/calidad/articulos-mesa-test', async (req, res) => {
  try {
    const { fecha_inicial, fecha_final } = req.query

    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const fechaInicioFull = `${isoToLocal(fecha_inicial)} 00:00:00`
    const fechaFinFull = fecha_final ? `${isoToLocal(fecha_final)} 23:59:59` : '31/12/2099 23:59:59'
    
    const fechaInicioShort = isoToLocal(fecha_inicial)
    const fechaFinShort = fecha_final ? isoToLocal(fecha_final) : '31/12/2099'

    const sql = `
      -- Métricas de CALIDAD
      WITH MetricasCalidad AS (
        SELECT 
          "ARTIGO",
          ROUND(SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)), 0) AS METROS_REV
        FROM tb_CALIDAD
        WHERE "DAT_PROD" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND TO_DATE("DAT_PROD", 'DD/MM/YYYY') >= TO_DATE($1, 'DD/MM/YYYY') 
          AND TO_DATE("DAT_PROD", 'DD/MM/YYYY') <= TO_DATE($2, 'DD/MM/YYYY')
          AND "TRAMA" IS NOT NULL
        GROUP BY "ARTIGO"
      ),
      
      -- Métricas de TESTES (AVG por PARTIDA primero)
      MetricasTestes AS (
        SELECT 
          "ARTIGO",
          ROUND(SUM(METRAGEM_AVG), 0) AS METROS_TEST
        FROM (
          SELECT 
            "ARTIGO",
            "PARTIDA",
            AVG(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)) AS METRAGEM_AVG
          FROM tb_TESTES
          WHERE "DT_PROD" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
            AND TO_DATE("DT_PROD", 'DD/MM/YYYY') >= TO_DATE($3, 'DD/MM/YYYY') 
            AND TO_DATE("DT_PROD", 'DD/MM/YYYY') <= TO_DATE($4, 'DD/MM/YYYY')
            AND "ARTIGO" IS NOT NULL
            AND "ARTIGO" != 'ARTIGO'
            AND "PARTIDA" IS NOT NULL
            AND "PARTIDA" !~ '^[A-Z]'
          GROUP BY "ARTIGO", "PARTIDA"
        ) sub
        GROUP BY "ARTIGO"
      ),

      AllArtigos AS (
        SELECT "ARTIGO" FROM MetricasCalidad
        UNION 
        SELECT "ARTIGO" FROM MetricasTestes
      )
      
      SELECT 
        AU."ARTIGO" AS "ARTIGO_COMPLETO",
        SUBSTRING(AU."ARTIGO", 1, 10) AS "Articulo",
        SUBSTRING(AU."ARTIGO", 7, 2) AS "Id",
        F."COR" AS "Color",
        F."NOME DE MERCADO" AS "Nombre",
        F."TRAMA" AS "Trama",
        F."PRODUCAO" AS "Prod",
        COALESCE(MT.METROS_TEST, 0) AS "Metros_TEST",
        COALESCE(MC.METROS_REV, 0) AS "Metros_REV"
      FROM AllArtigos AU
      LEFT JOIN MetricasTestes MT ON AU."ARTIGO" = MT."ARTIGO"
      LEFT JOIN MetricasCalidad MC ON AU."ARTIGO" = MC."ARTIGO"
      LEFT JOIN tb_FICHAS F ON AU."ARTIGO" = F."ARTIGO CODIGO"
      WHERE F."ARTIGO CODIGO" IS NOT NULL
      ORDER BY AU."ARTIGO"
    `

    const result = await query(sql, [
      fechaInicioShort, fechaFinShort,
      fechaInicioShort, fechaFinShort
    ])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en articulos-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Análisis detallado de Mesa de Test para un artículo
app.get('/api/produccion/calidad/analisis-mesa-test', async (req, res) => {
  try {
    const { articulo, fecha_inicial, fecha_final } = req.query

    if (!articulo) {
      return res.status(400).json({ error: 'Parámetro "articulo" requerido' })
    }
    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const fechaInicioShort = isoToLocal(fecha_inicial)
    const fechaFinShort = fecha_final ? isoToLocal(fecha_final) : '31/12/9999'

    const sql = `
      WITH TESTES AS (
        SELECT 
          "MAQUINA",
          "ARTIGO" AS ART_TEST,
          CAST("PARTIDA" AS INTEGER) AS PARTIDA,
          "ARTIGO" AS TESTES,
          "DT_PROD",
          "APROV",
          "OBS",
          "REPROCESSO",
          CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC) AS METRAGEM,
          "LARG_AL",
          "GRAMAT",
          "POTEN",
          "%_ENC_URD",
          "%_ENC_TRAMA",
          "%_SK1",
          "%_SK2",
          "%_SK3",
          "%_SK4",
          "%_SKE",
          "%_STT",
          "%_SKM"
        FROM tb_TESTES
        WHERE "ARTIGO" = $1
          AND "DT_PROD" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND TO_DATE("DT_PROD", 'DD/MM/YYYY') >= TO_DATE($2, 'DD/MM/YYYY')
          AND TO_DATE("DT_PROD", 'DD/MM/YYYY') <= TO_DATE($3, 'DD/MM/YYYY')
          AND "PARTIDA" IS NOT NULL
          AND "PARTIDA" !~ '^[A-Z]'
      ),
      
      CALIDAD AS (
        SELECT 
          MIN("DAT_PROD") AS DAT_PROD,
          "ARTIGO" AS ART_CAL,
          CAST("PARTIDA" AS INTEGER) AS PARTIDA,
          ROUND(SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)), 0) AS METRAGEM,
          ROUND(AVG("LARGURA"), 1) AS LARGURA,
          ROUND(AVG("GR/M2"), 1) AS "GR/M2"
        FROM tb_CALIDAD
        WHERE "ARTIGO" = $4
          AND "DAT_PROD" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND "DAT_PROD" >= $5
          AND "DAT_PROD" <= $6
        GROUP BY "ARTIGO", "PARTIDA"
      ),
      
      TESTES_CALIDAD AS (
        SELECT 
          T.*,
          C.DAT_PROD,
          C.METRAGEM AS CALIDAD_METRAGEM,
          C.LARGURA AS CALIDAD_LARGURA,
          C."GR/M2" AS CALIDAD_GRM2
        FROM TESTES T
        LEFT JOIN CALIDAD C ON T.PARTIDA = C.PARTIDA
      ),
      
      ESPECIFICACION AS (
        SELECT 
          "ARTIGO CODIGO",
          "URDUME",
          "TRAMA",
          "BATIDA",
          "Oz/jd2",
          "Peso/m2",
          CAST(REPLACE("LARGURA MIN", ',', '.') AS NUMERIC) AS LARGURA_MIN_VAL,
          CAST(REPLACE("LARGURA", ',', '.') AS NUMERIC) AS ANCHO,
          CAST(REPLACE("LARGURA MAX", ',', '.') AS NUMERIC) AS LARGURA_MAX_VAL,
          "SKEW MIN",
          ("SKEW MIN" + "SKEW MAX") / 2.0 AS "SKEW STD",
          "SKEW MAX",
          "URD#MIN",
          ("URD#MIN" + "URD#MAX") / 2.0 AS "URD#STD",
          "URD#MAX",
          "TRAMA MIN",
          ("TRAMA MIN" + "TRAMA MAX") / 2.0 AS "TRAMA STD",
          "TRAMA MAX",
          "VAR STR#MIN TRAMA",
          ("VAR STR#MIN TRAMA" + "VAR STR#MAX TRAMA") / 2.0 AS "VAR STR#STD TRAMA",
          "VAR STR#MAX TRAMA",
          "VAR STR#MIN URD",
          ("VAR STR#MIN URD" + "VAR STR#MAX URD") / 2.0 AS "VAR STR#STD URD",
          "VAR STR#MAX URD",
          "ENC#ACAB URD"
        FROM tb_FICHAS
        WHERE "ARTIGO CODIGO" = $7
      )
      
      SELECT 
        CAST(TC.MAQUINA AS INTEGER) AS "Maquina",
        TC.ART_TEST AS "Articulo",
        E."TRAMA" AS "Trama",
        TC.PARTIDA AS "Partida",
        TC.TESTES AS "C",
        TC.DT_PROD AS "Fecha",
        TC.APROV AS "Ap",
        TC.OBS AS "Obs",
        TC.REPROCESSO AS "R",
        ROUND(TC.METRAGEM, 0) AS "Metros_TEST",
        ROUND(TC.CALIDAD_METRAGEM, 0) AS "Metros_MESA",
        
        ROUND(TC.CALIDAD_LARGURA, 1) AS "Ancho_MESA",
        
        ROUND(CASE 
          WHEN E.LARGURA_MIN_VAL < (E.ANCHO * 0.5) THEN E.ANCHO - E.LARGURA_MIN_VAL
          ELSE E.LARGURA_MIN_VAL
        END, 1) AS "Ancho_MIN",
        
        ROUND(E.ANCHO, 1) AS "Ancho_STD",
        
        ROUND(CASE 
          WHEN E.LARGURA_MAX_VAL < (E.ANCHO * 0.5) THEN E.ANCHO + E.LARGURA_MAX_VAL
          ELSE E.LARGURA_MAX_VAL
        END, 1) AS "Ancho_MAX",
        
        ROUND(TC.LARG_AL, 1) AS "Ancho_TEST",
        
        ROUND(TC.CALIDAD_GRM2, 1) AS "Peso_MESA",
        E."Peso/m2" * 0.95 AS "Peso_MIN",
        ROUND(E."Peso/m2", 1) AS "Peso_STD",
        E."Peso/m2" * 1.05 AS "Peso_MAX",
        ROUND(TC.GRAMAT, 1) AS "Peso_TEST",
        
        TC.POTEN AS "Potencial",
        E."ENC#ACAB URD" AS "Potencial_STD",
        
        TC."%_ENC_URD" AS "ENC_URD_%",
        E."URD#MIN" AS "ENC_URD_MIN_%",
        E."URD#STD" AS "ENC_URD_STD_%",
        E."URD#MAX" AS "ENC_URD_MAX_%",
        -1.5 AS "%_ENC_URD_MIN_Meta",
        -1.0 AS "%_ENC_URD_MAX_Meta",
        
        TC."%_ENC_TRAMA" AS "ENC_TRA_%",
        E."TRAMA MIN" AS "ENC_TRA_MIN_%",
        E."TRAMA STD" AS "ENC_TRA_STD_%",
        E."TRAMA MAX" AS "ENC_TRA_MAX_%",
        
        TC."%_SK1" AS "%_SK1",
        TC."%_SK2" AS "%_SK2",
        TC."%_SK3" AS "%_SK3",
        TC."%_SK4" AS "%_SK4",
        TC."%_SKE" AS "%_SKE",
        
        E."SKEW MIN" AS "Skew_MIN",
        E."SKEW STD" AS "Skew_STD",
        E."SKEW MAX" AS "Skew_MAX",
        
        CAST(TC."%_STT" AS NUMERIC) AS "%_STT",
        E."VAR STR#MIN TRAMA" AS "%_STT_MIN",
        E."VAR STR#STD TRAMA" AS "%_STT_STD",
        E."VAR STR#MAX TRAMA" AS "%_STT_MAX",
        
        TC."%_SKM" AS "Pasadas_Terminadas",
        E."VAR STR#MIN URD" AS "Pasadas_MIN",
        E."VAR STR#STD URD" AS "Pasadas_STD",
        E."VAR STR#MAX URD" AS "Pasadas_MAX",
        
        ROUND(TC.CALIDAD_GRM2 * 0.0295, 1) AS "Peso_MESA_OzYd²",
        ROUND(E."Peso/m2" * 0.95 * 0.0295, 1) AS "Peso_MIN_OzYd²",
        ROUND(E."Peso/m2" * 0.0295, 1) AS "Peso_STD_OzYd²",
        ROUND(E."Peso/m2" * 1.05 * 0.0295, 1) AS "Peso_MAX_OzYd²"
        
      FROM TESTES_CALIDAD TC
      LEFT JOIN ESPECIFICACION E ON TC.ART_TEST = E."ARTIGO CODIGO"
      ORDER BY TC.DT_PROD
    `

    const result = await query(sql, [articulo, fechaInicioShort, fechaFinShort, articulo, fechaInicioShort, fechaFinShort, articulo])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en analisis-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS DE CONTROL DE IMPORTACIONES
// =====================================================

import fs from 'fs'
import path from 'path'

// Mapeo de archivos CSV a tablas PostgreSQL
const CSV_TABLE_MAPPING = {
  'fichaArtigo.csv': 'tb_FICHAS',
  'rptProducaoMaquina.csv': 'tb_PRODUCCION',
  'rptAcompDiarioPBI.csv': 'tb_CALIDAD',
  'rptPrdTestesFisicos.csv': 'tb_TESTES',
  'rptDefPeca.csv': 'tb_DEFECTOS',
  'rptProducaoOE.csv': 'tb_PRODUCCION_OE',
  'rptParadaMaquinaPRD.csv': 'tb_PARADAS',
  'RelResIndigo.csv': 'tb_RESIDUOS_INDIGO',
  'rptResiduosPorSetor.csv': 'tb_RESIDUOS_POR_SECTOR',
  'rpsPosicaoEstoquePRD.csv': 'tb_PROCESO',
  'rptMovimMP.csv': 'tb_CALIDAD_FIBRA'
}

// Mapeo de tablas a información de hoja Excel (basado en analisis-produccion-stc)
const TABLE_SHEET_MAPPING = {
  'tb_FICHAS': 'lista de tecidos',
  'tb_PRODUCCION': 'rptProdMaq',
  'tb_CALIDAD': 'report5',
  'tb_TESTES': 'report2',
  'tb_DEFECTOS': 'rptDefPeca',
  'tb_PRODUCCION_OE': 'rptProducaoOE',
  'tb_PARADAS': 'rptpm',
  'tb_RESIDUOS_INDIGO': 'rptResiduosIndigo',
  'tb_RESIDUOS_POR_SECTOR': 'rptResiduosPorSetor',
  'tb_PROCESO': 'rptStock',
  'tb_CALIDAD_FIBRA': 'rptMovimMP'
}

// GET /api/produccion/import-status - Estado de archivos CSV vs tablas
app.get('/api/produccion/import-status', async (req, res) => {
  try {
    const csvFolder = req.query.csvFolder || 'C:\\STC\\CSV'
    
    // Verificar que la carpeta existe
    if (!fs.existsSync(csvFolder)) {
      return res.status(400).json({ 
        error: 'Carpeta CSV no encontrada',
        path: csvFolder 
      })
    }

    const statusList = []

    for (const [csvFile, tableName] of Object.entries(CSV_TABLE_MAPPING)) {
      const csvPath = path.join(csvFolder, csvFile)
      const status = {
        table: tableName,
        csv_file: csvFile,
        xlsx_sheet: TABLE_SHEET_MAPPING[tableName] || '-',
        csv_path: csvPath,
        csv_exists: false,
        csv_modified: null,
        csv_size_bytes: 0,
        rows_imported: 0,
        last_import_date: null,
        status: 'NOT_IMPORTED'
      }

      // Verificar si el archivo CSV existe
      if (fs.existsSync(csvPath)) {
        const stats = fs.statSync(csvPath)
        status.csv_exists = true
        status.csv_modified = stats.mtime.toISOString()
        status.csv_size_bytes = stats.size
      } else {
        status.status = 'MISSING_FILE'
        statusList.push(status)
        continue
      }

      // Obtener estadísticas de la tabla en PostgreSQL
      try {
        const tableQuery = `
          SELECT 
            n_live_tup as row_count,
            last_vacuum,
            last_autovacuum,
            last_analyze
          FROM pg_stat_user_tables
          WHERE schemaname = 'public' 
            AND relname = $1
        `
        const tableResult = await query(tableQuery, [tableName.toLowerCase()])
        
        if (tableResult.rows.length > 0) {
          status.rows_imported = tableResult.rows[0].row_count || 0
          
          // Usar la fecha más reciente disponible
          const lastVacuum = tableResult.rows[0].last_vacuum
          const lastAutovacuum = tableResult.rows[0].last_autovacuum
          const lastAnalyze = tableResult.rows[0].last_analyze
          
          const dates = [lastVacuum, lastAutovacuum, lastAnalyze].filter(d => d)
          if (dates.length > 0) {
            const mostRecent = dates.reduce((a, b) => a > b ? a : b)
            status.last_import_date = mostRecent.toISOString()
          }
          
          // Determinar si está actualizado comparando fechas
          if (status.last_import_date && status.csv_modified) {
            const csvDate = new Date(status.csv_modified)
            const importDate = new Date(status.last_import_date)
            
            if (csvDate > importDate) {
              status.status = 'OUTDATED'
            } else {
              status.status = 'UP_TO_DATE'
            }
          } else {
            status.status = 'OUTDATED'
          }
        }
      } catch (err) {
        console.error(`Error consultando tabla ${tableName}:`, err.message)
        status.status = 'NOT_IMPORTED'
      }

      statusList.push(status)
    }

    res.json(statusList)
  } catch (err) {
    console.error('Error en import-status:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/status - Info general de la base de datos
app.get('/api/produccion/status', async (req, res) => {
  try {
    // Obtener tamaño de la base de datos
    const sizeQuery = `
      SELECT 
        pg_database.datname as database_name,
        pg_size_pretty(pg_database_size(pg_database.datname)) as size_pretty,
        pg_database_size(pg_database.datname) as size_bytes
      FROM pg_database
      WHERE datname = current_database()
    `
    const sizeResult = await query(sizeQuery, [])
    
    // Obtener número total de tablas
    const tablesQuery = `
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name LIKE 'tb_%'
    `
    const tablesResult = await query(tablesQuery, [])
    
    // Obtener información de conexiones
    const connectionsQuery = `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `
    const connectionsResult = await query(connectionsQuery, [])

    const dbInfo = {
      database: sizeResult.rows[0]?.database_name || 'stc_produccion',
      sizePretty: sizeResult.rows[0]?.size_pretty || '0 bytes',
      sizeBytes: parseInt(sizeResult.rows[0]?.size_bytes || 0),
      sizeMB: parseFloat((parseInt(sizeResult.rows[0]?.size_bytes || 0) / (1024 * 1024)).toFixed(2)),
      tableCount: parseInt(tablesResult.rows[0]?.table_count || 0),
      totalConnections: parseInt(connectionsResult.rows[0]?.total_connections || 0),
      activeConnections: parseInt(connectionsResult.rows[0]?.active_connections || 0),
      serverTime: new Date().toISOString()
    }

    res.json(dbInfo)
  } catch (err) {
    console.error('Error en status:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/import/column-warnings - Detectar columnas nuevas en CSV
app.get('/api/produccion/import/column-warnings', async (req, res) => {
  try {
    const warnings = []
    const csvFolder = 'C:\\STC\\CSV'
    
    // Mapeo conocido para tb_FICHAS (caracteres especiales y duplicados)
    const FICHAS_COLUMN_MAPPING = {
      'PRODUÇÃO': 'PRODUCAO',
      'COD. RETALHO': 'COD# RETALHO',
      'DESCRIÇÃO': 'DESCRICAO',
      'CONS.TR/m': 'CONS#TR/m',
      'QT.FIOS': 'QT#FIOS',
      'CONS.URD/m': 'CONS#URD/m',
      'LARG.PENTE': 'LARG#PENTE',
      'LARG.CRU': 'LARG#CRU',
      'URD.MIN': 'URD#MIN',
      'URD.MAX': 'URD#MAX',
      'VAR STR.MIN TRAMA': 'VAR STR#MIN TRAMA',
      'VAR STR.MAX TRAMA': 'VAR STR#MAX TRAMA',
      'VAR STR.MIN URD': 'VAR STR#MIN URD',
      'VAR STR.MAX URD': 'VAR STR#MAX URD',
      'ENC.TEC.URDUME': 'ENC#TEC#URDUME',
      'ENC. TEC.TRAMA': 'ENC# TEC#TRAMA',
      'ENC.ACAB URD': 'ENC#ACAB URD',
      'ENC.ACAB TRAMA': 'ENC#ACAB TRAMA',
      'LAV.AMAC.URD': 'LAV#AMAC#URD',
      'LAV.AMAC.TRM': 'LAV#AMAC#TRM',
      'COMPOSIÇÃO': 'COMPOSICAO',
      // Duplicados renombrados
      'SAP_2': 'SAP1',
      'TRAMA REDUZIDO_2': 'TRAMA REDUZIDO1',
      'SGS_2': 'SGS1',
      'SGS_3': 'SGS2',
      'SGS_4': 'SGS3',
      'DESCRIÇÃO_2': 'DESCRICAO1',
      'BATIDAS/FIO_2': 'BATIDAS/FIO1',
      'NE RESULTANTE_2': 'NE RESULTANTE1',
      'NE RESULTANTE_3': 'NE RESULTANTE2',
      'QT.FIOS_2': 'QT#FIOS1',
      'NE RESULTANTE_4': 'NE RESULTANTE3',
      'LAV STONE_2': 'LAV STONE 1'
    }

    // Mapeo conocido para tb_PRODUCCION (columnas duplicadas y doble espacio)
    const PRODUCCION_COLUMN_MAPPING = {
      // Doble espacio en CSV
      'MAQ  FIACAO': 'MAQ FIACAO',
      // Columnas duplicadas: TOTAL MINUTOS TUR aparece 3 veces en CSV
      'TOTAL MINUTOS TUR_2': 'TOTAL MINUTOS TUR 1',
      'TOTAL MINUTOS TUR_3': 'TOTAL MINUTOS TUR 2'
    }

    // Mapeo conocido para tb_CALIDAD (transformaciones y duplicados)
    const CALIDAD_COLUMN_MAPPING = {
      // Transformación de caracteres especiales
      'G.PR': 'G#PR',
      // Espacios al final añadidos en SQLite (compatibilidad)
      'TURNO LAVAD': 'TURNO LAVAD ',
      'TURNO PESAGEM': 'TURNO PESAGEM ',
      // Columnas duplicadas: TURNO LAVAD aparece 2 veces
      'TURNO LAVAD_2': 'TURNO LAVAD 1'
    }

    // Mapeo conocido para tb_PARADAS (columnas duplicadas)
    // NOTA: PostgreSQL convirtió MOTIVO1 y COR1 a lowercase porque no tienen comillas en schema
    const PARADAS_COLUMN_MAPPING = {
      // Columnas duplicadas: MOTIVO aparece 2 veces en CSV
      'MOTIVO_2': 'motivo1',  // lowercase porque PG las convirtió
      // Columnas duplicadas: COR aparece 2 veces en CSV
      'COR_2': 'cor1'  // lowercase porque PG las convirtió
    }

    // Mapeo conocido para tb_RESIDUOS_INDIGO (normalización de caracteres)
    const RESIDUOS_INDIGO_COLUMN_MAPPING = {
      // CSV usa punto, PostgreSQL usa almohadilla
      'DEVOL TEC.': 'DEVOL TEC#'
    }

    // Mapeo conocido para tb_CALIDAD_FIBRA (normalización y duplicados)
    const CALIDAD_FIBRA_COLUMN_MAPPING = {
      // Normalización de espacios a guiones bajos
      'TP MIC': 'TP_MIC',
      'LOTE INTERNO': 'LOTE_INTERNO',
      'TIPO MP': 'TIPO_MP',
      'TP SELO': 'TP_SELO',
      'NUM SELO': 'NUM_SELO',
      'FARDOS TESTADOS': 'FARDOS_TESTADOS',
      'DOC VENDA': 'DOC_VENDA',
      'DT EMIS DOC VENDA': 'DT_EMIS_DOC_VENDA',
      'USU LIBEROU': 'USU_LIBEROU',
      // Normalización de caracteres especiales
      '+b': 'PLUS_B',
      'OBSERVACAO (DO TESTE)': 'OBSERVACAO',
      // Columna duplicada: FORNECEDOR aparece 2 veces
      'FORNECEDOR_2': 'FORNECEDOR_2'  // El duplicado se renombra
    }

    for (const [csvFile, tableName] of Object.entries(CSV_TABLE_MAPPING)) {
      const csvPath = path.join(csvFolder, csvFile)
      
      if (!fs.existsSync(csvPath)) continue

      try {
        // Leer primera línea del CSV para obtener columnas
        const fileContent = fs.readFileSync(csvPath, 'utf-8')
        const firstLine = fileContent.split('\n')[0]
        let csvColumns = firstLine.split(',').map(col => col.trim().replace(/"/g, ''))
        
        // Renombrar duplicados en el CSV (simular lo que hace import-fichas.js)
        const seenColumns = {}
        csvColumns = csvColumns.map(header => {
          if (seenColumns[header]) {
            seenColumns[header]++
            return `${header}_${seenColumns[header]}`
          } else {
            seenColumns[header] = 1
            return header
          }
        })

        // Obtener columnas de PostgreSQL
        const pgColumnsQuery = `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' 
            AND table_name = $1
          ORDER BY ordinal_position
        `
        const pgResult = await query(pgColumnsQuery, [tableName.toLowerCase()])
        const pgColumns = pgResult.rows.map(r => r.column_name)

        // Aplicar mapeo si es tb_FICHAS
        let extraColumns, missingColumns
        
        if (tableName === 'tb_FICHAS') {
          // Comparar con mapeo aplicado
          extraColumns = csvColumns.filter(csvCol => {
            if (!csvCol) return false
            
            // Si está en el mapeo, verificar que exista la columna mapeada
            const mappedCol = FICHAS_COLUMN_MAPPING[csvCol]
            if (mappedCol) {
              return !pgColumns.some(pgCol => pgCol.toLowerCase() === mappedCol.toLowerCase())
            }
            
            // Si no está en el mapeo, buscar coincidencia exacta
            return !pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase())
          })
          
          // Solo reportar columnas en PG que no tienen equivalente en CSV
          missingColumns = pgColumns.filter(pgCol => {
            // Buscar en mapeo inverso
            const csvEquivalent = Object.entries(FICHAS_COLUMN_MAPPING).find(
              ([csv, pg]) => pg.toLowerCase() === pgCol.toLowerCase()
            )
            if (csvEquivalent) {
              return !csvColumns.some(c => c.toLowerCase() === csvEquivalent[0].toLowerCase())
            }
            return !csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase())
          })
        } else if (tableName === 'tb_PRODUCCION') {
          // Comparar con mapeo aplicado (similar a tb_FICHAS)
          extraColumns = csvColumns.filter(csvCol => {
            if (!csvCol) return false
            
            // Si está en el mapeo, verificar que exista la columna mapeada
            const mappedCol = PRODUCCION_COLUMN_MAPPING[csvCol]
            if (mappedCol) {
              return !pgColumns.some(pgCol => pgCol.toLowerCase() === mappedCol.toLowerCase())
            }
            
            // Si no está en el mapeo, buscar coincidencia exacta
            return !pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase())
          })
          
          // Solo reportar columnas en PG que no tienen equivalente en CSV
          missingColumns = pgColumns.filter(pgCol => {
            // Buscar en mapeo inverso
            const csvEquivalent = Object.entries(PRODUCCION_COLUMN_MAPPING).find(
              ([csv, pg]) => pg.toLowerCase() === pgCol.toLowerCase()
            )
            if (csvEquivalent) {
              return !csvColumns.some(c => c.toLowerCase() === csvEquivalent[0].toLowerCase())
            }
            return !csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase())
          })
        } else if (tableName === 'tb_CALIDAD') {
          // Comparar con mapeo aplicado (similar a tb_FICHAS)
          extraColumns = csvColumns.filter(csvCol => {
            if (!csvCol) return false
            
            // Si está en el mapeo, verificar que exista la columna mapeada
            const mappedCol = CALIDAD_COLUMN_MAPPING[csvCol]
            if (mappedCol) {
              return !pgColumns.some(pgCol => pgCol.toLowerCase() === mappedCol.toLowerCase())
            }
            
            // Si no está en el mapeo, buscar coincidencia exacta
            return !pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase())
          })
          
          // Solo reportar columnas en PG que no tienen equivalente en CSV
          missingColumns = pgColumns.filter(pgCol => {
            // Buscar en mapeo inverso
            const csvEquivalent = Object.entries(CALIDAD_COLUMN_MAPPING).find(
              ([csv, pg]) => pg.toLowerCase() === pgCol.toLowerCase()
            )
            if (csvEquivalent) {
              return !csvColumns.some(c => c.toLowerCase() === csvEquivalent[0].toLowerCase())
            }
            return !csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase())
          })
        } else if (tableName === 'tb_PARADAS') {
          // Comparar con mapeo aplicado (similar a tb_FICHAS)
          extraColumns = csvColumns.filter(csvCol => {
            if (!csvCol) return false
            
            // Si está en el mapeo, verificar que exista la columna mapeada
            const mappedCol = PARADAS_COLUMN_MAPPING[csvCol]
            if (mappedCol) {
              // El mapeo ya tiene el case correcto (lowercase)
              return !pgColumns.some(pgCol => pgCol === mappedCol)
            }
            
            // Si no está en el mapeo, buscar coincidencia case-insensitive
            return !pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase())
          })
          
          // Solo reportar columnas en PG que no tienen equivalente en CSV
          missingColumns = pgColumns.filter(pgCol => {
            // Buscar en mapeo inverso
            const csvEquivalent = Object.entries(PARADAS_COLUMN_MAPPING).find(
              ([csv, pg]) => pg === pgCol  // Comparación exacta, el mapeo tiene el case correcto
            )
            if (csvEquivalent) {
              return !csvColumns.some(c => c === csvEquivalent[0])
            }
            return !csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase())
          })
        } else if (tableName === 'tb_RESIDUOS_INDIGO') {
          // Comparar con mapeo para normalización de caracteres
          extraColumns = csvColumns.filter(csvCol => {
            if (!csvCol) return false
            
            // Si está en el mapeo, verificar que exista la columna mapeada
            const mappedCol = RESIDUOS_INDIGO_COLUMN_MAPPING[csvCol]
            if (mappedCol) {
              return !pgColumns.some(pgCol => pgCol === mappedCol)
            }
            
            // Si no está en el mapeo, buscar coincidencia case-insensitive
            return !pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase())
          })
          
          // Solo reportar columnas en PG que no tienen equivalente en CSV
          missingColumns = pgColumns.filter(pgCol => {
            // Buscar en mapeo inverso
            const csvEquivalent = Object.entries(RESIDUOS_INDIGO_COLUMN_MAPPING).find(
              ([csv, pg]) => pg === pgCol
            )
            if (csvEquivalent) {
              return !csvColumns.some(c => c === csvEquivalent[0])
            }
            return !csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase())
          })
        } else if (tableName === 'tb_CALIDAD_FIBRA') {
          // Comparar con mapeo para normalización y duplicados
          extraColumns = csvColumns.filter(csvCol => {
            if (!csvCol) return false
            
            // Si está en el mapeo, verificar que exista la columna mapeada
            const mappedCol = CALIDAD_FIBRA_COLUMN_MAPPING[csvCol]
            if (mappedCol) {
              return !pgColumns.some(pgCol => pgCol === mappedCol)
            }
            
            // Si no está en el mapeo, buscar coincidencia case-insensitive
            return !pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase())
          })
          
          // Solo reportar columnas en PG que no tienen equivalente en CSV
          missingColumns = pgColumns.filter(pgCol => {
            // Buscar en mapeo inverso
            const csvEquivalent = Object.entries(CALIDAD_FIBRA_COLUMN_MAPPING).find(
              ([csv, pg]) => pg === pgCol
            )
            if (csvEquivalent) {
              return !csvColumns.some(c => c === csvEquivalent[0])
            }
            return !csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase())
          })
        } else {
          // Para otras tablas, comparación simple
          extraColumns = csvColumns.filter(col => 
            col && !pgColumns.some(pgCol => pgCol.toLowerCase() === col.toLowerCase())
          )
          
          missingColumns = pgColumns.filter(col => 
            !csvColumns.some(csvCol => csvCol.toLowerCase() === col.toLowerCase())
          )
        }

        const hasDifferences = extraColumns.length > 0 || missingColumns.length > 0

        if (hasDifferences) {
          warnings.push({
            id: `${tableName}_${Date.now()}`,
            table: tableName,
            csvPath: csvPath,
            extraColumns: extraColumns,
            missingColumns: missingColumns,
            hasDifferences: true,
            timestamp: new Date().toISOString()
          })
        }
      } catch (err) {
        console.error(`Error verificando columnas de ${tableName}:`, err.message)
      }
    }

    res.json({ warnings })
  } catch (err) {
    console.error('Error en column-warnings:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/produccion/schema/sync-columns - Sincronizar columnas nuevas del CSV
app.post('/api/produccion/schema/sync-columns', async (req, res) => {
  const client = await getClient();
  
  try {
    const { table, csvPath, reimport } = req.body;
    
    if (!table || !csvPath) {
      return res.status(400).json({ error: 'Faltan parámetros: table, csvPath' });
    }
    
    const startTime = Date.now();
    
    await client.query('BEGIN');
    
    // Leer CSV
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo CSV no encontrado: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const firstLine = csvContent.split('\\n')[0];
    const csvHeaders = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Renombrar headers duplicados
    const seenColumns = {};
    const renamedHeaders = [];
    for (const header of csvHeaders) {
      if (seenColumns[header]) {
        seenColumns[header]++;
        renamedHeaders.push(`${header}_${seenColumns[header]}`);
      } else {
        seenColumns[header] = 1;
        renamedHeaders.push(header);
      }
    }
    
    // Obtener columnas de PostgreSQL
    const pgColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    const pgResult = await client.query(pgColumnsQuery, [table.toLowerCase()]);
    const pgColumns = pgResult.rows.map(r => r.column_name);
    
    // Encontrar columnas extra en CSV
    const extraColumns = renamedHeaders.filter(h => 
      h && !pgColumns.some(pg => pg.toLowerCase() === h.toLowerCase())
    );
    
    // Agregar columnas nuevas
    const addedColumns = [];
    for (const col of extraColumns) {
      if (!col || col.trim() === '') continue;
      
      try {
        const alterQuery = `ALTER TABLE ${table.toLowerCase()} ADD COLUMN IF NOT EXISTS "${col}" TEXT`;
        await client.query(alterQuery);
        addedColumns.push(col);
      } catch (err) {
        console.error(`Error agregando columna ${col}:`, err.message);
      }
    }
    
    const executionTime = Date.now() - startTime;
    
    // Registrar en historial
    const historyInsert = `
      INSERT INTO tb_sync_history (
        operation_type, table_name, description, columns_added,
        columns_count, rows_affected, success, execution_time_ms, user_action
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await client.query(historyInsert, [
      'COLUMN_SYNC',
      table,
      `Sincronización de columnas desde CSV`,
      addedColumns,
      addedColumns.length,
      0,
      true,
      executionTime,
      'MANUAL'
    ]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      table,
      columnsAdded: addedColumns.length,
      addedColumns,
      executionTime
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en sync-columns:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/produccion/history/warnings - Historial de warnings de columnas
app.get('/api/produccion/history/warnings', async (req, res) => {
  try {
    const historyQuery = `
      SELECT 
        id,
        timestamp,
        operation_type,
        table_name as table,
        description,
        columns_added as "extraColumns",
        success
      FROM tb_sync_history
      WHERE operation_type = 'COLUMN_SYNC'
      ORDER BY timestamp DESC
      LIMIT 50
    `;
    
    const result = await query(historyQuery, []);
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Error en history/warnings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/produccion/history/changes - Historial de cambios/sincronizaciones
app.get('/api/produccion/history/changes', async (req, res) => {
  try {
    const historyQuery = `
      SELECT 
        id,
        timestamp,
        operation_type,
        table_name as table,
        description,
        columns_added,
        columns_count,
        rows_affected,
        success,
        error_message,
        execution_time_ms,
        user_action
      FROM tb_sync_history
      ORDER BY timestamp DESC
      LIMIT 100
    `;
    
    const result = await query(historyQuery, []);
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Error en history/changes:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect()
    console.log('✓ Conexión a PostgreSQL exitosa')
    client.release()
    
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
