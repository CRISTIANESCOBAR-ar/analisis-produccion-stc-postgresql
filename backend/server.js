/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import fs from 'fs'
import { getImportStatus, importCSV, importAll, importSpecificTables, importForceAll, renameduplicateHeaders, getTableColumns, compareColumns, addColumnsToTable } from './import-manager.js'

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

const corsOptions = {
  origin(origin, cb) {
    // Permitir requests sin Origin (curl, health checks)
    if (!origin) return cb(null, true)

    if (allowedOriginList.includes(origin)) return cb(null, true)
    if (allowedOriginRegexes.some((re) => re.test(origin))) return cb(null, true)

    return cb(new Error(`CORS: Origin no permitido: ${origin}`))
  },
  credentials: true
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

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
    const csvFolder = req.query.csvFolder || 'C:\\STC\\CSV'
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
    
    const csvPath = csvFolder || 'C:\\STC\\CSV'
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
      const folder = csvFolder || 'C:\\STC\\CSV'
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
    const csvFolder = req.body.csvFolder || 'C:\\STC\\CSV'
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
    const csvFolder = req.body.csvFolder || 'C:\\STC\\CSV'
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
    const csvFolder = req.query.csvFolder || 'C:\\STC\\CSV'

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
    // Test database connection
    const client = await pool.connect()
    console.log('✓ Conexión a PostgreSQL exitosa')
    client.release()

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
