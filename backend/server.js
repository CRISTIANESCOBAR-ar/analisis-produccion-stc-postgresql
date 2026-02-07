/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getImportStatus, importCSV, importAll, importSpecificTables, importForceAll, renameduplicateHeaders, getTableColumns, compareColumns, addColumnsToTable } from './import-manager.js'

const { Pool } = pg
const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function looksLikeWindowsPath(p) {
  if (!p) return false
  // Drive letter (C:\...) or UNC (\\server\share)
  return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p)
}

function sanitizeCsvFolder(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  // Si el backend corre en Linux (contenedor/servidor), una ruta Windows no existe.
  if (process.platform !== 'win32' && looksLikeWindowsPath(value)) return ''
  return value
}

function defaultCsvFolder() {
  // Windows dev histórico: C:\STC\CSV
  // Linux/Container: montar volumen en /data/csv
  const envFolder = String(process.env.CSV_FOLDER || '').trim()
  if (envFolder) return envFolder
  return process.platform === 'win32' ? 'C:\\STC\\CSV' : '/data/csv'
}

function resolveCsvFolderFromReq(req) {
  const q = sanitizeCsvFolder(req?.query?.csvFolder)
  if (q) return q
  return defaultCsvFolder()
}

function resolveCsvFolderFromBody(req) {
  const b = sanitizeCsvFolder(req?.body?.csvFolder)
  if (b) return b
  return defaultCsvFolder()
}

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

function hrMs() {
  return Number(process.hrtime.bigint()) / 1_000_000
}

// Helper: query wrapper
async function query(text, params, label) {
  const start = hrMs()
  const res = await pool.query(text, params)
  const duration = hrMs() - start
  const tag = label ? ` [${label}]` : ''
  const rows = Array.isArray(res?.rows) ? res.rows.length : res?.rowCount
  console.log(`✓ Query${tag} in ${duration.toFixed(1)}ms (rows=${rows ?? 'n/a'})`)
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

// Helpers SQL (PostgreSQL): parseo robusto de fechas/números desde TEXT
function sqlParseDate(colIdent) {
  // Soporta DD/MM/YYYY y YYYY-MM-DD (opcional con hora)
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring(${colIdent} from 1 for 10), 'DD/MM/YYYY')
      WHEN ${colIdent} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${colIdent} from 1 for 10)::date
      ELSE NULL
    END
  )`
}

function sqlParseNumber(colIdent) {
  // Convierte TEXT numérico con '.' o ',' decimal; ignora valores no numéricos.
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

function sqlParseNumberIntl(colIdent) {
  // Soporta números en formato europeo con separador de miles '.' y decimal ',' (ej: 1.980,00)
  // y también formatos simples (ej: 1980.00 o 1980,00).
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$' THEN replace(replace(${colIdent}, '.', ''), ',', '.')::numeric
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

async function tableExists(tableName) {
  const res = await query('SELECT to_regclass($1) AS reg', [`public.${tableName}`])
  return Boolean(res.rows?.[0]?.reg)
}

// =====================================================
// MIDDLEWARE
// =====================================================
const allowedOriginRegexes = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
]

const allowedOriginList = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function isOriginAllowed(origin, host) {
  if (!origin) return true
  if (allowedOriginList.includes(origin)) return true
  if (allowedOriginRegexes.some((re) => re.test(origin))) return true

  // Despliegue típico (Podman + reverse proxy): el frontend sirve desde la misma origin,
  // y /api se proxifica al backend. Permitimos Origin == http(s)://<host>.
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) return true

  return false
}

const corsOptionsDelegate = (req, cb) => {
  const origin = req.header('Origin')
  const host = req.headers.host

  const allowed = isOriginAllowed(origin, host)
  cb(null, {
    origin: allowed,
    credentials: true,
  })
}

app.use(cors(corsOptionsDelegate))
app.options('*', cors(corsOptionsDelegate))
app.use(express.json({ limit: '10mb' }))

// =====================================================
// FRONTEND (PRODUCCIÓN): servir SPA desde el mismo servidor
// =====================================================
if (process.env.NODE_ENV === 'production') {
  const frontendDist = process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : path.resolve(__dirname, '..', 'frontend', 'dist')

  app.use(express.static(frontendDist))
  // SPA fallback: cualquier ruta que no sea /api/... vuelve a index.html
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001

// =====================================================
// PRODUCCION: helpers de diferencias / historial
// =====================================================
function readCsvHeaderLine(csvPath) {
  const fd = fs.openSync(csvPath, 'r')
  try {
    const buffer = Buffer.alloc(64 * 1024)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0)
    const chunk = buffer.toString('utf-8', 0, bytesRead)
    const nl = chunk.indexOf('\n')
    const line = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/\r$/u, '')
    return line
  } finally {
    fs.closeSync(fd)
  }
}

async function ensureSyncHistoryTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS tb_column_warnings_history (
      id BIGSERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      csv_path TEXT,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      extra_columns TEXT[] NOT NULL DEFAULT '{}',
      missing_columns TEXT[] NOT NULL DEFAULT '{}'
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_column_warnings_history_detected_at
      ON tb_column_warnings_history(detected_at DESC)
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_column_warnings_history_table
      ON tb_column_warnings_history(table_name)
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS tb_schema_changes_log (
      id BIGSERIAL PRIMARY KEY,
      table_name TEXT NOT NULL,
      change_type TEXT NOT NULL DEFAULT 'ADD_COLUMNS',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      columns_added TEXT[] NOT NULL DEFAULT '{}',
      reimported BOOLEAN NOT NULL DEFAULT false,
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT
    )
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_tb_schema_changes_log_applied_at
      ON tb_schema_changes_log(applied_at DESC)
  `)
}

function arraysEqualCaseSensitive(a, b) {
  const aa = Array.isArray(a) ? a : []
  const bb = Array.isArray(b) ? b : []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false
  }
  return true
}

function dateVariants(dateStr) {
  const s = String(dateStr || '').trim()
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (iso) {
    const [yyyy, mm, dd] = s.split('-')
    return { iso: s, br: `${dd}/${mm}/${yyyy}` }
  }
  const br = /^\d{2}\/\d{2}\/\d{4}$/.test(s)
  if (br) {
    const [dd, mm, yyyy] = s.split('/')
    return { iso: `${yyyy}-${mm}-${dd}`, br: s }
  }
  return { iso: s, br: s }
}

function dateTextCandidates(dateStr) {
  const v = dateVariants(dateStr)
  const out = new Set([v.iso, v.br])

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v.br)) {
    const [dd, mm, yyyy] = v.br.split('/')
    const ddNo = String(parseInt(dd, 10))
    const mmNo = String(parseInt(mm, 10))
    out.add(`${ddNo}/${mmNo}/${yyyy}`)
  }

  return Array.from(out).filter(Boolean)
}

