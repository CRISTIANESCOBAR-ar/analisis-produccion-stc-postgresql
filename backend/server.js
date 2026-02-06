/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      /^http:\/\/localhost(:\d+)?$/
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(origin);
      }
      return pattern === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
      -- NOTA: tb_TESTES tiene columnas en minúsculas
      MetricasTestes AS (
        SELECT 
          artigo,
          ROUND(SUM(METRAGEM_AVG), 0) AS METROS_TEST
        FROM (
          SELECT 
            artigo,
            partida,
            AVG(CAST(REPLACE(REPLACE(metragem, '.', ''), ',', '.') AS NUMERIC)) AS METRAGEM_AVG
          FROM tb_TESTES
          WHERE dt_prod ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
            AND TO_DATE(dt_prod, 'DD/MM/YYYY') >= TO_DATE($3, 'DD/MM/YYYY') 
            AND TO_DATE(dt_prod, 'DD/MM/YYYY') <= TO_DATE($4, 'DD/MM/YYYY')
            AND artigo IS NOT NULL
            AND artigo != 'ARTIGO'
            AND partida IS NOT NULL
            AND partida !~ '^[A-Z]'
          GROUP BY artigo, partida
        ) sub
        GROUP BY artigo
      ),

      AllArtigos AS (
        SELECT "ARTIGO" AS artigo FROM MetricasCalidad
        UNION 
        SELECT artigo FROM MetricasTestes
      )
      
      SELECT 
        AU.artigo AS "ARTIGO_COMPLETO",
        SUBSTRING(AU.artigo, 1, 10) AS "Articulo",
        SUBSTRING(AU.artigo, 7, 2) AS "Id",
        F."COR" AS "Color",
        F."NOME DE MERCADO" AS "Nombre",
        F."TRAMA" AS "Trama",
        F."PRODUCAO" AS "Prod",
        COALESCE(MT.METROS_TEST, 0) AS "Metros_TEST",
        COALESCE(MC.METROS_REV, 0) AS "Metros_REV"
      FROM AllArtigos AU
      LEFT JOIN MetricasTestes MT ON AU.artigo = MT.artigo
      LEFT JOIN MetricasCalidad MC ON AU.artigo = MC."ARTIGO"
      LEFT JOIN tb_FICHAS F ON AU.artigo = F."ARTIGO CODIGO"
      WHERE F."ARTIGO CODIGO" IS NOT NULL
      ORDER BY AU.artigo
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
          maquina,
          artigo AS ART_TEST,
          CAST(partida AS INTEGER) AS PARTIDA,
          artigo AS TESTES,
          dt_prod,
          aprov,
          obs,
          reprocesso,
          CAST(REPLACE(REPLACE(metragem, '.', ''), ',', '.') AS NUMERIC) AS METRAGEM,
          CAST(REPLACE(REPLACE(larg_al, '.', ''), ',', '.') AS NUMERIC) AS larg_al,
          CAST(REPLACE(REPLACE(gramat, '.', ''), ',', '.') AS NUMERIC) AS gramat,
          CAST(REPLACE(REPLACE(poten, '.', ''), ',', '.') AS NUMERIC) AS poten,
          CAST(REPLACE(REPLACE("%_ENC_URD", '.', ''), ',', '.') AS NUMERIC) AS "%_ENC_URD",
          CAST(REPLACE(REPLACE("%_ENC_TRAMA", '.', ''), ',', '.') AS NUMERIC) AS "%_ENC_TRAMA",
          CAST(REPLACE(REPLACE("%_SK1", '.', ''), ',', '.') AS NUMERIC) AS "%_SK1",
          CAST(REPLACE(REPLACE("%_SK2", '.', ''), ',', '.') AS NUMERIC) AS "%_SK2",
          CAST(REPLACE(REPLACE("%_SK3", '.', ''), ',', '.') AS NUMERIC) AS "%_SK3",
          CAST(REPLACE(REPLACE("%_SK4", '.', ''), ',', '.') AS NUMERIC) AS "%_SK4",
          CAST(REPLACE(REPLACE("%_SKE", '.', ''), ',', '.') AS NUMERIC) AS "%_SKE",
          CAST(REPLACE(REPLACE("%_STT", '.', ''), ',', '.') AS NUMERIC) AS "%_STT",
          CAST(REPLACE(REPLACE("%_SKM", '.', ''), ',', '.') AS NUMERIC) AS "%_SKM"
        FROM tb_TESTES
        WHERE artigo = $1
          AND dt_prod ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND TO_DATE(dt_prod, 'DD/MM/YYYY') >= TO_DATE($2, 'DD/MM/YYYY')
          AND TO_DATE(dt_prod, 'DD/MM/YYYY') <= TO_DATE($3, 'DD/MM/YYYY')
          AND partida IS NOT NULL
          AND partida !~ '^[A-Z]'
      ),
      
      CALIDAD AS (
        SELECT 
          MIN("DAT_PROD") AS DAT_PROD,
          "ARTIGO" AS ART_CAL,
          CAST("PARTIDA" AS INTEGER) AS PARTIDA,
          ROUND(SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)), 0) AS METRAGEM,
          ROUND(AVG(CAST(REPLACE(REPLACE("LARGURA", '.', ''), ',', '.') AS NUMERIC)), 1) AS LARGURA,
          ROUND(AVG(CAST(REPLACE(REPLACE("GR/M2", '.', ''), ',', '.') AS NUMERIC)), 1) AS "GR/M2"
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
          CAST(REPLACE("Oz/jd2", ',', '.') AS NUMERIC) AS "Oz/jd2",
          CAST(REPLACE("Peso/m2", ',', '.') AS NUMERIC) AS "Peso/m2",
          CAST(REPLACE("LARGURA MIN", ',', '.') AS NUMERIC) AS LARGURA_MIN_VAL,
          CAST(REPLACE("LARGURA", ',', '.') AS NUMERIC) AS ANCHO,
          CAST(REPLACE("LARGURA MAX", ',', '.') AS NUMERIC) AS LARGURA_MAX_VAL,
          CAST(REPLACE("SKEW MIN", ',', '.') AS NUMERIC) AS "SKEW MIN",
          (CAST(REPLACE("SKEW MIN", ',', '.') AS NUMERIC) + CAST(REPLACE("SKEW MAX", ',', '.') AS NUMERIC)) / 2.0 AS "SKEW STD",
          CAST(REPLACE("SKEW MAX", ',', '.') AS NUMERIC) AS "SKEW MAX",
          CAST(REPLACE("URD#MIN", ',', '.') AS NUMERIC) AS "URD#MIN",
          (CAST(REPLACE("URD#MIN", ',', '.') AS NUMERIC) + CAST(REPLACE("URD#MAX", ',', '.') AS NUMERIC)) / 2.0 AS "URD#STD",
          CAST(REPLACE("URD#MAX", ',', '.') AS NUMERIC) AS "URD#MAX",
          CAST(REPLACE("TRAMA MIN", ',', '.') AS NUMERIC) AS "TRAMA MIN",
          (CAST(REPLACE("TRAMA MIN", ',', '.') AS NUMERIC) + CAST(REPLACE("TRAMA MAX", ',', '.') AS NUMERIC)) / 2.0 AS "TRAMA STD",
          CAST(REPLACE("TRAMA MAX", ',', '.') AS NUMERIC) AS "TRAMA MAX",
          CAST(REPLACE("VAR STR#MIN TRAMA", ',', '.') AS NUMERIC) AS "VAR STR#MIN TRAMA",
          (CAST(REPLACE("VAR STR#MIN TRAMA", ',', '.') AS NUMERIC) + CAST(REPLACE("VAR STR#MAX TRAMA", ',', '.') AS NUMERIC)) / 2.0 AS "VAR STR#STD TRAMA",
          CAST(REPLACE("VAR STR#MAX TRAMA", ',', '.') AS NUMERIC) AS "VAR STR#MAX TRAMA",
          CAST(REPLACE("VAR STR#MIN URD", ',', '.') AS NUMERIC) AS "VAR STR#MIN URD",
          (CAST(REPLACE("VAR STR#MIN URD", ',', '.') AS NUMERIC) + CAST(REPLACE("VAR STR#MAX URD", ',', '.') AS NUMERIC)) / 2.0 AS "VAR STR#STD URD",
          CAST(REPLACE("VAR STR#MAX URD", ',', '.') AS NUMERIC) AS "VAR STR#MAX URD",
          CAST(REPLACE("ENC#ACAB URD", ',', '.') AS NUMERIC) AS "ENC#ACAB URD"
        FROM tb_FICHAS
        WHERE "ARTIGO CODIGO" = $7
      )
      
      SELECT 
        CAST(TC.maquina AS INTEGER) AS "Maquina",
        TC.ART_TEST AS "Articulo",
        E."TRAMA" AS "Trama",
        TC.PARTIDA AS "Partida",
        TC.TESTES AS "C",
        TC.dt_prod AS "Fecha",
        TC.aprov AS "Ap",
        TC.obs AS "Obs",
        TC.reprocesso AS "R",
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
        
        ROUND(TC.larg_al, 1) AS "Ancho_TEST",
        
        ROUND(TC.CALIDAD_GRM2, 1) AS "Peso_MESA",
        E."Peso/m2" * 0.95 AS "Peso_MIN",
        ROUND(E."Peso/m2", 1) AS "Peso_STD",
        E."Peso/m2" * 1.05 AS "Peso_MAX",
        ROUND(TC.gramat, 1) AS "Peso_TEST",
        
        TC.poten AS "Potencial",
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
        
        TC."%_STT" AS "%_STT",
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
      ORDER BY TC.dt_prod
    `

    const result = await query(sql, [articulo, fechaInicioShort, fechaFinShort, articulo, fechaInicioShort, fechaFinShort, articulo])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en analisis-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Revisión CQ - Resumen por revisor
app.get('/api/produccion/calidad/revision-cq', async (req, res) => {
  try {
    const { startDate, endDate, tramas } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parámetros "startDate" y "endDate" requeridos' })
    }

    const fechaInicio = isoToLocal(startDate)
    const fechaFin = isoToLocal(endDate)

    const sql = `
      SELECT 
        "REVISOR FINAL" AS "Revisor",
        ROUND(SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)), 0) AS "Mts_Total",
        ROUND(
          (COUNT(CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN 1 END)::NUMERIC * 100.0 / 
           NULLIF(COUNT(*), 0)),
          1
        ) AS "Calidad_Perc",
        ROUND(
          CASE 
            WHEN SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)) > 0 
            THEN (
              SUM(
                CASE 
                  WHEN "PONTUACAO" ~ '^[0-9]+([,.][0-9]+)?$'
                  THEN CAST(REPLACE(REPLACE("PONTUACAO", '.', ''), ',', '.') AS NUMERIC)
                  ELSE 0
                END
              ) / SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC))
            ) * 10000
            ELSE 0
          END,
          1
        ) AS "Pts_100m2",
        COUNT(CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN 1 END) AS "Rollos_1era",
        COUNT(
          CASE 
            WHEN "PONTUACAO" ~ '^[0-9]+([,.][0-9]+)?$' AND 
                 CAST(REPLACE(REPLACE("PONTUACAO", '.', ''), ',', '.') AS NUMERIC) = 0 
            THEN 1 
          END
        ) AS "Rollos_Sin_Pts",
        ROUND(
          (
            COUNT(
              CASE 
                WHEN "PONTUACAO" ~ '^[0-9]+([,.][0-9]+)?$' AND 
                     CAST(REPLACE(REPLACE("PONTUACAO", '.', ''), ',', '.') AS NUMERIC) = 0 
                THEN 1 
              END
            )::NUMERIC * 100.0 / 
            NULLIF(COUNT(CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN 1 END), 0)
          ), 
          1
        ) AS "Perc_Sin_Pts"
      FROM tb_CALIDAD
      WHERE "DAT_PROD" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        AND TO_DATE("DAT_PROD", 'DD/MM/YYYY') >= TO_DATE($1, 'DD/MM/YYYY')
        AND TO_DATE("DAT_PROD", 'DD/MM/YYYY') <= TO_DATE($2, 'DD/MM/YYYY')
        AND ($3 = 'Todas' OR "TRAMA" = $3)
        AND "REVISOR FINAL" IS NOT NULL
        AND "REVISOR FINAL" != ''
      GROUP BY "REVISOR FINAL"
      ORDER BY "Revisor"
    `

    const result = await query(sql, [fechaInicio, fechaFin, tramas || 'Todas'])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en revision-cq:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Detalle de revisor - Partidas revisadas por un revisor específico
app.get('/api/produccion/calidad/revisor-detalle', async (req, res) => {
  try {
    const { startDate, endDate, revisor, tramas } = req.query

    if (!startDate || !endDate || !revisor) {
      return res.status(400).json({ error: 'Parámetros "startDate", "endDate" y "revisor" requeridos' })
    }

    const fechaInicio = isoToLocal(startDate)
    const fechaFin = isoToLocal(endDate)

    const sql = `
      SELECT 
        MIN("HORA") AS "HoraInicio",
        MIN("NM MERC") AS "NombreArticulo",
        "PARTIDA" AS "Partidas",
        ROUND(SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)), 0) AS "MetrosRevisados",
        ROUND(
          (COUNT(CASE WHEN "QUALIDADE" = 'PRIMEIRA' THEN 1 END)::NUMERIC * 100.0 / 
           NULLIF(COUNT(*), 0)),
          1
        ) AS "CalidadPct",
        ROUND(
          CASE 
            WHEN SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC)) > 0 
            THEN (
              SUM(
                CASE 
                  WHEN "PONTUACAO" ~ '^[0-9]+([,.][0-9]+)?$'
                  THEN CAST(REPLACE(REPLACE("PONTUACAO", '.', ''), ',', '.') AS NUMERIC)
                  ELSE 0
                END
              ) / SUM(CAST(REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.') AS NUMERIC))
            ) * 10000
            ELSE 0
          END,
          1
        ) AS "Pts100m2",
        COUNT(*) AS "TotalRollos",
        COUNT(
          CASE 
            WHEN "PONTUACAO" ~ '^[0-9]+([,.][0-9]+)?$' AND 
                 CAST(REPLACE(REPLACE("PONTUACAO", '.', ''), ',', '.') AS NUMERIC) = 0 
            THEN 1 
          END
        ) AS "SinPuntos",
        ROUND(
          (
            COUNT(
              CASE 
                WHEN "PONTUACAO" ~ '^[0-9]+([,.][0-9]+)?$' AND 
                     CAST(REPLACE(REPLACE("PONTUACAO", '.', ''), ',', '.') AS NUMERIC) = 0 
                THEN 1 
              END
            )::NUMERIC * 100.0 / 
            NULLIF(COUNT(*), 0)
          ), 
          1
        ) AS "SinPuntosPct",
        MIN("TEAR") AS "Telar",
        0 AS "EficienciaPct",
        0 AS "RU105",
        0 AS "RT105"
      FROM tb_CALIDAD
      WHERE "DAT_PROD" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        AND TO_DATE("DAT_PROD", 'DD/MM/YYYY') >= TO_DATE($1, 'DD/MM/YYYY')
        AND TO_DATE("DAT_PROD", 'DD/MM/YYYY') <= TO_DATE($2, 'DD/MM/YYYY')
        AND "REVISOR FINAL" = $3
        AND ($4 = 'Todas' OR "TRAMA" = $4)
        AND "PARTIDA" IS NOT NULL
        AND "PARTIDA" != ''
      GROUP BY "PARTIDA"
      ORDER BY MIN("HORA")
    `

    const result = await query(sql, [fechaInicio, fechaFin, revisor, tramas || 'Todas'])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en revisor-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Detalle de partida - Piezas de una partida específica
app.get('/api/produccion/calidad/partida-detalle', async (req, res) => {
  try {
    const { fecha, partida, revisor } = req.query

    if (!fecha || !partida || !revisor) {
      return res.status(400).json({ error: 'Parámetros "fecha", "partida" y "revisor" requeridos' })
    }

    const fechaLocal = isoToLocal(fecha)

    const sql = `
      SELECT 
        "GRP_DEF",
        "COD_DE",
        "DEFEITO",
        "METRAGEM",
        "QUALIDADE",
        "HORA",
        "EMENDAS",
        "PEÇA",
        "ETIQUETA",
        "LARGURA",
        "PONTUACAO",
        "ARTIGO",
        "COR",
        "NM MERC" AS "NM_MERC",
        "TRAMA",
        "PARTIDA"
      FROM tb_CALIDAD
      WHERE "DAT_PROD" = $1
        AND "PARTIDA" = $2
        AND "REVISOR FINAL" = $3
      ORDER BY "HORA", "PEÇA"
    `

    const result = await query(sql, [fechaLocal, partida, revisor])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en partida-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET: Defectos de una pieza específica
app.get('/api/produccion/calidad/defectos-detalle', async (req, res) => {
  try {
    const { etiqueta } = req.query

    if (!etiqueta) {
      return res.status(400).json({ error: 'Parámetro "etiqueta" requerido' })
    }

    const sql = `
      SELECT 
        partida AS "PARTIDA",
        peca AS "PECA",
        etiqueta AS "ETIQUETA",
        cod_def AS "COD_DEF",
        desc_defeito AS "DESC_DEFEITO",
        pontos AS "PONTOS",
        CASE 
          WHEN qualidade = '1' THEN 'PRIMEIRA'
          WHEN qualidade = '2' THEN 'SEGUNDA'
          WHEN qualidade = '3' THEN 'TERCEIRA'
          ELSE qualidade
        END AS "QUALIDADE",
        data_prod AS "DATA_PROD"
      FROM tb_DEFECTOS
      WHERE etiqueta = $1
      ORDER BY cod_def
    `

    const result = await query(sql, [etiqueta])
    res.json(result.rows)
  } catch (err) {
    console.error('Error en defectos-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS DE CONTROL DE IMPORTACIONES
// =====================================================

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
        // Primero obtener el conteo de filas
        const tableQuery = `
          SELECT n_live_tup as row_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public' 
            AND relname = $1
        `
        const tableResult = await query(tableQuery, [tableName.toLowerCase()])
        
        if (tableResult.rows.length > 0) {
          status.rows_imported = tableResult.rows[0].row_count || 0
        }
        
        // Obtener fecha de última importación desde tb_sync_history
        try {
          const historyQuery = `
            SELECT timestamp, rows_affected
            FROM tb_sync_history
            WHERE table_name = $1 
              AND operation_type = 'import'
              AND success = true
            ORDER BY timestamp DESC
            LIMIT 1
          `
          const historyResult = await query(historyQuery, [tableName])
          
          if (historyResult.rows.length > 0) {
            status.last_import_date = historyResult.rows[0].timestamp.toISOString()
            // Si el history tiene rows_affected, usarlo en lugar del conteo de pg_stat
            if (historyResult.rows[0].rows_affected > 0) {
              status.rows_imported = historyResult.rows[0].rows_affected
            }
          }
        } catch (histErr) {
          // Si tb_sync_history no existe o hay error, continuar sin fecha
          console.log(`No hay historial de importación para ${tableName}`)
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
        } else if (status.rows_imported > 0) {
          // Si hay filas pero no fecha de importación, asumir desactualizado
          status.status = 'OUTDATED'
        } else {
          status.status = 'NOT_IMPORTED'
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

// GET /api/produccion/import/warnings-history - Historial de detección de columnas
app.get('/api/produccion/import/warnings-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    
    // TODO: Implementar tabla de historial en PostgreSQL
    // Por ahora devolvemos array vacío para evitar error 404
    const history = []
    
    res.json({ 
      history,
      total: history.length,
      message: 'Historial de detección de columnas (pendiente de implementar)'
    })
  } catch (err) {
    console.error('Error en warnings-history:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/schema/changes-log - Historial de sincronizaciones
app.get('/api/produccion/schema/changes-log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    
    // Consultar tabla de sincronizaciones si existe
    const sql = `
      SELECT 
        id,
        timestamp,
        operation_type,
        table_name,
        description,
        columns_added,
        columns_count,
        rows_affected,
        success,
        error_message,
        execution_time_ms
      FROM tb_sync_history
      ORDER BY timestamp DESC
      LIMIT $1
    `
    
    const result = await query(sql, [limit])
    
    res.json({ 
      changes: result.rows,
      total: result.rows.length
    })
  } catch (err) {
    // Si la tabla no existe, devolver array vacío
    if (err.code === '42P01') { // undefined_table
      console.log('Tabla tb_sync_history no existe aún')
      res.json({ 
        changes: [],
        total: 0,
        message: 'Historial de sincronizaciones vacío'
      })
    } else {
      console.error('Error en changes-log:', err)
      res.status(500).json({ error: err.message })
    }
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

// POST /api/produccion/import/update-outdated - Actualizar tablas desactualizadas
app.post('/api/produccion/import/update-outdated', async (req, res) => {
  try {
    const { tables, csvFolder } = req.body;
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ success: false, error: 'Parámetro "tables" (array) requerido' });
    }
    
    const tableScriptMap = {
      'tb_FICHAS': 'import-fichas.js',
      'tb_PRODUCCION': 'import-produccion.js',
      'tb_CALIDAD': 'import-calidad.js',
      'tb_DEFECTOS': 'import-defectos.js',
      'tb_TESTES': 'import-testes.js',
      'tb_PARADAS': 'import-paradas.js',
      'tb_PARTIDAS': 'import-partidas.js',
      'tb_EFICIENCIA_MAQUINAS': 'import-eficiencia.js',
      'tb_OPCIONES': 'import-opciones.js',
      'tb_ENSAYOS': 'import-ensayos.js',
      'tb_PRODUCCION_OE': 'import-produccion-oe.js',
      'tb_RESIDUOS_INDIGO': 'import-residuos-indigo.js',
      'tb_RESIDUOS_POR_SECTOR': 'import-residuos-por-sector.js',
      'tb_PROCESO': 'import-proceso.js',
      'tb_CALIDAD_FIBRA': 'import-calidad-fibra.js'
    };
    
    const results = [];
    const timings = {};
    let totalRows = 0;
    
    for (const table of tables) {
      const scriptName = tableScriptMap[table];
      
      if (!scriptName) {
        results.push({ table, success: false, error: 'Tabla no reconocida' });
        continue;
      }
      
      const scriptPath = path.join(__dirname, '..', 'migration', scriptName);
      
      if (!fs.existsSync(scriptPath)) {
        results.push({ table, success: false, error: 'Script no encontrado' });
        continue;
      }
      
      const startTime = Date.now();
      
      try {
        await new Promise((resolve, reject) => {
          const child = spawn('node', [scriptPath], {
            cwd: path.join(__dirname, '..', 'migration'),
            env: { ...process.env, CSV_FOLDER: csvFolder || process.env.CSV_FOLDER }
          });
          
          let output = '';
          let rows = 0;
          
          child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            const match = text.match(/(\d+)\s+(filas|registros|rows)/i);
            if (match) {
              rows = parseInt(match[1], 10);
            }
          });
          
          child.stderr.on('data', (data) => {
            output += data.toString();
          });
          
          child.on('close', async (code) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            timings[table] = parseFloat(elapsed);
            
            if (code === 0) {
              try {
                await query(
                  `INSERT INTO tb_sync_history (operation_type, table_name, rows_affected, description)
                   VALUES ('IMPORT', $1, $2, 'Actualización automática')`,
                  [table, rows]
                );
              } catch (dbErr) {
                console.error(`Error registrando en tb_sync_history para ${table}:`, dbErr);
              }
              
              totalRows += rows;
              results.push({ table, success: true, rows, time: elapsed });
              resolve();
            } else {
              results.push({ table, success: false, error: `Proceso terminó con código ${code}`, output });
              reject(new Error(`Proceso falló para ${table}`));
            }
          });
          
          child.on('error', (err) => {
            results.push({ table, success: false, error: err.message });
            reject(err);
          });
        });
      } catch (err) {
        // Error ya registrado en results
        console.error(`Error importando ${table}:`, err.message);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: failCount === 0,
      results,
      timings,
      summary: {
        total: tables.length,
        success: successCount,
        failed: failCount,
        totalRows
      }
    });
    
  } catch (err) {
    console.error('Error en update-outdated:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/produccion/import/force-all - Forzar importación de todas las tablas
app.post('/api/produccion/import/force-all', async (req, res) => {
  try {
    const { csvFolder } = req.body;
    
    const allTables = [
      'tb_FICHAS',
      'tb_PRODUCCION',
      'tb_CALIDAD',
      'tb_DEFECTOS',
      'tb_TESTES',
      'tb_PARADAS',
      'tb_PARTIDAS',
      'tb_EFICIENCIA_MAQUINAS',
      'tb_OPCIONES',
      'tb_ENSAYOS'
    ];
    
    // Reutilizar la lógica de update-outdated
    req.body.tables = allTables;
    
    const tableScriptMap = {
      'tb_FICHAS': 'import-fichas.js',
      'tb_PRODUCCION': 'import-produccion.js',
      'tb_CALIDAD': 'import-calidad.js',
      'tb_DEFECTOS': 'import-defectos.js',
      'tb_TESTES': 'import-testes.js',
      'tb_PARADAS': 'import-paradas.js',
      'tb_PARTIDAS': 'import-partidas.js',
      'tb_EFICIENCIA_MAQUINAS': 'import-eficiencia.js',
      'tb_OPCIONES': 'import-opciones.js',
      'tb_ENSAYOS': 'import-ensayos.js',
      'tb_PRODUCCION_OE': 'import-produccion-oe.js',
      'tb_RESIDUOS_INDIGO': 'import-residuos-indigo.js',
      'tb_RESIDUOS_POR_SECTOR': 'import-residuos-por-sector.js',
      'tb_PROCESO': 'import-proceso.js',
      'tb_CALIDAD_FIBRA': 'import-calidad-fibra.js'
    };
    
    const results = [];
    const timings = {};
    let totalRows = 0;
    
    for (const table of allTables) {
      const scriptName = tableScriptMap[table];
      const scriptPath = path.join(__dirname, '..', 'migration', scriptName);
      
      if (!fs.existsSync(scriptPath)) {
        results.push({ table, success: false, error: 'Script no encontrado' });
        continue;
      }
      
      const startTime = Date.now();
      
      try {
        await new Promise((resolve, reject) => {
          const child = spawn('node', [scriptPath], {
            cwd: path.join(__dirname, '..', 'migration'),
            env: { ...process.env, CSV_FOLDER: csvFolder || process.env.CSV_FOLDER }
          });
          
          let output = '';
          let rows = 0;
          
          child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            
            const match = text.match(/(\d+)\s+(filas|registros|rows)/i);
            if (match) {
              rows = parseInt(match[1], 10);
            }
          });
          
          child.stderr.on('data', (data) => {
            output += data.toString();
          });
          
          child.on('close', async (code) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            timings[table] = parseFloat(elapsed);
            
            if (code === 0) {
              try {
                await query(
                  `INSERT INTO tb_sync_history (operation_type, table_name, rows_affected, description)
                   VALUES ('IMPORT', $1, $2, 'Forzar importación todas las tablas')`,
                  [table, rows]
                );
              } catch (dbErr) {
                console.error(`Error registrando en tb_sync_history para ${table}:`, dbErr);
              }
              
              totalRows += rows;
              results.push({ table, success: true, rows, time: elapsed });
              resolve();
            } else {
              results.push({ table, success: false, error: `Proceso terminó con código ${code}`, output });
              reject(new Error(`Proceso falló para ${table}`));
            }
          });
          
          child.on('error', (err) => {
            results.push({ table, success: false, error: err.message });
            reject(err);
          });
        });
      } catch (err) {
        console.error(`Error importando ${table}:`, err.message);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: failCount === 0,
      results,
      timings,
      summary: {
        total: allTables.length,
        success: successCount,
        failed: failCount,
        totalRows
      }
    });
    
  } catch (err) {
    console.error('Error en force-all:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/produccion/import/force-table - Forzar importación de una tabla desde CSV
app.post('/api/produccion/import/force-table', async (req, res) => {
  try {
    const { table } = req.body
    
    if (!table) {
      return res.status(400).json({ success: false, error: 'Parámetro "table" requerido' })
    }
    
    // Mapeo de tablas a scripts de importación
    const tableScriptMap = {
      'tb_FICHAS': 'import-fichas.js',
      'tb_PRODUCCION': 'import-produccion.js',
      'tb_CALIDAD': 'import-calidad.js',
      'tb_DEFECTOS': 'import-defectos.js',
      'tb_TESTES': 'import-testes.js',
      'tb_PARADAS': 'import-paradas.js',
      'tb_PROCESO': 'import-proceso.js',
      'tb_RESIDUOS_INDIGO': 'import-residuos-indigo.js',
      'tb_CALIDAD_FIBRA': 'import-calidad-fibra.js',
      'tb_PRODUCCION_OE': 'import-produccion-oe.js'
    }
    
    const scriptName = tableScriptMap[table]
    
    if (!scriptName) {
      return res.status(400).json({ 
        success: false, 
        error: `No hay script de importación para la tabla: ${table}` 
      })
    }
    
    const scriptPath = path.join(__dirname, '..', 'migration', scriptName)
    
    console.log(`📦 Iniciando importación de ${table} usando ${scriptName}`)
    
    // Ejecutar script como child process
    const child = spawn('node', [scriptPath], {
      cwd: path.join(__dirname, '..', 'migration'),
      env: process.env
    })
    
    let stdout = ''
    let stderr = ''
    let rows = 0
    
    child.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      console.log(output.trim())
      
      // Intentar extraer número de filas del output
      const match = output.match(/(\d+)\s+(filas|registros|rows)/i)
      if (match) {
        rows = parseInt(match[1])
      }
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
      console.error(data.toString())
    })
    
    child.on('error', (err) => {
      console.error(`Error ejecutando ${scriptName}:`, err)
      res.status(500).json({ 
        success: false, 
        error: `Error ejecutando script: ${err.message}` 
      })
    })
    
    child.on('close', async (code) => {
      if (code === 0) {
        // Registrar en historial
        try {
          await query(`
            INSERT INTO tb_sync_history (
              timestamp, operation_type, table_name, description, 
              rows_affected, success, execution_time_ms
            ) VALUES (NOW(), 'import', $1, 'Importación forzada desde UI', $2, true, 0)
          `, [table, rows])
        } catch (histErr) {
          console.error('Error registrando en historial:', histErr)
        }
        
        res.json({ 
          success: true, 
          rows, 
          message: `Tabla ${table} importada exitosamente`,
          output: stdout
        })
      } else {
        res.status(500).json({ 
          success: false, 
          error: `Script terminó con código ${code}`,
          stderr,
          stdout
        })
      }
    })
    
  } catch (err) {
    console.error('Error en force-table:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

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