async function ensureCalidadIndexes() {
  // Índices pensados para acelerar filtros por (EMP, fecha text, revisor/partida)
  // Usamos CONCURRENTLY para minimizar locks en tablas grandes.
  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_datprod
        ON tb_calidad ("EMP", "DAT_PROD")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_datprod:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_datprod_revisor
        ON tb_calidad ("EMP", "DAT_PROD", "REVISOR FINAL")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_datprod_revisor:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_calidad_emp_partida_revisor_datprod
        ON tb_calidad ("EMP", "PARTIDA", "REVISOR FINAL", "DAT_PROD")
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_calidad_emp_partida_revisor_datprod:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_produccion_partida_tecelagem
        ON tb_produccion ("PARTIDA")
        WHERE "FILIAL" = '05' AND "SELETOR" = 'TECELAGEM'
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_produccion_partida_tecelagem:', e.message)
  }

  try {
    await query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tb_defectos_etiqueta_trim
        ON tb_defectos ((btrim(etiqueta)))
    `)
  } catch (e) {
    console.warn('No se pudo crear idx_tb_defectos_etiqueta_trim:', e.message)
  }

  // Stats: opcional (puede competir con consultas y volver lento el UI)
  if (process.env.PERF_ANALYZE_ON_STARTUP === '1') {
    try {
      await query('ANALYZE tb_calidad')
    } catch (e) {
      console.warn('No se pudo ANALYZE tb_calidad:', e.message)
    }
    try {
      await query('ANALYZE tb_produccion')
    } catch (e) {
      console.warn('No se pudo ANALYZE tb_produccion:', e.message)
    }
  }
}

async function maybeInsertWarningHistory({ tableName, csvPath, extraColumns, missingColumns }) {
  // Evita spam: solo inserta si cambió respecto al último registro de esa tabla.
  const last = await query(
    `SELECT extra_columns, missing_columns FROM tb_column_warnings_history WHERE table_name = $1 ORDER BY detected_at DESC LIMIT 1`,
    [tableName]
  )

  const prev = last.rows?.[0]
  const sameAsPrev =
    prev &&
    arraysEqualCaseSensitive(prev.extra_columns || [], extraColumns || []) &&
    arraysEqualCaseSensitive(prev.missing_columns || [], missingColumns || [])

  if (sameAsPrev) return

  await query(
    `INSERT INTO tb_column_warnings_history (table_name, csv_path, extra_columns, missing_columns)
     VALUES ($1, $2, $3, $4)`,
    [tableName, csvPath || null, extraColumns || [], missingColumns || []]
  )
}

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
// ENDPOINTS CALIDAD (para UI /revision-cq)
// Base URL en frontend: /api/produccion
// =====================================================

// GET /api/produccion/calidad/revision-cq - Reporte agrupado por Revisor
app.get('/api/produccion/calidad/revision-cq', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Se requieren startDate y endDate' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumber('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${datProdDate} BETWEEN $1::date AND $2::date`
    const params = sameDay ? [dateTextCandidates(startDate)] : [startDate, endDate]

    const sql = `
      WITH CAL AS (
        SELECT
          "DAT_PROD",
          "ARTIGO",
          SUM(${metragemNum}) AS METRAGEM,
          AVG(${pontuacaoNum}) AS PONTUACAO,
          AVG(${larguraNum}) AS LARGURA,
          "REVISOR FINAL" AS REVISOR_FINAL,
          btrim("QUALIDADE") AS QUALIDADE
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
        GROUP BY
          "DAT_PROD",
          "ARTIGO",
          "REVISOR FINAL",
          "PEÇA",
          "QUALIDADE",
          "ETIQUETA"
      ),
      RETALHO_METROS AS (
        SELECT
          SUM(${metragemNum}) AS METRAGEM_RETALHO
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "QUALIDADE" ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      REVISORES AS (
        SELECT
          REVISOR_FINAL AS "Revisor",
          CAST(SUM(METRAGEM) AS INTEGER) AS "Mts_Total",
          ROUND(
            SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            / NULLIF(SUM(METRAGEM), 0) * 100
          , 1) AS "Calidad_Perc",
          ROUND(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
            /
            NULLIF(
              (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            , 0)
          , 1) AS "Pts_100m2",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) AS "Rollos_1era",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) AS "Rollos_Sin_Pts",
          ROUND(
            (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
          , 1) AS "Perc_Sin_Pts"
        FROM CAL
        GROUP BY REVISOR_FINAL
      )
      SELECT * FROM REVISORES
      UNION ALL
      SELECT
        'RETALHO' AS "Revisor",
        ROUND(METRAGEM_RETALHO)::int AS "Mts_Total",
        0::numeric AS "Calidad_Perc",
        0::numeric AS "Pts_100m2",
        0::int AS "Rollos_1era",
        0::int AS "Rollos_Sin_Pts",
        0::numeric AS "Perc_Sin_Pts"
      FROM RETALHO_METROS
      WHERE METRAGEM_RETALHO > 0
      ORDER BY "Mts_Total" DESC
    `

    const result = await query(sql, params, 'calidad/revision-cq')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revision-cq ${startDate}..${endDate} tramas=${tramas} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revision-cq:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/revisor-detalle - Detalle por revisor (con partidas)
app.get('/api/produccion/calidad/revisor-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const { startDate, endDate, revisor } = req.query
    const tramas = req.query.tramas || 'Todas'

    if (!startDate || !endDate || !revisor) {
      return res.status(400).json({ error: 'Se requieren startDate, endDate y revisor' })
    }

    let tramasFilter = ''
    if (tramas === 'ALG 100%') tramasFilter = `AND left("ARTIGO", 1) = 'A'`
    else if (tramas === 'P + E') tramasFilter = `AND left("ARTIGO", 1) = 'Y'`
    else if (tramas === 'POL 100%') tramasFilter = `AND left("ARTIGO", 1) = 'P'`

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumber('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const calLarguraNum = sqlParseNumber('"LARGURA"')
    const prodPtsLidosNum = sqlParseNumber('P."PONTOS_LIDOS"')
    const prodPts100Num = sqlParseNumber('P."PONTOS_100%"')
    const prodParTraNum = sqlParseNumber('P."PARADA TEC TRAMA"')
    const prodParUrdNum = sqlParseNumber('P."PARADA TEC URDUME"')

    const sameDay = String(startDate) === String(endDate)
    const dateFilterSql = sameDay
      ? `"DAT_PROD" = ANY($1::text[])`
      : `${calDatProdDate} BETWEEN $1::date AND $2::date`
    const revisorParam = sameDay ? '$2' : '$3'
    const params = sameDay ? [dateTextCandidates(startDate), revisor] : [startDate, endDate, revisor]

    const sql = `
      WITH RAW AS (
        SELECT
          "NM MERC" as "NombreArticulo",
          "PARTIDA" as "PARTIDA",
          "DAT_PROD" as "DAT_PROD",
          "ARTIGO" as "ARTIGO",
          "PEÇA" as "PEÇA",
          "ETIQUETA" as "ETIQUETA",
          btrim("QUALIDADE") AS QUALIDADE,
          "HORA" as "HORA",
          ${calMetragemNum} AS METRAGEM,
          ${calPontuacaoNum} AS PONTUACAO,
          ${calLarguraNum} AS LARGURA
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${dateFilterSql}
          AND "REVISOR FINAL" = ${revisorParam}
          AND "QUALIDADE" NOT ILIKE '%RETALHO%'
          ${tramasFilter}
      ),
      CAL AS (
        SELECT
          "NombreArticulo",
          "PARTIDA",
          SUM(METRAGEM) AS METRAGEM,
          AVG(PONTUACAO) AS PONTUACAO,
          AVG(LARGURA) AS LARGURA,
          QUALIDADE
        FROM RAW
        GROUP BY
          "NombreArticulo",
          "PARTIDA",
          "DAT_PROD",
          "ARTIGO",
          "PEÇA",
          QUALIDADE,
          "ETIQUETA"
      ),
      HorasPartida AS (
        SELECT
          "PARTIDA" as PARTIDA,
          MIN("HORA") as "HoraInicio"
        FROM RAW
        GROUP BY "PARTIDA"
      ),
      CalidadPorPartida AS (
        SELECT
          "NombreArticulo",
          "PARTIDA",
          "PARTIDA" as "Partidas",
          CAST(SUM(METRAGEM) AS INTEGER) as "MetrosRevisados",
          ROUND(
            SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            / NULLIF(SUM(METRAGEM), 0) * 100
          , 1) as "CalidadPct",
          ROUND(
            (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN COALESCE(PONTUACAO, 0) ELSE 0 END) * 100)
            /
            NULLIF(
              (SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM * COALESCE(LARGURA, 0) ELSE 0 END))
              / NULLIF(SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END), 0)
              / 100
              * SUM(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN METRAGEM ELSE 0 END)
            , 0)
          , 1) as "Pts100m2",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END) as "TotalRollos",
          COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END) as "SinPuntos",
          ROUND(
            (COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' AND (PONTUACAO IS NULL OR PONTUACAO = 0) THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN QUALIDADE ILIKE 'PRIMEIRA%' THEN 1 END), 0)::numeric) * 100
          , 1) as "SinPuntosPct"
        FROM CAL
        GROUP BY "NombreArticulo", "PARTIDA"
      ),
      PartidaVars AS (
        SELECT
          C.*,
          C."PARTIDA" as "Var0",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 0
              THEN (left(C."PARTIDA", 1)::int - 1)::text || substring(C."PARTIDA" from 2)
          END as "Var1",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 1
              THEN (left(C."PARTIDA", 1)::int - 2)::text || substring(C."PARTIDA" from 2)
          END as "Var2",
          CASE
            WHEN length(C."PARTIDA") > 1 AND left(C."PARTIDA", 1) ~ '^[0-9]$' AND left(C."PARTIDA", 1)::int > 2
              THEN (left(C."PARTIDA", 1)::int - 3)::text || substring(C."PARTIDA" from 2)
          END as "Var3",
          CASE
            WHEN length(C."PARTIDA") > 1
              THEN '0' || substring(C."PARTIDA" from 2)
          END as "Var4"
        FROM CalidadPorPartida C
      ),
      TejPorPartida AS (
        SELECT
          PV."PARTIDA" as "CalPartida",
          TEJ.*
        FROM PartidaVars PV
        LEFT JOIN LATERAL (
          SELECT
            P."PARTIDA" as "PARTIDA",
            MAX(
              CASE
                WHEN right(P."MAQUINA", 2) ~ '^[0-9]{2}$' THEN right(P."MAQUINA", 2)::int
                ELSE NULL
              END
            ) as "Telar",
            SUM(COALESCE(${prodPtsLidosNum}, 0)) as "PtsLei",
            SUM(COALESCE(${prodPts100Num}, 0)) as "Pts100",
            SUM(COALESCE(${prodParTraNum}, 0)) as "ParTra",
            SUM(COALESCE(${prodParUrdNum}, 0)) as "ParUrd"
          FROM tb_produccion P
          WHERE
            P."FILIAL" = '05'
            AND P."SELETOR" = 'TECELAGEM'
            AND P."PARTIDA" IN (PV."Var0", PV."Var1", PV."Var2", PV."Var3", PV."Var4")
          GROUP BY P."PARTIDA"
          ORDER BY CASE P."PARTIDA"
            WHEN PV."Var0" THEN 0
            WHEN PV."Var1" THEN 1
            WHEN PV."Var2" THEN 2
            WHEN PV."Var3" THEN 3
            WHEN PV."Var4" THEN 4
            ELSE 9
          END ASC
          LIMIT 1
        ) TEJ ON true
      )
      SELECT
        HP."HoraInicio" as "HoraInicio",
        PV."NombreArticulo" as "NombreArticulo",
        PV."PARTIDA" as "PARTIDA",
        PV."Partidas" as "Partidas",
        PV."MetrosRevisados" as "MetrosRevisados",
        PV."CalidadPct" as "CalidadPct",
        PV."Pts100m2" as "Pts100m2",
        PV."TotalRollos" as "TotalRollos",
        PV."SinPuntos" as "SinPuntos",
        PV."SinPuntosPct" as "SinPuntosPct",
        COALESCE(TEJ."Telar", 0) as "Telar",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."PtsLei" / NULLIF(TEJ."Pts100", 0)) * 100, 1)
        END as "EficienciaPct",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParUrd" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END as "RU105",
        CASE
          WHEN TEJ."PtsLei" IS NULL OR TEJ."PtsLei" = 0 THEN NULL
          ELSE ROUND((TEJ."ParTra" * 100000)::numeric / NULLIF((TEJ."PtsLei" * 1000), 0)::numeric, 1)
        END as "RT105"
      FROM PartidaVars PV
      LEFT JOIN HorasPartida HP ON PV."PARTIDA" = HP.PARTIDA
      LEFT JOIN TejPorPartida TEJ ON TEJ."CalPartida" = PV."PARTIDA"
      ORDER BY HP."HoraInicio" ASC
    `

    const result = await query(sql, params, 'calidad/revisor-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/revisor-detalle ${startDate}..${endDate} revisor=${revisor} tramas=${tramas} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/revisor-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/partida-detalle - Detalle de defectos por partida
app.get('/api/produccion/calidad/partida-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha, partida, revisor } = req.query
    if (!fecha || !partida || !revisor) {
      return res.status(400).json({ error: 'Se requieren fecha, partida y revisor' })
    }

    const datProdDate = sqlParseDate('"DAT_PROD"')
    const metragemNum = sqlParseNumber('"METRAGEM"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')

    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DAT_PROD" as "DAT_PROD",
        "ARTIGO" as "ARTIGO",
        "COR" as "COR",
        "NM MERC" as "NM_MERC",
        "TRAMA" as "TRAMA",
        "GRP_DEF" as "GRP_DEF",
        "COD_DE" as "COD_DE",
        "DEFEITO" as "DEFEITO",
        ${metragemNum} as "METRAGEM",
        "QUALIDADE" as "QUALIDADE",
        "HORA" as "HORA",
        "EMENDAS" as "EMENDAS",
        "PEÇA" as "PEÇA",
        "ETIQUETA" as "ETIQUETA",
        ${larguraNum} as "LARGURA",
        ${pontuacaoNum} as "PONTUACAO"
      FROM tb_calidad
      WHERE
        "EMP" = 'STC'
        AND ("DAT_PROD" = ANY($1::text[]) OR ${datProdDate} = $2::date)
        AND "PARTIDA" = $3
        AND "REVISOR FINAL" = $4
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
      ORDER BY "HORA" ASC, "PEÇA" ASC
    `

    const result = await query(sql, [dateTextCandidates(fecha), variants.iso, partida, revisor], 'calidad/partida-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/partida-detalle fecha=${fecha} partida=${partida} revisor=${revisor} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/partida-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/defectos-detalle - Defectos por etiqueta (tb_defectos)
app.get('/api/produccion/calidad/defectos-detalle', async (req, res) => {
  try {
    const t0 = hrMs()
    const etiqueta = String(req.query.etiqueta || '').trim()
    if (!etiqueta) return res.status(400).json({ error: 'Se requiere la etiqueta' })

    const sql = `
      SELECT
        partida as "PARTIDA",
        peca as "PECA",
        etiqueta as "ETIQUETA",
        cod_def as "COD_DEF",
        desc_defeito as "DESC_DEFEITO",
        pontos as "PONTOS",
        qualidade as "QUALIDADE",
        data_prod as "DATA_PROD"
      FROM tb_defectos
      WHERE btrim(etiqueta) = $1
      ORDER BY peca ASC, cod_def ASC
    `

    const result = await query(sql, [etiqueta], 'calidad/defectos-detalle')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/defectos-detalle etiqueta=${etiqueta} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en calidad/defectos-detalle:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS - MESA DE TEST (AnalisisMesaTest.vue)
// =====================================================

// GET /api/produccion/calidad/articulos-mesa-test?fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
app.get('/api/produccion/calidad/articulos-mesa-test', async (req, res) => {
  try {
    const t0 = hrMs()
    const { fecha_inicial, fecha_final } = req.query

    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const startDate = String(fecha_inicial)
    const endDate = fecha_final ? String(fecha_final) : '2099-12-31'

    const calDatProdDate = sqlParseDate('"DAT_PROD"')
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')

    const testesDtProdDate = sqlParseDate('dt_prod')
    const testesMetragemNum = sqlParseNumberIntl('metragem')

    const sql = `
      WITH MetricasCalidad AS (
        SELECT
          "ARTIGO" AS ARTIGO,
          ROUND(SUM(COALESCE(${calMetragemNum}, 0)), 0)::int AS METROS_REV
        FROM tb_calidad
        WHERE
          "EMP" = 'STC'
          AND ${calDatProdDate} BETWEEN $1::date AND $2::date
          AND "TRAMA" IS NOT NULL
          AND btrim("TRAMA") <> ''
        GROUP BY "ARTIGO"
      ),
      MetricasTestesPartida AS (
        SELECT
          artigo AS ARTIGO,
          btrim(partida) AS PARTIDA,
          AVG(COALESCE(${testesMetragemNum}, 0)) AS METRAGEM_AVG
        FROM tb_testes
        WHERE
          ${testesDtProdDate} BETWEEN $1::date AND $2::date
        GROUP BY artigo, btrim(partida)
      ),
      MetricasTestes AS (
        SELECT
          ARTIGO,
          ROUND(SUM(METRAGEM_AVG), 0)::int AS METROS_TEST
        FROM MetricasTestesPartida
        GROUP BY ARTIGO
      ),
      AllArtigos AS (
        SELECT ARTIGO FROM MetricasCalidad
        UNION
        SELECT ARTIGO FROM MetricasTestes
      )
      SELECT
        AU.ARTIGO AS "ARTIGO_COMPLETO",
        substring(AU.ARTIGO from 1 for 10) AS "Articulo",
        substring(AU.ARTIGO from 7 for 2) AS "Id",
        F."COR" AS "Color",
        F."NOME DE MERCADO" AS "Nombre",
        F."TRAMA REDUZIDO" AS "Trama",
        F."PRODUCAO" AS "Prod",
        COALESCE(MT.METROS_TEST, 0) AS "Metros_TEST",
        COALESCE(MC.METROS_REV, 0) AS "Metros_REV"
      FROM AllArtigos AU
      LEFT JOIN MetricasTestes MT ON AU.ARTIGO = MT.ARTIGO
      LEFT JOIN MetricasCalidad MC ON AU.ARTIGO = MC.ARTIGO
      LEFT JOIN tb_fichas F ON AU.ARTIGO = F."ARTIGO CODIGO"
      WHERE F."TRAMA REDUZIDO" IS NOT NULL
      ORDER BY AU.ARTIGO;
    `

    const result = await query(sql, [startDate, endDate], 'calidad/articulos-mesa-test')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/articulos-mesa-test ${startDate}..${endDate} rows=${result.rows.length} total=${(hrMs() - t0).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en /calidad/articulos-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/calidad/analisis-mesa-test?articulo=XXX&fecha_inicial=YYYY-MM-DD&fecha_final=YYYY-MM-DD
app.get('/api/produccion/calidad/analisis-mesa-test', async (req, res) => {
  try {
    const t0 = hrMs()
    const { articulo, fecha_inicial, fecha_final } = req.query

    if (!articulo) {
      return res.status(400).json({ error: 'Parámetro "articulo" requerido' })
    }
    if (!fecha_inicial) {
      return res.status(400).json({ error: 'Parámetro "fecha_inicial" requerido' })
    }

    const articleCode = String(articulo)
    const startDate = String(fecha_inicial)
    const endDate = fecha_final ? String(fecha_final) : '2099-12-31'

    const testesDtProdDate = sqlParseDate('dt_prod')
    const calDatProdDate = sqlParseDate('"DAT_PROD"')

    const tMetragemNum = sqlParseNumberIntl('metragem')
    const tLargAlNum = sqlParseNumberIntl('larg_al')
    const tGramatNum = sqlParseNumberIntl('gramat')
    const tPotenNum = sqlParseNumberIntl('poten')
    const tEncUrdNum = sqlParseNumberIntl('"%_ENC_URD"')
    const tEncTramaNum = sqlParseNumberIntl('"%_ENC_TRAMA"')
    const tSk1Num = sqlParseNumberIntl('"%_SK1"')
    const tSk2Num = sqlParseNumberIntl('"%_SK2"')
    const tSk3Num = sqlParseNumberIntl('"%_SK3"')
    const tSk4Num = sqlParseNumberIntl('"%_SK4"')
    const tSkeNum = sqlParseNumberIntl('"%_SKE"')
    const tSttNum = sqlParseNumberIntl('"%_STT"')
    const tSkmNum = sqlParseNumberIntl('"%_SKM"')

    const cMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const cLarguraNum = sqlParseNumberIntl('"LARGURA"')
    const cGrm2Num = sqlParseNumberIntl('"GR/M2"')

    const fLargMinNum = sqlParseNumberIntl('"LARGURA MIN"')
    const fLargStdNum = sqlParseNumberIntl('"LARGURA"')
    const fLargMaxNum = sqlParseNumberIntl('"LARGURA MAX"')
    const fPesoM2Num = sqlParseNumberIntl('"Peso/m2"')
    const fEncAcabUrdNum = sqlParseNumberIntl('"ENC#ACAB URD"')
    const fSkewMinNum = sqlParseNumberIntl('"SKEW MIN"')
    const fSkewMaxNum = sqlParseNumberIntl('"SKEW MAX"')
    const fUrdMinNum = sqlParseNumberIntl('"URD#MIN"')
    const fUrdMaxNum = sqlParseNumberIntl('"URD#MAX"')
    const fTraMinNum = sqlParseNumberIntl('"TRAMA MIN"')
    const fTraMaxNum = sqlParseNumberIntl('"TRAMA MAX"')
    const fVarTrMinNum = sqlParseNumberIntl('"VAR STR#MIN TRAMA"')
    const fVarTrMaxNum = sqlParseNumberIntl('"VAR STR#MAX TRAMA"')
    const fVarUrMinNum = sqlParseNumberIntl('"VAR STR#MIN URD"')
    const fVarUrMaxNum = sqlParseNumberIntl('"VAR STR#MAX URD"')

    const sql = `
      WITH TESTES AS (
        SELECT
          maquina,
          artigo AS art_test,
          btrim(partida) AS partida,
          artigo AS testes,
          dt_prod,
          aprov,
          obs,
          reprocesso,
          ${tMetragemNum} AS metragem_num,
          ${tLargAlNum} AS larg_al_num,
          ${tGramatNum} AS gramat_num,
          ${tPotenNum} AS poten_num,
          ${tEncUrdNum} AS enc_urd_num,
          ${tEncTramaNum} AS enc_trama_num,
          ${tSk1Num} AS sk1_num,
          ${tSk2Num} AS sk2_num,
          ${tSk3Num} AS sk3_num,
          ${tSk4Num} AS sk4_num,
          ${tSkeNum} AS ske_num,
          ${tSttNum} AS stt_num,
          ${tSkmNum} AS skm_num
        FROM tb_testes
        WHERE
          artigo = $1
          AND ${testesDtProdDate} BETWEEN $2::date AND $3::date
      ),
      CALIDAD AS (
        SELECT
          MIN("DAT_PROD") AS dat_prod,
          "ARTIGO" AS art_cal,
          btrim("PARTIDA") AS partida,
          ROUND(SUM(COALESCE(${cMetragemNum}, 0)), 0) AS metragem,
          ROUND(AVG(COALESCE(${cLarguraNum}, 0)), 1) AS largura,
          ROUND(AVG(COALESCE(${cGrm2Num}, 0)), 1) AS grm2
        FROM tb_calidad
        WHERE
          "ARTIGO" = $1
          AND ${calDatProdDate} BETWEEN $2::date AND $3::date
        GROUP BY "ARTIGO", btrim("PARTIDA")
      ),
      TESTES_CALIDAD AS (
        SELECT
          T.*,
          C.dat_prod AS calidad_dat_prod,
          C.metragem AS calidad_metragem,
          C.largura AS calidad_largura,
          C.grm2 AS calidad_grm2
        FROM TESTES T
        LEFT JOIN CALIDAD C ON T.partida = C.partida
      ),
      ESPECIFICACION AS (
        SELECT
          "ARTIGO CODIGO",
          "TRAMA REDUZIDO" AS trama_reducido,
          ${fLargMinNum} AS largura_min_val,
          ${fLargStdNum} AS ancho,
          ${fLargMaxNum} AS largura_max_val,
          ${fPesoM2Num} AS peso_m2,
          ${fEncAcabUrdNum} AS enc_acab_urd,
          ${fSkewMinNum} AS skew_min,
          (${fSkewMinNum} + ${fSkewMaxNum}) / 2.0 AS skew_std,
          ${fSkewMaxNum} AS skew_max,
          ${fUrdMinNum} AS urd_min,
          (${fUrdMinNum} + ${fUrdMaxNum}) / 2.0 AS urd_std,
          ${fUrdMaxNum} AS urd_max,
          ${fTraMinNum} AS trama_min,
          (${fTraMinNum} + ${fTraMaxNum}) / 2.0 AS trama_std,
          ${fTraMaxNum} AS trama_max,
          ${fVarTrMinNum} AS var_str_min_trama,
          (${fVarTrMinNum} + ${fVarTrMaxNum}) / 2.0 AS var_str_std_trama,
          ${fVarTrMaxNum} AS var_str_max_trama,
          ${fVarUrMinNum} AS var_str_min_urd,
          (${fVarUrMinNum} + ${fVarUrMaxNum}) / 2.0 AS var_str_std_urd,
          ${fVarUrMaxNum} AS var_str_max_urd
        FROM tb_fichas
        WHERE "ARTIGO CODIGO" = $1
      )
      SELECT
        CASE WHEN TC.maquina ~ '^[0-9]+$' THEN TC.maquina::int ELSE NULL END AS "Maquina",
        TC.art_test AS "Articulo",
        E.trama_reducido AS "Trama",
        TC.partida AS "Partida",
        TC.testes AS "C",
        TC.dt_prod AS "Fecha",
        TC.aprov AS "Ap",
        TC.obs AS "Obs",
        TC.reprocesso AS "R",
        ROUND(TC.metragem_num, 0) AS "Metros_TEST",
        ROUND(TC.calidad_metragem, 0) AS "Metros_MESA",

        ROUND(TC.calidad_largura, 1) AS "Ancho_MESA",
        ROUND(
          CASE
            WHEN E.largura_min_val < (E.ancho * 0.5) THEN E.ancho - E.largura_min_val
            ELSE E.largura_min_val
          END
        , 1) AS "Ancho_MIN",
        ROUND(E.ancho, 1) AS "Ancho_STD",
        ROUND(
          CASE
            WHEN E.largura_max_val < (E.ancho * 0.5) THEN E.ancho + E.largura_max_val
            ELSE E.largura_max_val
          END
        , 1) AS "Ancho_MAX",
        ROUND(TC.larg_al_num, 1) AS "Ancho_TEST",

        ROUND(TC.calidad_grm2, 1) AS "Peso_MESA",
        ROUND(E.peso_m2 * 0.95, 1) AS "Peso_MIN",
        ROUND(E.peso_m2, 1) AS "Peso_STD",
        ROUND(E.peso_m2 * 1.05, 1) AS "Peso_MAX",
        ROUND(TC.gramat_num, 1) AS "Peso_TEST",

        ROUND(TC.poten_num, 2) AS "Potencial",
        ROUND(E.enc_acab_urd, 2) AS "Potencial_STD",

        ROUND(TC.enc_urd_num, 2) AS "ENC_URD_%",
        ROUND(E.urd_min, 2) AS "ENC_URD_MIN_%",
        ROUND(E.urd_std, 2) AS "ENC_URD_STD_%",
        ROUND(E.urd_max, 2) AS "ENC_URD_MAX_%",
        -1.5::numeric AS "%_ENC_URD_MIN_Meta",
        -1.0::numeric AS "%_ENC_URD_MAX_Meta",

        ROUND(TC.enc_trama_num, 2) AS "ENC_TRA_%",
        ROUND(E.trama_min, 2) AS "ENC_TRA_MIN_%",
        ROUND(E.trama_std, 2) AS "ENC_TRA_STD_%",
        ROUND(E.trama_max, 2) AS "ENC_TRA_MAX_%",

        ROUND(TC.sk1_num, 2) AS "%_SK1",
        ROUND(TC.sk2_num, 2) AS "%_SK2",
        ROUND(TC.sk3_num, 2) AS "%_SK3",
        ROUND(TC.sk4_num, 2) AS "%_SK4",
        ROUND(TC.ske_num, 2) AS "%_SKE",

        ROUND(E.skew_min, 2) AS "Skew_MIN",
        ROUND(E.skew_std, 2) AS "Skew_STD",
        ROUND(E.skew_max, 2) AS "Skew_MAX",

        ROUND(TC.stt_num, 3) AS "%_STT",
        ROUND(E.var_str_min_trama, 3) AS "%_STT_MIN",
        ROUND(E.var_str_std_trama, 3) AS "%_STT_STD",
        ROUND(E.var_str_max_trama, 3) AS "%_STT_MAX",

        ROUND(TC.skm_num, 2) AS "Pasadas_Terminadas",
        ROUND(E.var_str_min_urd, 2) AS "Pasadas_MIN",
        ROUND(E.var_str_std_urd, 2) AS "Pasadas_STD",
        ROUND(E.var_str_max_urd, 2) AS "Pasadas_MAX",

        ROUND(TC.calidad_grm2 * 0.0295, 1) AS "Peso_MESA_OzYd²",
        ROUND(E.peso_m2 * 0.95 * 0.0295, 1) AS "Peso_MIN_OzYd²",
        ROUND(E.peso_m2 * 0.0295, 1) AS "Peso_STD_OzYd²",
        ROUND(E.peso_m2 * 1.05 * 0.0295, 1) AS "Peso_MAX_OzYd²"
      FROM TESTES_CALIDAD TC
      LEFT JOIN ESPECIFICACION E ON TC.art_test = E."ARTIGO CODIGO"
      ORDER BY ${sqlParseDate('TC.dt_prod')} ASC;
    `

    const result = await query(sql, [articleCode, startDate, endDate], 'calidad/analisis-mesa-test')
    res.json(result.rows)
    console.log(
      `[PERF] GET /calidad/analisis-mesa-test articulo=${articleCode} ${startDate}..${endDate} rows=${result.rows.length} total=${(
        hrMs() - t0
      ).toFixed(1)}ms`
    )
  } catch (err) {
    console.error('Error en /calidad/analisis-mesa-test:', err)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// ENDPOINTS CALIDAD/PRODUCCION (Calidad Sectores)
// =====================================================

// GET /api/calidad/available-dates - Fechas disponibles en tb_calidad
app.get('/api/calidad/available-dates', async (req, res) => {
  try {
    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const sql = `
      SELECT DISTINCT
        to_char(${datProdDate}, 'YYYY-MM-DD') AS fecha,
        to_char(${datProdDate}, 'YYYY') AS year,
        to_char(${datProdDate}, 'MM') AS month,
        to_char(${datProdDate}, 'DD') AS day
      FROM tb_calidad c
      WHERE c."DAT_PROD" IS NOT NULL
        AND c."DAT_PROD" <> ''
        AND ${datProdDate} IS NOT NULL
      ORDER BY fecha DESC
    `

    const result = await query(sql, [], 'calidad/available-dates')
    const rows = result.rows || []

    const dateStructure = { years: {}, minDate: null, maxDate: null }
    if (rows.length > 0) {
      dateStructure.minDate = rows[rows.length - 1].fecha
      dateStructure.maxDate = rows[0].fecha
      for (const row of rows) {
        const { year, month, day, fecha } = row
        if (!dateStructure.years[year]) dateStructure.years[year] = {}
        if (!dateStructure.years[year][month]) dateStructure.years[year][month] = []
        dateStructure.years[year][month].push({ day, fecha })
      }
    }

    res.json(dateStructure)
  } catch (err) {
    console.error('Error en /api/calidad/available-dates:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/calidad/sectores-resumen - Metros revisados por sector
app.get('/api/calidad/sectores-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('c."METRAGEM"')

    const sql = `
      WITH sectores(sector, nro, meta_pct) AS (
        VALUES
          ('S/ Def.', 1, 95.5),
          ('FIACAO', 2, 0.15),
          ('INDIGO', 3, 1.4),
          ('TECELAGEM', 4, 2.5),
          ('ACABMTO', 5, 0.3),
          ('GERAL', 6, 0.15)
      ),
      calidad_dia AS (
        SELECT
          c."GRP_DEF" AS sector,
          SUM(${metragemNum}) AS metros
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${datProdDate} = $1::date
        GROUP BY c."GRP_DEF"
      ),
      calidad_mes AS (
        SELECT
          c."GRP_DEF" AS sector,
          SUM(${metragemNum}) AS metros
        FROM tb_calidad c
        WHERE c."EMP" = 'STC'
          AND ${datProdDate} >= $2::date
          AND ${datProdDate} <= $3::date
        GROUP BY c."GRP_DEF"
      )
      SELECT
        s.sector AS "SECTOR",
        COALESCE(d.metros, 0) AS "metrosDia",
        COALESCE(m.metros, 0) AS "metrosMes",
        s.meta_pct AS "metaPct"
      FROM sectores s
      LEFT JOIN calidad_dia d ON s.sector = d.sector
      LEFT JOIN calidad_mes m ON s.sector = m.sector
      ORDER BY s.nro
    `

    const result = await query(sql, [datePattern, mesInicio, mesFin], 'calidad/sectores-resumen')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/calidad/sectores-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metas/resumen/:fecha - Meta del dia y acumulado del mes
app.get('/api/metas/resumen/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params
    if (!fecha) {
      return res.status(400).json({ error: 'Se requiere parámetro "fecha" (YYYY-MM-DD)' })
    }

    const datePattern = String(fecha).split('T')[0]
    const [year, month] = datePattern.split('-')
    const monthStart = `${year}-${month}-01`

    const metasExists = await tableExists('tb_metas')
    if (!metasExists) {
      return res.json({ day: 0, month: 0, fecha: datePattern })
    }

    const metaDia = await query(
      `SELECT
         COALESCE(fiacao_meta, 0)
       + COALESCE(indigo_meta, 0)
       + COALESCE(tecelagem_meta, 0)
       + COALESCE(acabamento_meta, 0) AS total
       FROM tb_metas WHERE fecha = $1`,
      [datePattern],
      'metas/resumen-dia'
    )
    const metaMes = await query(
      `SELECT
         SUM(
           COALESCE(fiacao_meta, 0)
         + COALESCE(indigo_meta, 0)
         + COALESCE(tecelagem_meta, 0)
         + COALESCE(acabamento_meta, 0)
         ) AS total
       FROM tb_metas WHERE fecha >= $1 AND fecha <= $2`,
      [monthStart, datePattern],
      'metas/resumen-mes'
    )

    res.json({
      day: Number(metaDia.rows?.[0]?.total || 0),
      month: Number(metaMes.rows?.[0]?.total || 0),
      fecha: datePattern
    })
  } catch (err) {
    console.error('Error en /api/metas/resumen/:fecha:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/calidad/pts100m2 - Puntos por 100m2
app.get('/api/calidad/pts100m2', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const datProdDate = sqlParseDate('c."DAT_PROD"')
    const metragemNum = sqlParseNumberIntl('c."METRAGEM"')
    const pontuacaoNum = sqlParseNumberIntl('c."PONTUACAO"')
    const larguraNum = sqlParseNumberIntl('c."LARGURA"')

    const sqlDia = `
      WITH pts AS (
        SELECT
          dat_prod,
          SUM(pontuacao_avg) AS pontuacao
        FROM (
          SELECT
            c."EMP",
            ${datProdDate} AS dat_prod,
            btrim(c."QUALIDADE") AS qualidade,
            c."PEÇA" AS peca,
            AVG(${pontuacaoNum}) AS pontuacao_avg
          FROM tb_calidad c
          WHERE ${datProdDate} = $1::date
            AND btrim(c."QUALIDADE") = 'PRIMEIRA'
          GROUP BY c."EMP", ${datProdDate}, btrim(c."QUALIDADE"), c."PEÇA"
        ) sub
        GROUP BY dat_prod
      ),
      ancho AS (
        SELECT
          ${datProdDate} AS fecha,
          SUM(${metragemNum}) AS metros,
          SUM(${metragemNum} * ${larguraNum}) / NULLIF(SUM(${metragemNum}), 0) AS ancho_pond
        FROM tb_calidad c
        WHERE ${datProdDate} = $1::date
          AND btrim(c."QUALIDADE") = 'PRIMEIRA'
        GROUP BY ${datProdDate}
      )
      SELECT
        CASE
          WHEN ancho.metros > 0 AND ancho.ancho_pond > 0 THEN
            (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0
        END AS pts1002
      FROM ancho
      LEFT JOIN pts ON ancho.fecha = pts.dat_prod
    `

    const sqlMes = `
      WITH pts AS (
        SELECT
          SUM(pontuacao_avg) AS pontuacao
        FROM (
          SELECT
            c."EMP",
            ${datProdDate} AS dat_prod,
            btrim(c."QUALIDADE") AS qualidade,
            c."PEÇA" AS peca,
            AVG(${pontuacaoNum}) AS pontuacao_avg
          FROM tb_calidad c
          WHERE ${datProdDate} >= $1::date
            AND ${datProdDate} <= $2::date
            AND btrim(c."QUALIDADE") = 'PRIMEIRA'
          GROUP BY c."EMP", ${datProdDate}, btrim(c."QUALIDADE"), c."PEÇA"
        ) sub
      ),
      ancho AS (
        SELECT
          SUM(${metragemNum}) AS metros,
          SUM(${metragemNum} * ${larguraNum}) / NULLIF(SUM(${metragemNum}), 0) AS ancho_pond
        FROM tb_calidad c
        WHERE ${datProdDate} >= $1::date
          AND ${datProdDate} <= $2::date
          AND btrim(c."QUALIDADE") = 'PRIMEIRA'
      )
      SELECT
        CASE
          WHEN ancho.metros > 0 AND ancho.ancho_pond > 0 THEN
            (pts.pontuacao * 100) / (ancho.metros * ancho.ancho_pond) * 100
          ELSE 0
        END AS pts1002
      FROM ancho, pts
    `

    const resultDia = await query(sqlDia, [datePattern], 'calidad/pts100m2-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'calidad/pts100m2-mes')

    res.json({
      day: Number(resultDia.rows?.[0]?.pts1002 || 0),
      month: Number(resultMes.rows?.[0]?.pts1002 || 0),
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/calidad/pts100m2:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/indigo-resumen
app.get('/api/produccion/indigo-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const rupturasNum = sqlParseNumberIntl('p."RUPTURAS"')

    const sqlDia = `
      SELECT
        COALESCE(SUM(${metragemNum}), 0) AS metros,
        CASE
          WHEN SUM(${metragemNum}) > 0 THEN SUM(${rupturasNum}) * 1000 / NULLIF(SUM(${metragemNum}), 0)
          ELSE 0
        END AS rot_103
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."SELETOR" = 'INDIGO'
    `

    const sqlMes = `
      SELECT
        COALESCE(SUM(${metragemNum}), 0) AS metros,
        CASE
          WHEN SUM(${metragemNum}) > 0 THEN SUM(${rupturasNum}) * 1000 / NULLIF(SUM(${metragemNum}), 0)
          ELSE 0
        END AS rot_103
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."SELETOR" = 'INDIGO'
    `

    const resultDia = await query(sqlDia, [datePattern], 'produccion/indigo-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'produccion/indigo-mes')

    let metaDia = 0
    let metaMes = 0
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        'SELECT indigo_meta FROM tb_metas WHERE fecha = $1',
        [datePattern],
        'metas/indigo-dia'
      )
      const metaMesRes = await query(
        'SELECT SUM(indigo_meta) AS total FROM tb_metas WHERE fecha >= $1 AND fecha <= $2',
        [mesInicio, mesFin],
        'metas/indigo-mes'
      )
      metaDia = Number(metaDiaRes.rows?.[0]?.indigo_meta || 0)
      metaMes = Number(metaMesRes.rows?.[0]?.total || 0)
    }

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        rot103: Number(resultDia.rows?.[0]?.rot_103 || 0),
        meta: metaDia
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        rot103: Number(resultMes.rows?.[0]?.rot_103 || 0),
        metaAcumulada: metaMes
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/indigo-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/estopa-azul
app.get('/api/produccion/estopa-azul', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtMovDate = sqlParseDate('r."DT_MOV"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const pesoMantaNum = sqlParseNumberIntl('f."CONS#URD/m"')
    const estopaKgNum = sqlParseNumberIntl('r."PESO LIQUIDO (KG)"')

    const sqlDia = `
      WITH bases AS (
        SELECT DISTINCT
          f."URDUME" AS artigo,
          ${pesoMantaNum} AS peso_manta
        FROM tb_fichas f
        WHERE f."URDUME" IS NOT NULL
          AND f."URDUME" <> ''
          AND f."CONS#URD/m" IS NOT NULL
          AND f."CONS#URD/m" <> ''
          AND f."CONS#URD/m" <> '0'
          AND f."CONS#URD/m" <> '0,00'
      ),
      metros_base AS (
        SELECT
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metros
        FROM tb_produccion p
        WHERE ${dtBaseDate} = $1::date
          AND p."SELETOR" = 'INDIGO'
        GROUP BY p."BASE URDUME"
      ),
      peso_dia AS (
        SELECT
          SUM(mb.metros * COALESCE(b.peso_manta, 0)) / 1000 * 0.98 AS suma_producto
        FROM metros_base mb
        LEFT JOIN bases b ON mb.base = b.artigo
      ),
      estopa_azul AS (
        SELECT
          SUM(${estopaKgNum}) AS estopa
        FROM tb_residuos_indigo r
        WHERE ${dtMovDate} = $2::date
          AND r."SUBPRODUTO" = '1746437'
      )
      SELECT
        ea.estopa,
        pd.suma_producto,
        CASE WHEN pd.suma_producto > 0 THEN (ea.estopa / pd.suma_producto) * 100 ELSE 0 END AS porcentaje
      FROM peso_dia pd, estopa_azul ea
    `

    const sqlMes = `
      WITH bases AS (
        SELECT DISTINCT
          f."URDUME" AS artigo,
          ${pesoMantaNum} AS peso_manta
        FROM tb_fichas f
        WHERE f."URDUME" IS NOT NULL
          AND f."URDUME" <> ''
          AND f."CONS#URD/m" IS NOT NULL
          AND f."CONS#URD/m" <> ''
          AND f."CONS#URD/m" <> '0'
          AND f."CONS#URD/m" <> '0,00'
      ),
      metros_base AS (
        SELECT
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metros
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'INDIGO'
        GROUP BY p."BASE URDUME"
      ),
      peso_mes AS (
        SELECT
          SUM(mb.metros * COALESCE(b.peso_manta, 0)) / 1000 * 0.98 AS suma_producto
        FROM metros_base mb
        LEFT JOIN bases b ON mb.base = b.artigo
      ),
      estopa_azul AS (
        SELECT
          SUM(${estopaKgNum}) AS estopa
        FROM tb_residuos_indigo r
        WHERE ${dtMovDate} >= $3::date
          AND ${dtMovDate} <= $4::date
          AND r."SUBPRODUTO" = '1746437'
      )
      SELECT
        ea.estopa,
        pm.suma_producto,
        CASE WHEN pm.suma_producto > 0 THEN (ea.estopa / pm.suma_producto) * 100 ELSE 0 END AS porcentaje
      FROM peso_mes pm, estopa_azul ea
    `

    const resultDia = await query(sqlDia, [datePattern, datePattern], 'produccion/estopa-azul-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin, mesInicio, mesFin], 'produccion/estopa-azul-mes')

    res.json({
      day: {
        estopaKg: Number(resultDia.rows?.[0]?.estopa || 0),
        pesoProducto: Number(resultDia.rows?.[0]?.suma_producto || 0),
        porcentaje: Number(resultDia.rows?.[0]?.porcentaje || 0)
      },
      month: {
        estopaKg: Number(resultMes.rows?.[0]?.estopa || 0),
        pesoProducto: Number(resultMes.rows?.[0]?.suma_producto || 0),
        porcentaje: Number(resultMes.rows?.[0]?.porcentaje || 0)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/estopa-azul:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/tecelagem-resumen
app.get('/api/produccion/tecelagem-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const metragemEncNum = sqlParseNumberIntl('p."METRAGEM ENCOLH"')
    const paradaTramaNum = sqlParseNumberIntl('p."PARADA TEC TRAMA"')
    const paradaUrdNum = sqlParseNumberIntl('p."PARADA TEC URDUME"')
    const pontosLidosNum = sqlParseNumberIntl('p."PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('p."PONTOS_100%"')

    const sqlDia = `
      SELECT
        COALESCE(SUM(${metragemEncNum}), 0) AS metros,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaTramaNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_tra_105,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaUrdNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_urd_105,
        CASE
          WHEN SUM(${pontos100Num}) > 0 THEN SUM(${pontosLidosNum}) * 100.0 / SUM(${pontos100Num})
          ELSE 0
        END AS eficiencia
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."SELETOR" = 'TECELAGEM'
    `

    const sqlMes = `
      SELECT
        COALESCE(SUM(${metragemEncNum}), 0) AS metros,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaTramaNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_tra_105,
        CASE
          WHEN SUM(${pontosLidosNum}) > 0 THEN SUM(${paradaUrdNum}) * 100000.0 /
            (SUM(${pontosLidosNum}) * 1000)
          ELSE 0
        END AS rot_urd_105,
        CASE
          WHEN SUM(${pontos100Num}) > 0 THEN SUM(${pontosLidosNum}) * 100.0 / SUM(${pontos100Num})
          ELSE 0
        END AS eficiencia
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."SELETOR" = 'TECELAGEM'
    `

    const resultDia = await query(sqlDia, [datePattern], 'produccion/tecelagem-dia')
    const resultMes = await query(sqlMes, [mesInicio, mesFin], 'produccion/tecelagem-mes')

    let metaDia = {}
    let metaMes = {}
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        `SELECT tecelagem_meta AS meta_dia, tecelagem_enc_urd AS meta_enc_urd
         FROM tb_metas WHERE fecha = $1`,
        [datePattern],
        'metas/tecelagem-dia'
      )
      const metaMesRes = await query(
        `SELECT SUM(tecelagem_meta) AS meta_acumulada,
                AVG(tecelagem_enc_urd) AS meta_enc_urd
         FROM tb_metas WHERE fecha >= $1 AND fecha <= $2`,
        [mesInicio, mesFin],
        'metas/tecelagem-mes'
      )
      metaDia = metaDiaRes.rows?.[0] || {}
      metaMes = metaMesRes.rows?.[0] || {}
    }

    // Estopa azul tejeduria (residuos por sector)
    const dtMovDate = sqlParseDate('r."DT_MOV"')
    const pesoMantaNum = sqlParseNumberIntl('f."CONS#URD/m"')
    const encUrdNum = sqlParseNumberIntl('f."ENC#TEC#URDUME"')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const estopaKgNum = sqlParseNumberIntl('r."PESO LIQUIDO (KG)"')

    const sqlEstopaDiaPeso = `
      WITH tej AS (
        SELECT
          p."ARTIGO" AS articulo,
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metragem
        FROM tb_produccion p
        WHERE ${dtBaseDate} = $1::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY p."ARTIGO", p."BASE URDUME"
      ),
      fic AS (
        SELECT
          f."ARTIGO CODIGO" AS articulo,
          ${pesoMantaNum} AS peso_manta,
          ${encUrdNum} AS enc_urd
        FROM tb_fichas f
        WHERE f."ARTIGO CODIGO" IS NOT NULL AND f."ARTIGO CODIGO" <> ''
      )
      SELECT
        SUM(tej.metragem * ((100 + COALESCE(fic.enc_urd, 0)) / 100) * (COALESCE(fic.peso_manta, 0) / 1000)) AS peso_urd
      FROM tej
      LEFT JOIN fic ON tej.articulo = fic.articulo
    `

    const sqlEstopaDiaResiduo = `
      SELECT SUM(${estopaKgNum}) AS estopa
      FROM tb_residuos_por_sector r
      WHERE ${dtMovDate} = $1::date
        AND r."SUBPRODUTO" = '1785582'
    `

    const sqlEstopaMesPeso = `
      WITH tej AS (
        SELECT
          p."ARTIGO" AS articulo,
          p."BASE URDUME" AS base,
          SUM(${metragemNum}) AS metragem
        FROM tb_produccion p
        WHERE ${dtBaseDate} >= $1::date
          AND ${dtBaseDate} <= $2::date
          AND p."SELETOR" = 'TECELAGEM'
        GROUP BY p."ARTIGO", p."BASE URDUME"
      ),
      fic AS (
        SELECT
          f."ARTIGO CODIGO" AS articulo,
          ${pesoMantaNum} AS peso_manta,
          ${encUrdNum} AS enc_urd
        FROM tb_fichas f
        WHERE f."ARTIGO CODIGO" IS NOT NULL AND f."ARTIGO CODIGO" <> ''
      )
      SELECT
        SUM(tej.metragem * ((100 + COALESCE(fic.enc_urd, 0)) / 100) * (COALESCE(fic.peso_manta, 0) / 1000)) AS peso_urd
      FROM tej
      LEFT JOIN fic ON tej.articulo = fic.articulo
    `

    const sqlEstopaMesResiduo = `
      SELECT SUM(${estopaKgNum}) AS estopa
      FROM tb_residuos_por_sector r
      WHERE ${dtMovDate} >= $1::date
        AND ${dtMovDate} <= $2::date
        AND r."SUBPRODUTO" = '1785582'
    `

    let pesoProductoDia = 0
    let pesoProductoMes = 0
    let estopaDia = 0
    let estopaMes = 0

    try {
      const estopaDiaPeso = await query(sqlEstopaDiaPeso, [datePattern], 'tecelagem/estopa-peso-dia')
      const estopaDiaRes = await query(sqlEstopaDiaResiduo, [datePattern], 'tecelagem/estopa-residuo-dia')
      const estopaMesPeso = await query(sqlEstopaMesPeso, [mesInicio, mesFin], 'tecelagem/estopa-peso-mes')
      const estopaMesRes = await query(sqlEstopaMesResiduo, [mesInicio, mesFin], 'tecelagem/estopa-residuo-mes')

      pesoProductoDia = Number(estopaDiaPeso.rows?.[0]?.peso_urd || 0)
      pesoProductoMes = Number(estopaMesPeso.rows?.[0]?.peso_urd || 0)
      estopaDia = Number(estopaDiaRes.rows?.[0]?.estopa || 0)
      estopaMes = Number(estopaMesRes.rows?.[0]?.estopa || 0)
    } catch (err) {
      console.warn('No se pudo calcular estopa azul tejeduria:', err.message)
    }

    const estopaAzulPctDia = pesoProductoDia > 0 ? (estopaDia / pesoProductoDia) * 100 : 0
    const estopaAzulPctMes = pesoProductoMes > 0 ? (estopaMes / pesoProductoMes) * 100 : 0

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        eficiencia: Number(resultDia.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultDia.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultDia.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctDia,
        meta: Number(metaDia.meta_dia || 0),
        metaEfi: 0,
        metaRt105: 0,
        metaRu105: 0,
        metaEstopaAzul: 0
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        eficiencia: Number(resultMes.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultMes.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultMes.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctMes,
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEfi: 0,
        metaRt105: 0,
        metaRu105: 0,
        metaEstopaAzul: 0
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/tecelagem-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/acabamento-resumen
app.get('/api/produccion/acabamento-resumen', async (req, res) => {
  try {
    const { date, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const mesInicio = monthStart || `${year}-${month}-01`
    const mesFin = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const dtProdDate = sqlParseDate('t.dt_prod')
    const metragemNum = sqlParseNumberIntl('p."METRAGEM"')
    const testeMetragemNum = sqlParseNumberIntl('t.metragem')
    const encUrdNum = sqlParseNumberIntl('t."%_ENC_URD"')

    const sqlMetrosDia = `
      SELECT COALESCE(SUM(${metragemNum}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtBaseDate} = $1::date
        AND p."MAQUINA" = '165001'
    `
    const sqlMetrosMes = `
      SELECT COALESCE(SUM(${metragemNum}), 0) AS metros
      FROM tb_produccion p
      WHERE ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."MAQUINA" = '165001'
    `

    const sqlEncUrdDia = `
      SELECT
        CASE
          WHEN SUM(${testeMetragemNum}) > 0 THEN
            SUM(${testeMetragemNum} * ${encUrdNum}) / SUM(${testeMetragemNum})
          ELSE 0
        END AS enc_urd_pct
      FROM tb_testes t
      WHERE ${dtProdDate} = $1::date
        AND t.maquina = '165001'
        AND t.aprov = 'A'
    `
    const sqlEncUrdMes = `
      SELECT
        CASE
          WHEN SUM(${testeMetragemNum}) > 0 THEN
            SUM(${testeMetragemNum} * ${encUrdNum}) / SUM(${testeMetragemNum})
          ELSE 0
        END AS enc_urd_pct
      FROM tb_testes t
      WHERE ${dtProdDate} >= $1::date
        AND ${dtProdDate} <= $2::date
        AND t.maquina = '165001'
        AND t.aprov = 'A'
    `

    const resultMetrosDia = await query(sqlMetrosDia, [datePattern], 'acabamento/metros-dia')
    const resultMetrosMes = await query(sqlMetrosMes, [mesInicio, mesFin], 'acabamento/metros-mes')
    const resultEncUrdDia = await query(sqlEncUrdDia, [datePattern], 'acabamento/enc-urd-dia')
    const resultEncUrdMes = await query(sqlEncUrdMes, [mesInicio, mesFin], 'acabamento/enc-urd-mes')

    let metaDia = {}
    let metaMes = {}
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        `SELECT acabamento_meta AS meta_dia, acabamento_enc_urd AS meta_enc_urd FROM tb_metas WHERE fecha = $1`,
        [datePattern],
        'metas/acabamento-dia'
      )
      const metaMesRes = await query(
        `SELECT SUM(acabamento_meta) AS meta_acumulada, AVG(acabamento_enc_urd) AS meta_enc_urd
         FROM tb_metas WHERE fecha >= $1 AND fecha <= $2`,
        [mesInicio, mesFin],
        'metas/acabamento-mes'
      )
      metaDia = metaDiaRes.rows?.[0] || {}
      metaMes = metaMesRes.rows?.[0] || {}
    }

    res.json({
      day: {
        metros: Number(resultMetrosDia.rows?.[0]?.metros || 0),
        encUrdPct: Number(resultEncUrdDia.rows?.[0]?.enc_urd_pct || 0),
        meta: Number(metaDia.meta_dia || 0),
        metaEncUrd: Number(metaDia.meta_enc_urd || -1.5)
      },
      month: {
        metros: Number(resultMetrosMes.rows?.[0]?.metros || 0),
        encUrdPct: Number(resultEncUrdMes.rows?.[0]?.enc_urd_pct || 0),
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEncUrd: Number(metaMes.meta_enc_urd || -1.5)
      },
      date: datePattern
    })
  } catch (err) {
    console.error('Error en /api/produccion/acabamento-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/produccion/eficiencia-roturas
app.get('/api/produccion/eficiencia-roturas', async (req, res) => {
  try {
    const { date, trama, monthStart, monthEnd } = req.query
    if (!date) {
      return res.status(400).json({ error: 'Se requiere parámetro "date" (YYYY-MM-DD)' })
    }

    const datePattern = String(date).split('T')[0]
    const [year, month] = datePattern.split('-')
    const startDate = monthStart || `${year}-${month}-01`
    const endDate = monthEnd || datePattern

    const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"')
    const pontosLidosNum = sqlParseNumberIntl('p."PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('p."PONTOS_100%"')
    const paradaTramaNum = sqlParseNumberIntl('p."PARADA TEC TRAMA"')

    const tramaFilter = trama ? 'AND p."TRAMA REDUZIDA 1" = $3' : ''
    const params = trama ? [startDate, endDate, trama] : [startDate, endDate]

    const sql = `
      SELECT
        to_char(${dtBaseDate}, 'YYYY-MM-DD') AS fecha,
        p."TRAMA REDUZIDA 1" AS trama,
        ROUND((SUM(COALESCE(${pontosLidosNum}, 0)) * 100.0) / NULLIF(SUM(COALESCE(${pontos100Num}, 0)), 0), 1) AS eficiencia,
        ROUND((SUM(COALESCE(${paradaTramaNum}, 0)) * 100000.0) / NULLIF((SUM(COALESCE(${pontosLidosNum}, 0)) * 1000), 0), 1) AS rt105
      FROM tb_produccion p
      WHERE p."FILIAL" = '05'
        AND p."SELETOR" = 'TECELAGEM'
        AND ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        ${tramaFilter}
      GROUP BY fecha, p."TRAMA REDUZIDA 1"
      ORDER BY fecha ASC
    `

    const result = await query(sql, params, 'produccion/eficiencia-roturas')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en /api/produccion/eficiencia-roturas:', err)
    res.status(500).json({ error: err.message })
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
    console.error('❌ Error en /api/uster/status:', err.message)
    // Devolver array vacío en lugar de error para no romper la UI
    res.json({ existing: [] })
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
      SELECT testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, laborant 
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
      INSERT INTO tb_tensorapid_par (testnr, ne_titulo, titulo, comment_text, long_prueba, time_stamp, lote, ne_titulo_type, uster_testnr, laborant)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) 
      ON CONFLICT (testnr) DO UPDATE SET 
        ne_titulo=EXCLUDED.ne_titulo, 
        titulo=EXCLUDED.titulo, 
        comment_text=EXCLUDED.comment_text, 
        long_prueba=EXCLUDED.long_prueba, 
        time_stamp=EXCLUDED.time_stamp, 
        lote=EXCLUDED.lote, 
        ne_titulo_type=EXCLUDED.ne_titulo_type,
        uster_testnr=EXCLUDED.uster_testnr,
        laborant=EXCLUDED.laborant
    `, [par.TESTNR, par.NE_TITULO, par.TITULO, par.COMMENT_TEXT, par.LONG_PRUEBA, par.TIME_STAMP, par.LOTE, par.NE_TITULO_TYPE, par.USTER_TESTNR, par.LABORANT])
    
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
// ENDPOINTS PRODUCCION (Sistema de importación CSV)
// =====================================================

// PRODUCCION: Import status (estado de todos los CSVs)
app.get('/api/produccion/import-status', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromReq(req)
    const status = await getImportStatus(pool, csvFolder)
    res.json(status)
  } catch (err) {
    console.error('Error en import-status:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: DB status (información básica de la base de datos)
app.get('/api/produccion/status', async (req, res) => {
  try {
    // Obtener tamaño de la base de datos
    const sizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) / (1024 * 1024) as size_mb
    `)
    
    res.json({
      database: process.env.PG_DATABASE || 'stc_produccion',
      sizeMB: Math.round(sizeResult.rows[0].size_mb),
      sizeFormatted: sizeResult.rows[0].size,
      connected: true
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar tablas específicas desactualizadas (llamado por botón "Actualizar")
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/update-outdated', async (req, res) => {
  try {
    const { tables, csvFolder } = req.body
    
    if (!tables || !Array.isArray(tables)) {
      return res.status(400).json({ error: 'Se requiere un array de nombres de tablas' })
    }
    
    const csvPath = sanitizeCsvFolder(csvFolder) || resolveCsvFolderFromBody(req)
    console.log(`[IMPORT] Importando tablas específicas: ${tables.join(', ')}`)
    
    const results = await importSpecificTables(pool, tables, csvPath)
    
    res.json({ 
      success: true,
      results 
    })
  } catch (err) {
    console.error('Error en update-outdated:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Forzar importación de una tabla específica (ignora estado)
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/force-table', async (req, res) => {
  try {
    const { table, csvPath: csvPathRaw, csvFolder } = req.body
    
    if (!table) {
      return res.status(400).json({ error: 'Se requiere el nombre de la tabla' })
    }
    
    let csvPath = csvPathRaw
    if (!csvPath) {
      // Compatibilidad con la UI: envía { table, csvFolder }
      const folder = sanitizeCsvFolder(csvFolder) || resolveCsvFolderFromBody(req)
      const status = await getImportStatus(pool, folder)
      const match = status.find(s => s.table === table)
      csvPath = match?.csvPath
    }

    if (!csvPath) {
      return res.status(400).json({ error: 'No se pudo resolver csvPath para la tabla solicitada' })
    }

    console.log(`[IMPORT] Forzando importación de ${table} desde ${csvPath}`)

    const result = await importCSV(pool, table, csvPath)
    
    res.json(result)
  } catch (err) {
    console.error(`Error forzando importación:`, err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar todos los CSVs desactualizados
app.post('/api/produccion/import-all', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromBody(req)
    const results = await importAll(pool, csvFolder)
    res.json({ results })
  } catch (err) {
    console.error('Error en import-all:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Forzar importación de TODAS las tablas (botón "Forzar")
// IMPORTANTE: Esta ruta debe estar ANTES de /import/:table para que Express no la confunda
app.post('/api/produccion/import/force-all', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromBody(req)
    console.log(`[IMPORT] Forzando importación de todas las tablas desde ${csvFolder}`)

    const results = await importForceAll(pool, csvFolder)
    const errors = results.filter((r) => r && r.success === false)

    res.json({
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: results.length,
        successful: results.length - errors.length,
        failed: errors.length
      }
    })
  } catch (err) {
    console.error('Error en force-all:', err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Column warnings (devuelve lista vacía - funcionalidad opcional)
app.get('/api/produccion/import/column-warnings', async (req, res) => {
  try {
    const csvFolder = resolveCsvFolderFromReq(req)

    await ensureSyncHistoryTables()

    const status = await getImportStatus(pool, csvFolder)
    const client = await pool.connect()

    try {
      const warnings = []
      const nowIso = new Date().toISOString()

      for (const item of status) {
        if (!item?.csvPath) continue
        if (item.status === 'MISSING_FILE' || item.status === 'ERROR') continue
        if (!fs.existsSync(item.csvPath)) continue

        let rawLine
        try {
          rawLine = readCsvHeaderLine(item.csvPath)
        } catch (e) {
          console.warn(`[WARNINGS] No se pudo leer header de ${item.csvPath}: ${e.message}`)
          continue
        }

        const rawHeaders = rawLine.split(',')
        const csvHeaders = renameduplicateHeaders(rawHeaders)

        const pgColumns = await getTableColumns(client, item.table)
        const diff = compareColumns(csvHeaders, pgColumns)

        if (!diff.hasDifferences) continue

        const warning = {
          id: `${item.table}-${Date.now()}`,
          table: item.table,
          csvPath: item.csvPath,
          timestamp: nowIso,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV,
          hasDifferences: true
        }
        warnings.push(warning)

        await maybeInsertWarningHistory({
          tableName: item.table,
          csvPath: item.csvPath,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV
        })
      }

      res.json({ warnings })
    } finally {
      client.release()
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Historial de diferencias detectadas
app.get('/api/produccion/import/warnings-history', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 500))
    await ensureSyncHistoryTables()
    const r = await query(
      `SELECT id, table_name, csv_path, detected_at, extra_columns, missing_columns
       FROM tb_column_warnings_history
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ history: r.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Importar una tabla específica
// IMPORTANTE: Esta ruta con parámetro :table debe estar DESPUÉS de TODAS las rutas específicas
app.post('/api/produccion/import/:table', async (req, res) => {
  try {
    const { table } = req.params
    const { csvPath } = req.body
    
    if (!csvPath) {
      return res.status(400).json({ error: 'csvPath requerido' })
    }
    
    const result = await importCSV(pool, table, csvPath)
    res.json(result)
  } catch (err) {
    console.error(`Error importando ${req.params.table}:`, err)
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Pick folder (no implementado - funcionalidad opcional)
app.post('/api/produccion/system/pick-folder', async (req, res) => {
  res.status(501).json({ error: 'Funcionalidad no implementada' })
})

// PRODUCCION: Sync columns (no implementado - funcionalidad opcional)
app.post('/api/produccion/schema/sync-columns', async (req, res) => {
  const { table, csvPath, reimport } = req.body || {}

  if (!table) return res.status(400).json({ error: 'table requerido' })
  if (!csvPath) return res.status(400).json({ error: 'csvPath requerido' })

  try {
    await ensureSyncHistoryTables()

    const client = await pool.connect()
    let addedColumns = []

    try {
      const rawLine = readCsvHeaderLine(csvPath)
      const rawHeaders = rawLine.split(',')
      const csvHeaders = renameduplicateHeaders(rawHeaders)
      const pgColumns = await getTableColumns(client, table)
      const diff = compareColumns(csvHeaders, pgColumns)

      const toAdd = diff.extraInCSV || []
      const addRes = await addColumnsToTable(client, table, toAdd)
      addedColumns = addRes.columns || []

      await query(
        `INSERT INTO tb_schema_changes_log (table_name, change_type, columns_added, reimported, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [table, 'ADD_COLUMNS', addedColumns, Boolean(reimport), true]
      )

      // Registrar también como diferencia detectada (para historial) si aún había diferencias
      if (diff.hasDifferences) {
        await maybeInsertWarningHistory({
          tableName: table,
          csvPath,
          extraColumns: diff.extraInCSV,
          missingColumns: diff.missingInCSV
        })
      }
    } finally {
      client.release()
    }

    let reimportResult = null
    if (reimport) {
      reimportResult = await importCSV(pool, table, csvPath)
    }

    res.json({
      success: true,
      columnsAdded: addedColumns.length,
      addedColumns,
      reimportResult
    })
  } catch (err) {
    try {
      await ensureSyncHistoryTables()
      await query(
        `INSERT INTO tb_schema_changes_log (table_name, change_type, columns_added, reimported, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [table, 'ADD_COLUMNS', [], Boolean(reimport), false, err.message]
      )
    } catch (e2) {
      console.error('Error registrando tb_schema_changes_log:', e2.message)
    }
    res.status(500).json({ error: err.message })
  }
})

// PRODUCCION: Historial de sincronizaciones aplicadas
app.get('/api/produccion/schema/changes-log', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 500))
    await ensureSyncHistoryTables()
    const r = await query(
      `SELECT id, table_name, change_type, applied_at, columns_added, reimported, success, error_message
       FROM tb_schema_changes_log
       ORDER BY applied_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ changes: r.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function startServer() {
  try {
    // Esperar a PostgreSQL (en Podman/compose puede tardar unos segundos)
    const maxAttempts = Math.max(1, parseInt(process.env.PG_CONNECT_ATTEMPTS || '30', 10))
    const delayMs = Math.max(200, parseInt(process.env.PG_CONNECT_DELAY_MS || '1000', 10))
    let lastErr = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await pool.connect()
        client.release()
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        console.warn(`PostgreSQL no disponible (intento ${attempt}/${maxAttempts}): ${e.message}`)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }

    if (lastErr) throw lastErr
    console.log('✓ Conexión a PostgreSQL exitosa')

    // Índices para endpoints de calidad (impacta en performance con muchos datos)
    ensureCalidadIndexes().catch((e) => console.warn('ensureCalidadIndexes falló:', e.message))
    
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
