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
  connectionTimeoutMillis: 10000,
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

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function tableExists(tableName) {
  const res = await query('SELECT to_regclass($1) AS reg', [`public.${tableName}`])
  return Boolean(res.rows?.[0]?.reg)
}

async function ensureCostosSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_items (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'KG',
      activo BOOLEAN NOT NULL DEFAULT TRUE
    )`
  )

  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_item_alias (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      origen TEXT NOT NULL,
      nombre_en_origen TEXT NOT NULL,
      UNIQUE (origen, nombre_en_origen)
    )`
  )

  await query(
    `CREATE TABLE IF NOT EXISTS tb_costo_mensual (
      id SERIAL PRIMARY KEY,
      yyyymm TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES tb_costo_items(id),
      ars_por_unidad NUMERIC NOT NULL,
      observaciones TEXT,
      UNIQUE (yyyymm, item_id)
    )`
  )

  await query('CREATE INDEX IF NOT EXISTS idx_costo_mensual_mes ON tb_costo_mensual(yyyymm)')
  await query('CREATE INDEX IF NOT EXISTS idx_costo_alias_item ON tb_costo_item_alias(item_id)')

  await query(
    `INSERT INTO tb_costo_items (codigo, descripcion, unidad, activo)
     VALUES
       ('ESTOPA_AZUL', 'Estopa Azul', 'KG', TRUE),
       ('URDIDO_TENIDO', 'Urdido Tenido', 'M', TRUE),
       ('TELA_TERMINADA', 'Tela Terminada', 'M', TRUE)
     ON CONFLICT (codigo) DO NOTHING`
  )

  await query("UPDATE tb_costo_items SET unidad = 'M' WHERE codigo IN ('URDIDO_TENIDO', 'TELA_TERMINADA')")

  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'URDIDO TEÑIDO' FROM tb_costo_items WHERE codigo = 'URDIDO_TENIDO'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'TELA TERMINADA' FROM tb_costo_items WHERE codigo = 'TELA_TERMINADA'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'ESTOPA AZUL' FROM tb_costo_items WHERE codigo = 'ESTOPA_AZUL'
     ON CONFLICT DO NOTHING`
  )
  await query(
    `INSERT INTO tb_costo_item_alias (item_id, origen, nombre_en_origen)
     SELECT id, 'ACCESS', 'ESTOPA AZUL TEJEDURIA' FROM tb_costo_items WHERE codigo = 'ESTOPA_AZUL'
     ON CONFLICT DO NOTHING`
  )
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

async function costosTablesReady() {
  await ensureCostosSchema()
  return true
}

// =====================================================
// ENDPOINTS COSTOS MENSUALES
// Base URL en frontend: /api/produccion
// =====================================================

app.get('/api/produccion/costos/items', async (req, res) => {
  try {
    const ready = await costosTablesReady()
    if (!ready) return res.json({ rows: [] })

    const sql = `
      SELECT
        i.id AS item_id,
        i.codigo AS codigo,
        i.descripcion AS descripcion,
        i.unidad AS unidad,
        i.activo AS activo,
        a.origen AS origen,
        a.nombre_en_origen AS nombre_en_origen
      FROM tb_costo_items i
      LEFT JOIN tb_costo_item_alias a ON a.item_id = i.id
      ORDER BY i.id ASC, a.id ASC
    `
    const result = await query(sql, [], 'costos-items')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en costos/items:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/produccion/costos/mensual', async (req, res) => {
  try {
    const ready = await costosTablesReady()
    if (!ready) return res.json({ rows: [] })

    const limite = Math.max(1, Number.parseInt(String(req.query.limite || ''), 10) || 24)
    const sql = `
      WITH meses AS (
        SELECT DISTINCT yyyymm
        FROM tb_costo_mensual
        ORDER BY yyyymm DESC
        LIMIT $1
      )
      SELECT
        m.yyyymm AS yyyymm,
        i.id AS item_id,
        i.codigo AS codigo,
        i.descripcion AS descripcion,
        i.unidad AS unidad,
        cm.ars_por_unidad AS ars_por_unidad,
        cm.observaciones AS observaciones
      FROM meses m
      CROSS JOIN tb_costo_items i
      LEFT JOIN tb_costo_mensual cm
        ON cm.yyyymm = m.yyyymm AND cm.item_id = i.id
      ORDER BY m.yyyymm DESC, i.id ASC
    `

    const result = await query(sql, [limite], 'costos-mensual')
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('Error en costos/mensual:', err)
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/produccion/costos/mensual', async (req, res) => {
  const { rows } = req.body || {}
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows requerido' })

  const ready = await costosTablesReady()
  if (!ready) return res.status(400).json({ error: 'Tablas de costos no configuradas' })

  const client = await getClient()
  try {
    await client.query('BEGIN')

    for (const row of rows) {
      const yyyymm = String(row?.yyyymm || '').trim()
      const itemId = Number(row?.item_id)
      const obs = row?.observaciones ?? null

      if (!/^\d{4}-\d{2}$/.test(yyyymm)) {
        throw new Error(`yyyymm invalido: ${yyyymm}`)
      }
      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error('item_id invalido')
      }

      const rawValue = row?.ars_por_unidad
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        await client.query(
          'DELETE FROM tb_costo_mensual WHERE yyyymm = $1 AND item_id = $2',
          [yyyymm, itemId]
        )
        continue
      }

      const value = Number(rawValue)
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('ars_por_unidad invalido')
      }

      await client.query(
        `
          INSERT INTO tb_costo_mensual (yyyymm, item_id, ars_por_unidad, observaciones)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (yyyymm, item_id) DO UPDATE
          SET ars_por_unidad = EXCLUDED.ars_por_unidad,
              observaciones = EXCLUDED.observaciones
        `,
        [yyyymm, itemId, value, obs]
      )
    }

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error en costos/mensual (PUT):', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
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
    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
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
    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
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
      `SELECT COALESCE("Revision", 0) AS total
       FROM tb_metas WHERE "Dia" = $1`,
      [datePattern],
      'metas/resumen-dia'
    )
    const metaMes = await query(
      `SELECT COALESCE(SUM("Revision"), 0) AS total
       FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
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
    let indigoMetaRot = 0
    let indigoMetaEstopa = 0
    if (await tableExists('tb_metas')) {
      const metaDiaRes = await query(
        'SELECT "Indigo" AS meta_dia, "Meta_Rotura_INDIGO" AS meta_rot_103, "Meta_Estopa_Azul" AS meta_estopa_azul FROM tb_metas WHERE "Dia" = $1',
        [datePattern],
        'metas/indigo-dia'
      )
      const metaMesRes = await query(
        'SELECT SUM("Indigo") AS total, AVG("Meta_Rotura_INDIGO") AS meta_rot_103, AVG("Meta_Estopa_Azul") AS meta_estopa_azul FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2',
        [mesInicio, mesFin],
        'metas/indigo-mes'
      )
      metaDia = Number(metaDiaRes.rows?.[0]?.meta_dia || 0)
      metaMes = Number(metaMesRes.rows?.[0]?.total || 0)
      indigoMetaRot = Number(metaDiaRes.rows?.[0]?.meta_rot_103 || metaMesRes.rows?.[0]?.meta_rot_103 || 0)
      indigoMetaEstopa = Number(metaDiaRes.rows?.[0]?.meta_estopa_azul || metaMesRes.rows?.[0]?.meta_estopa_azul || 0)
    }

    res.json({
      day: {
        metros: Number(resultDia.rows?.[0]?.metros || 0),
        rot103: Number(resultDia.rows?.[0]?.rot_103 || 0),
        meta: metaDia,
        metaRot103: indigoMetaRot || 0,
        metaEstopaAzul: indigoMetaEstopa || 0
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        rot103: Number(resultMes.rows?.[0]?.rot_103 || 0),
        metaAcumulada: metaMes,
        metaRot103: indigoMetaRot || 0,
        metaEstopaAzul: indigoMetaEstopa || 0
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
        `SELECT
           "Tejeduria" AS meta_dia,
           "EFI_Percent" AS meta_efi,
           "RT105" AS meta_rt105,
           "RU105" AS meta_ru105,
           "Meta_Estopa_Azul_Tejeduria" AS meta_estopa
         FROM tb_metas WHERE "Dia" = $1`,
        [datePattern],
        'metas/tecelagem-dia'
      )
      const metaMesRes = await query(
        `SELECT
           SUM("Tejeduria") AS meta_acumulada,
           AVG("EFI_Percent") AS meta_efi,
           AVG("RT105") AS meta_rt105,
           AVG("RU105") AS meta_ru105,
           AVG("Meta_Estopa_Azul_Tejeduria") AS meta_estopa
         FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
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
        metaEfi: Number(metaDia.meta_efi || 0),
        metaRt105: Number(metaDia.meta_rt105 || 0),
        metaRu105: Number(metaDia.meta_ru105 || 0),
        metaEstopaAzul: Number(metaDia.meta_estopa || 0)
      },
      month: {
        metros: Number(resultMes.rows?.[0]?.metros || 0),
        eficiencia: Number(resultMes.rows?.[0]?.eficiencia || 0),
        rotTra105: Number(resultMes.rows?.[0]?.rot_tra_105 || 0),
        rotUrd105: Number(resultMes.rows?.[0]?.rot_urd_105 || 0),
        estopaAzulPct: estopaAzulPctMes,
        metaAcumulada: Number(metaMes.meta_acumulada || 0),
        metaEfi: Number(metaMes.meta_efi || 0),
        metaRt105: Number(metaMes.meta_rt105 || 0),
        metaRu105: Number(metaMes.meta_ru105 || 0),
        metaEstopaAzul: Number(metaMes.meta_estopa || 0)
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
        `SELECT "Integrada" AS meta_dia, "Meta_ENC_URD_Integrada" AS meta_enc_urd FROM tb_metas WHERE "Dia" = $1`,
        [datePattern],
        'metas/acabamento-dia'
      )
      const metaMesRes = await query(
        `SELECT SUM("Integrada") AS meta_acumulada, AVG("Meta_ENC_URD_Integrada") AS meta_enc_urd
         FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2`,
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
    const result = await query(`SELECT testnr, nomcount, maschnr, lote, laborant, time_stamp, matclass, estiraje, pasador, obs, created_at, updated_at FROM tb_uster_par ORDER BY testnr`)
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
    
    // Helper function to convert values to numbers, preserving zeros
    const toNum = (val) => {
      if (val == null || val === '') return null
      const num = parseFloat(val)
      return isNaN(num) ? null : num
    }
    
    // Insert new TBL records
    if (Array.isArray(tbl) && tbl.length > 0) {
      // DEBUG: Log first row to see what values are arriving
      if (tbl.length > 0) {
        console.log('[DEBUG USTER TBL Row 1]', JSON.stringify(tbl[0], null, 2))
      }
      for (let i = 0; i < tbl.length; i++) {
        const r = tbl[i]
        const params = [
          par.TESTNR, i+1, r.NO_, 
          toNum(r.U_PERCENT), toNum(r.CVM_PERCENT), toNum(r.INDICE_PERCENT),
          toNum(r.CVM_1M_PERCENT), toNum(r.CVM_3M_PERCENT), toNum(r.CVM_10M_PERCENT),
          toNum(r.TITULO), toNum(r.TITULO_REL_PERC),
          toNum(r.H), toNum(r.SH), toNum(r.SH_1M), toNum(r.SH_3M), toNum(r.SH_10M),
          toNum(r.DELG_MINUS30_KM), toNum(r.DELG_MINUS40_KM),
          toNum(r.DELG_MINUS50_KM), toNum(r.DELG_MINUS60_KM),
          toNum(r.GRUE_35_KM), toNum(r.GRUE_50_KM), toNum(r.GRUE_70_KM),
          toNum(r.GRUE_100_KM),
          toNum(r.NEPS_140_KM), toNum(r.NEPS_200_KM), toNum(r.NEPS_280_KM), toNum(r.NEPS_400_KM)
        ]
        if (i === 0) {
          console.log('[DEBUG INSERT params row 1]', params.slice(0, 10))
        }
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
          params
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

// CALIDAD FIBRA: Get all
app.get('/api/calidad-fibra', async (req, res) => {
  try {
    const result = await query(`
      SELECT "LOTE_FIAC", "PESO", "MISTURA", "SEQ", "DT_ENTRADA_PROD", "HR_ENTRADA_PROD",
             "SCI", "MST", "MIC", "MAT", "UHML", "UI", "SF", 
             "STR", "ELG", "RD", "PLUS_B", "TIPO", "TrCNT", "TrAR", "TRID"
      FROM tb_CALIDAD_FIBRA
      WHERE "LOTE_FIAC" IS NOT NULL AND "LOTE_FIAC" != ''
        AND "TIPO_MOV" = 'MIST'
      ORDER BY "MISTURA", "SEQ"
    `)
    res.json({ rows: result.rows.map(uppercaseKeys) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GOLDEN BATCH: Summary
app.get('/api/golden-batch/summary', async (req, res) => {
  console.log('>>> [GOLDEN BATCH] Requesting Summary...');
  try {
    const result = await query(`
      SELECT 
        CASE 
          WHEN "EFIC_TEJ" >= 90 THEN 'EXITO (>90%)' 
          WHEN "EFIC_TEJ" < 85 THEN 'BAJA (<85%)' 
          ELSE 'NORMAL' 
        END as estado, 
        COUNT(*) as volumen, 
        ROUND(AVG("SCI"), 1) as sci, 
        ROUND(AVG("STR"), 1) as str, 
        ROUND(AVG("MIC"), 2) as mic, 
        ROUND(AVG("RU_105"), 1) as rot_urd 
      FROM view_golden_batch_data 
      GROUP BY 1 
      ORDER BY MIN("EFIC_TEJ") DESC
    `, [], 'GoldenBatchSummary')
    console.log('>>> [GOLDEN BATCH] Summary Rows:', result.rows.length);
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('>>> [GOLDEN BATCH] Summary ERROR:', err.message);
    res.status(500).json({ error: err.message })
  }
})

// GOLDEN BATCH: Points
app.get('/api/golden-batch/points', async (req, res) => {
  console.log('>>> [GOLDEN BATCH] Requesting Points...');
  try {
    const result = await query(`
      SELECT 
        "ROLADA",
        "DATA", 
        "TURNO", 
        "ARTICULO", 
        "TEJIDO_REAL_M", 
        "EFIC_TEJ", 
        "RU_105",
        "RT_105",
        "ROT_URD_URDI",
        "INDIGO_BASE",
        "INDIGO_COLOR",
        "INDIGO_R",
        "INDIGO_CAVALOS",
        "INDIGO_VEL_NOM",
        "INDIGO_VEL_REAL",
        "LOTE_FIBRA_TEXT",
        "MISTURA",
        "SCI", 
        "STR", 
        "MIC"
      FROM view_golden_batch_data 
      ORDER BY "DATA" DESC
    `, [], 'GoldenBatchPoints')
    console.log('>>> [GOLDEN BATCH] Points Rows:', result.rows.length);
    res.json({ rows: result.rows })
  } catch (err) {
    console.error('>>> [GOLDEN BATCH] Points ERROR:', err.message);
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
// ENDPOINTS INDIGO
// =====================================================
app.get('/api/residuos-indigo-tejeduria', async (req, res) => {
  try {
    const requiredTables = [
      'tb_produccion',
      'tb_fichas',
      'tb_residuos_indigo',
      'tb_residuos_por_sector',
      'tb_paradas'
    ]
    const ready = await Promise.all(requiredTables.map(tableExists))
    if (!ready.every(Boolean)) {
      return res.json([])
    }

    const { fecha_inicio, fecha_fin } = req.query
    const fechaInicio = fecha_inicio ? dateVariants(fecha_inicio).iso : null
    const fechaFin = fecha_fin ? dateVariants(fecha_fin).iso : null

    const fichasColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_fichas'`,
      [],
      'tb-fichas-columns'
    )
    const fichasCols = new Map(
      (fichasColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const consumoKey = ['cons#urd/m', 'consumo'].find((c) => fichasCols.has(c))
    const sizingKey = ['enc#tec#urdume', 'sizing'].find((c) => fichasCols.has(c))
    const consumoCol = consumoKey ? fichasCols.get(consumoKey) : null
    const sizingCol = sizingKey ? fichasCols.get(sizingKey) : null
    const consumoNum = consumoCol ? sqlParseNumber(quoteIdent(consumoCol)) : 'NULL::numeric'
    const sizingNum = sizingCol ? sqlParseNumber(quoteIdent(sizingCol)) : 'NULL::numeric'

    const produccionColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
      [],
      'tb-produccion-columns'
    )
    const prodCols = new Map(
      (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const urdumeKey = ['urdume', 'base urdume'].find((c) => prodCols.has(c))
    const urdumeCol = urdumeKey ? prodCols.get(urdumeKey) : null
    const urdumeExprProd = urdumeCol ? `P.${quoteIdent(urdumeCol)}` : 'NULL::text'
    const urdumeExprTej = urdumeCol ? `T.${quoteIdent(urdumeCol)}` : 'NULL::text'
    const prodDateKey = ['dt_base_producao', 'data_base'].find((c) => prodCols.has(c))
    const prodDateCol = prodDateKey ? prodCols.get(prodDateKey) : null
    const prodDateExpr = prodDateCol ? `P.${quoteIdent(prodDateCol)}` : 'NULL::text'
    const tejDateExpr = prodDateCol ? `T.${quoteIdent(prodDateCol)}` : 'NULL::text'

    const paradasColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_paradas'`,
      [],
      'tb-paradas-columns'
    )
    const parCols = new Map(
      (paradasColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const parDateKey = ['dt_base_producao', 'data_base'].find((c) => parCols.has(c))
    const parDateCol = parDateKey ? parCols.get(parDateKey) : null
    const parDateExpr = parDateCol ? `"${parDateCol}"` : 'NULL::text'
    const parMotivoKey = ['motivo', 'motivo1'].find((c) => parCols.has(c))
    const parMotivoCol = parMotivoKey ? parCols.get(parMotivoKey) : null
    const parMotivoExpr = parMotivoCol ? quoteIdent(parMotivoCol) : 'NULL::text'
    const metragemNum = sqlParseNumberIntl('P."METRAGEM"')
    const metragemTejNum = sqlParseNumberIntl('T."METRAGEM"')
    const residuosNum = sqlParseNumber('R."PESO LIQUIDO (KG)"')
    const residuosTejNum = sqlParseNumber('RS."PESO LIQUIDO (KG)"')
    const residuosPrensNum = sqlParseNumber('RP."PESO LIQUIDO (KG)"')

    const dateExpr = sqlParseDate('D.fecha')
    const dateFilter = fechaInicio && fechaFin ? `WHERE ${dateExpr} BETWEEN $1::date AND $2::date` : ''
    const params = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : []

    const sql = `
      WITH FICHAS_UNIQUE AS (
        SELECT
          btrim("URDUME") AS URDUME,
          MAX(${consumoNum}) AS CONSUMO,
          AVG(${sizingNum}) AS SIZING
        FROM tb_fichas
        WHERE ${consumoNum} IS NOT NULL AND ${consumoNum} <> 0
        GROUP BY btrim("URDUME")
      ),
      FICHAS_ARTIGO AS (
        SELECT
          btrim("URDUME") AS URDUME,
          btrim("ARTIGO") AS ARTIGO,
          MAX(${consumoNum}) AS CONSUMO,
          AVG(${sizingNum}) AS SIZING
        FROM tb_fichas
        WHERE ${consumoNum} IS NOT NULL AND ${consumoNum} <> 0
        GROUP BY btrim("URDUME"), btrim("ARTIGO")
      ),
      PRODUCCION_IND AS (
        SELECT
          ${prodDateExpr} AS DT_BASE_PRODUCAO,
          SUM(${metragemNum}) AS TotalMetros,
          (SUM(${metragemNum} * FU.CONSUMO) / 1000) * 0.98 AS TotalKg
        FROM tb_produccion P
        JOIN FICHAS_UNIQUE FU ON btrim(${urdumeExprProd}) = FU.URDUME
        WHERE P."SELETOR" = 'INDIGO' AND P."FILIAL" = '05'
        GROUP BY ${prodDateExpr}
      ),
      TEJEDURIA_RAW AS (
        SELECT
          ${tejDateExpr} AS DT_BASE_PRODUCAO,
          ${metragemTejNum} AS Metros,
          COALESCE(FA.CONSUMO, FU.CONSUMO) AS Consumo,
          COALESCE(FA.SIZING, FU.SIZING, 0) AS Sizing
        FROM tb_produccion T
        LEFT JOIN FICHAS_ARTIGO FA ON btrim(${urdumeExprTej}) = FA.URDUME AND T."ARTIGO" LIKE FA.ARTIGO || '%'
        LEFT JOIN FICHAS_UNIQUE FU ON btrim(${urdumeExprTej}) = FU.URDUME
        WHERE T."SELETOR" = 'TECELAGEM' AND T."FILIAL" = '05'
      ),
      PRODUCCION_TEJ AS (
        SELECT
          DT_BASE_PRODUCAO,
          SUM(Metros) AS TejeduriaMetros,
          SUM(Metros * Consumo / NULLIF(1 - (Sizing / 100), 0)) / 1000 AS TejeduriaKg
        FROM TEJEDURIA_RAW
        GROUP BY DT_BASE_PRODUCAO
      ),
      RES_IND AS (
        SELECT R."DT_MOV" AS DT_MOV, SUM(${residuosNum}) AS ResiduosKg
        FROM tb_residuos_indigo R
        WHERE btrim(R."DESCRICAO") = 'ESTOPA AZUL'
        GROUP BY R."DT_MOV"
      ),
      RES_TEJ AS (
        SELECT RS."DT_MOV" AS DT_MOV, SUM(${residuosTejNum}) AS ResiduosTejeduriaKg
        FROM tb_residuos_por_sector RS
        WHERE btrim(RS."DESCRICAO") = 'ESTOPA AZUL TEJEDURÍA'
        GROUP BY RS."DT_MOV"
      ),
      RES_PRENSA AS (
        SELECT RP."DT_MOV" AS DT_MOV, SUM(${residuosPrensNum}) AS ResiduosPrensadaKg
        FROM tb_residuos_por_sector RP
        WHERE btrim(RP."DESCRICAO") = 'ESTOPA AZUL'
        GROUP BY RP."DT_MOV"
      ),
      ANUDADOS AS (
        SELECT ${parDateExpr} AS DT_BASE_PRODUCAO, COUNT(*)::int AS AnudadosCount
        FROM tb_paradas
        WHERE ${sqlParseNumber(parMotivoExpr)} = 101
        GROUP BY ${parDateExpr}
      ),
      ALL_DATES AS (
        SELECT DT_BASE_PRODUCAO AS fecha FROM PRODUCCION_IND
        UNION
        SELECT DT_BASE_PRODUCAO AS fecha FROM PRODUCCION_TEJ
        UNION
        SELECT DT_MOV AS fecha FROM RES_IND
        UNION
        SELECT DT_MOV AS fecha FROM RES_TEJ
        UNION
        SELECT DT_MOV AS fecha FROM RES_PRENSA
      )
      SELECT
        D.fecha AS "DT_BASE_PRODUCAO",
        COALESCE(PI.TotalMetros, 0) AS "TotalMetros",
        COALESCE(PI.TotalKg, 0) AS "TotalKg",
        COALESCE(RI.ResiduosKg, 0) AS "ResiduosKg",
        COALESCE(PT.TejeduriaMetros, 0) AS "TejeduriaMetros",
        COALESCE(PT.TejeduriaKg, 0) AS "TejeduriaKg",
        COALESCE(RT.ResiduosTejeduriaKg, 0) AS "ResiduosTejeduriaKg",
        COALESCE(A.AnudadosCount, 0) AS "AnudadosCount",
        COALESCE(RP.ResiduosPrensadaKg, 0) AS "ResiduosPrensadaKg"
      FROM ALL_DATES D
      LEFT JOIN PRODUCCION_IND PI ON PI.DT_BASE_PRODUCAO = D.fecha
      LEFT JOIN PRODUCCION_TEJ PT ON PT.DT_BASE_PRODUCAO = D.fecha
      LEFT JOIN RES_IND RI ON RI.DT_MOV = D.fecha
      LEFT JOIN RES_TEJ RT ON RT.DT_MOV = D.fecha
      LEFT JOIN RES_PRENSA RP ON RP.DT_MOV = D.fecha
      LEFT JOIN ANUDADOS A ON A.DT_BASE_PRODUCAO = D.fecha
      ${dateFilter}
      ORDER BY ${dateExpr} ASC NULLS LAST
    `

    const result = await query(sql, params, 'residuos-indigo-tejeduria')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-tejeduria:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/detalle-residuos', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim()
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' })
    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DT_MOV" AS "DT_MOV",
        "TURNO" AS "TURNO",
        "SUBPRODUTO" AS "SUBPRODUTO",
        "DESCRICAO" AS "DESCRICAO",
        "ID" AS "ID",
        ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS "PESO LIQUIDO (KG)",
        "PARTIDA" AS "PARTIDA",
        "ROLADA" AS "ROLADA",
        "MOTIVO" AS "MOTIVO",
        "DESC_MOTIVO" AS "DESC_MOTIVO",
        "URDUME" AS "URDUME",
        "PE DE ROLO" AS "PE DE ROLO",
        "INDIGO" AS "INDIGO",
        "GAIOLA" AS "GAIOLA",
        "OBS" AS "OBS"
      FROM tb_residuos_indigo
      WHERE ("DT_MOV" = ANY($1::text[]) OR ${sqlParseDate('"DT_MOV"')} = $2::date)
      ORDER BY "ID" ASC
    `
    const result = await query(sql, [dateTextCandidates(fecha), variants.iso], 'detalle-residuos')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en detalle-residuos:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/detalle-residuos-sector', async (req, res) => {
  try {
    const fecha = String(req.query.fecha || '').trim()
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' })
    const variants = dateVariants(fecha)
    const sql = `
      SELECT
        "DT_MOV" AS "DT_MOV",
        "TURNO" AS "TURNO",
        "SUBPRODUTO" AS "SUBPRODUTO",
        "DESCRICAO" AS "DESCRICAO",
        "ID" AS "ID",
        ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS "PESO LIQUIDO (KG)",
        "OBS" AS "OBS"
      FROM tb_residuos_por_sector
      WHERE ("DT_MOV" = ANY($1::text[]) OR ${sqlParseDate('"DT_MOV"')} = $2::date)
        AND btrim("DESC_SETOR") = 'TECELAGEM'
      ORDER BY "ID" ASC
    `
    const result = await query(sql, [dateTextCandidates(fecha), variants.iso], 'detalle-residuos-sector')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en detalle-residuos-sector:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-analisis', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT
        "MOTIVO" AS "MOTIVO",
        "DESC_MOTIVO" AS "DESC_MOTIVO",
        SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')}) AS "TotalKg"
      FROM tb_residuos_indigo
      WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
        AND ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
      GROUP BY "MOTIVO", "DESC_MOTIVO"
      HAVING SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')}) > 0
      ORDER BY "TotalKg" DESC
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'residuos-indigo-analisis')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-analisis:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-estopa-por-mes', async (req, res) => {
  try {
    const sql = `
      WITH BASE AS (
        SELECT ${sqlParseDate('"DT_MOV"')} AS DT,
               ${sqlParseNumber('"PESO LIQUIDO (KG)"')} AS PESO
        FROM tb_residuos_indigo
        WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
      )
      SELECT
        to_char(DT, 'YYYY-MM') AS "Mes",
        COALESCE(ROUND(SUM(PESO)), 0)::int AS "KgResiduo"
      FROM BASE
      WHERE DT IS NOT NULL
        AND DT >= (date_trunc('month', current_date) - interval '11 months')
      GROUP BY 1
      ORDER BY 1
    `
    const result = await query(sql, [], 'residuos-indigo-estopa-por-mes')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-estopa-por-mes:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/residuos-indigo-estopa-por-dia', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT
        "DT_MOV" AS "Fecha",
        COALESCE(ROUND(SUM(${sqlParseNumber('"PESO LIQUIDO (KG)"')})), 0)::int AS "KgResiduo"
      FROM tb_residuos_indigo
      WHERE btrim("DESCRICAO") = 'ESTOPA AZUL'
        AND ${sqlParseDate('"DT_MOV"')} BETWEEN $1::date AND $2::date
      GROUP BY "DT_MOV"
      ORDER BY ${sqlParseDate('"DT_MOV"')} ASC
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'residuos-indigo-estopa-por-dia')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en residuos-indigo-estopa-por-dia:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/produccion-indigo-resumen', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'fecha_inicio y fecha_fin requeridos' })
    const fechaInicio = dateVariants(fecha_inicio).iso
    const fechaFin = dateVariants(fecha_fin).iso
    const sql = `
      SELECT "S" AS "S", COUNT(*)::int AS "count"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      GROUP BY "S"
      ORDER BY "S"
    `
    const result = await query(sql, [fechaInicio, fechaFin], 'produccion-indigo-resumen')
    res.json({ s_valores: result.rows })
  } catch (err) {
    console.error('Error en produccion-indigo-resumen:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-indigo', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })
    const sql = `
      SELECT
        "ROLADA" AS "ROLADA",
        "DT_INICIO" AS "DT_INICIO",
        "HORA_INICIO" AS "HORA_INICIO",
        "DT_FINAL" AS "DT_FINAL",
        "HORA_FINAL" AS "HORA_FINAL",
        "TURNO" AS "TURNO",
        "PARTIDA" AS "PARTIDA",
        "ARTIGO" AS "ARTIGO",
        "COR" AS "COR",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"VELOC"')} AS "VELOC",
        "S" AS "S",
        ${sqlParseNumberIntl('"RUPTURAS"')} AS "RUPTURAS",
        ${sqlParseNumberIntl('"CAVALOS"')} AS "CAVALOS",
        "OPERADOR" AS "OPERADOR",
        "NM OPERADOR" AS "NM_OPERADOR"
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO' 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      ORDER BY ${sqlParseDate('"DT_INICIO"')} ASC, "HORA_INICIO" ASC
    `
    const result = await query(sql, [rolada], 'consulta-rolada-indigo')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-indigo:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-urdimbre', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })
    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        "DT_INICIO" AS "DT_INICIO",
        "HORA_INICIO" AS "HORA_INICIO",
        "DT_FINAL" AS "DT_FINAL",
        "HORA_FINAL" AS "HORA_FINAL",
        "ARTIGO" AS "ARTIGO",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"VELOC"')} AS "VELOC",
        ${sqlParseNumberIntl('"NUM_FIOS"')} AS "NUM_FIOS",
        ${sqlParseNumberIntl('"RUP FIACAO"')} AS "RUP_FIACAO",
        ${sqlParseNumberIntl('"RUP URD"')} AS "RUP_URD",
        ${sqlParseNumberIntl('"RUP OPER"')} AS "RUP_OPER",
        ${sqlParseNumberIntl('"RUPTURAS"')} AS "RUPTURAS",
        "NM OPERADOR" AS "NM_OPERADOR",
        "LOTE FIACAO" AS "LOTE_FIACAO",
        "MAQ FIACAO" AS "MAQ_FIACAO",
        "BASE URDUME" AS "BASE_URDUME"
      FROM tb_produccion
      WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA') 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      ORDER BY ${sqlParseDate('"DT_INICIO"')} ASC, "HORA_INICIO" ASC
    `
    const result = await query(sql, [rolada], 'consulta-rolada-urdimbre')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-urdimbre:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-tecelagem', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const eficienciaNum = sqlParseNumberIntl('"EFICIENCIA"')
    const paradaTramaNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
    const paradaUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')
    const rpmNum = sqlParseNumberIntl('"RPM NOMINALTEAR"')
    const batidasNum = sqlParseNumberIntl('"BATIDAS"')

    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        MIN("DT_INICIO") AS "FECHA_INICIAL",
        MAX("DT_FINAL") AS "FECHA_FINAL",
        SUM(${metragemNum}) AS "METRAGEM",
        MAX("MAQUINA") AS "MAQUINA",
        AVG(${eficienciaNum}) AS "EFICIENCIA",
        ROUND((SUM(${paradaTramaNum}) * 100000) / NULLIF(SUM(${metragemNum}) * 1000, 0), 1) AS "ROTURAS_TRA_105",
        ROUND((SUM(${paradaUrdNum}) * 100000) / NULLIF(SUM(${metragemNum}) * 1000, 0), 1) AS "ROTURAS_URD_105",
        MAX("ARTIGO") AS "ARTIGO",
        MAX("COR") AS "COR",
        MAX("NM MERCADO") AS "NM_MERCADO",
        SUM(${batidasNum}) AS "PASADAS",
        AVG(${rpmNum}) AS "RPM"
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM' 
        AND "FILIAL" = '05'
        AND (LTRIM(TRIM("ROLADA"), '0') = LTRIM(TRIM($1), '0'))
      GROUP BY "PARTIDA", "MAQUINA", "ARTIGO", "COR", "NM MERCADO"
      ORDER BY substring("PARTIDA" from '.{6}$') ASC
    `

    const result = await query(sql, [rolada], 'consulta-rolada-tecelagem')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-tecelagem:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-partida-tecelagem', async (req, res) => {
  try {
    const partida = String(req.query.partida || '').trim()
    const cor = String(req.query.cor || '').trim()
    if (!partida) return res.status(400).json({ error: 'partida requerida' })

    const sortDir = cor.length === 4 ? 'DESC' : 'ASC'
    const sql = `
      SELECT
        "DT_BASE_PRODUCAO" AS "DT_BASE_PRODUCAO",
        "TURNO" AS "TURNO",
        "PARTIDA" AS "PARTIDA",
        ${sqlParseNumberIntl('"METRAGEM"')} AS "METRAGEM",
        ${sqlParseNumberIntl('"PARADA TEC TRAMA"')} AS "PARADA_TRAMA",
        ${sqlParseNumberIntl('"PARADA TEC URDUME"')} AS "PARADA_URDUME",
        ${sqlParseNumberIntl('"EFICIENCIA"')} AS "EFICIENCIA",
        ROUND((${sqlParseNumberIntl('"PARADA TEC TRAMA"')} * 100000) / NULLIF(${sqlParseNumberIntl('"METRAGEM"')} * 1000, 0), 1) AS "ROTURAS_TRA_105",
        ROUND((${sqlParseNumberIntl('"PARADA TEC URDUME"')} * 100000) / NULLIF(${sqlParseNumberIntl('"METRAGEM"')} * 1000, 0), 1) AS "ROTURAS_URD_105",
        ${sqlParseNumberIntl('"BATIDAS"')} AS "BATIDAS",
        ${sqlParseNumberIntl('"RPM NOMINALTEAR"')} AS "RPM",
        "ARTIGO" AS "ARTIGO",
        "COR" AS "COR",
        "NM MERCADO" AS "NM_MERCADO",
        "MAQUINA" AS "MAQUINA",
        "GRUPO TEAR" AS "GRUPO_TEAR",
        "BASE URDUME" AS "BASE_URDUME"
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM' AND "PARTIDA" = $1
      ORDER BY ${sqlParseDate('"DT_BASE_PRODUCAO"')} ${sortDir}, "TURNO" ${sortDir}
    `

    const result = await query(sql, [partida], 'consulta-partida-tecelagem')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-partida-tecelagem:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-rolada-calidad', async (req, res) => {
  try {
    const rolada = String(req.query.rolada || '').trim()
    if (!rolada) return res.status(400).json({ error: 'rolada requerida' })

    const metragemNum = sqlParseNumberIntl('"METRAGEM"')
    const sql = `
      SELECT
        "PARTIDA" AS "PARTIDA",
        MAX("ST IND") AS "ST_IND",
        MAX("REPROCESSO") AS "REPROCESSO",
        MAX("TEAR") AS "TEAR",
        SUM(${metragemNum}) AS "METRAGEM_TOTAL",
        SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
        SUM(CASE WHEN "QUALIDADE" NOT ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA",
        SUM(CASE WHEN "GRP_DEF" = 'HIL' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_HIL",
        SUM(CASE WHEN "GRP_DEF" = 'IND' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_IND",
        SUM(CASE WHEN "GRP_DEF" = 'TE' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_TE",
        SUM(CASE WHEN "GRP_DEF" = 'TEF' THEN ${metragemNum} ELSE 0 END) AS "METROS_2DA_TEF",
        MAX("ARTIGO") AS "ARTIGO",
        MAX("COR") AS "COR",
        MAX("NM MERC") AS "NM_MERCADO",
        MAX("TRAMA") AS "TRAMA"
      FROM tb_calidad
      WHERE (LTRIM("ROLADA", '0') = LTRIM($1, '0') OR LTRIM(substring(right("PARTIDA", 6) from 1 for 4), '0') = LTRIM($1, '0'))
      GROUP BY "PARTIDA", "TEAR", "ARTIGO", "COR", "NM MERC", "TRAMA"
      ORDER BY "PARTIDA" ASC
    `

    const result = await query(sql, [rolada], 'consulta-rolada-calidad')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-rolada-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/consulta-partida-calidad', async (req, res) => {
  try {
    const partida = String(req.query.partida || '').trim()
    if (!partida) return res.status(400).json({ error: 'partida requerida' })
    const sql = `
      SELECT
        "GRP_DEF" AS "GRP_DEF",
        "COD_DE" AS "COD_DE",
        "DEFEITO" AS "DEFEITO",
        ${sqlParseNumber('"METRAGEM"')} AS "METRAGEM",
        "QUALIDADE" AS "QUALIDADE",
        "HORA" AS "HORA",
        "EMENDAS" AS "EMENDAS",
        "PEÇA" AS "PECA",
        "ETIQUETA" AS "ETIQUETA",
        ${sqlParseNumber('"LARGURA"')} AS "LARGURA",
        ${sqlParseNumber('"PONTUACAO"')} AS "PONTUACAO",
        "REVISOR FINAL" AS "REVISOR_FINAL"
      FROM tb_calidad
      WHERE "PARTIDA" = $1
      ORDER BY "HORA" ASC
    `
    const result = await query(sql, [partida], 'consulta-partida-calidad')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en consulta-partida-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

async function getSeguimientoRoladasData(fechaInicio, fechaFin) {
  // Obtener columnas de tb_produccion para detección dinámica de MAQ y LOTE
  const produccionColumns = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
    [],
    'tb-produccion-columns-seguimiento'
  );
  const prodCols = new Map(
    (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
  );
  
  const maqKey = ['maq  fiacao', 'maq fiacao', 'maquina'].find((c) => prodCols.has(c));
  const loteKey = ['lote fiacao', 'lote  fiacao'].find((c) => prodCols.has(c));
  const maqCol = maqKey ? prodCols.get(maqKey) : null;
  const loteCol = loteKey ? prodCols.get(loteKey) : null;
  const maqExpr = maqCol ? quoteIdent(maqCol) : 'NULL::text';
  const loteExpr = loteCol ? quoteIdent(loteCol) : 'NULL::text';

  const metragemNum = sqlParseNumberIntl('"METRAGEM"')
  const rupturasNum = sqlParseNumberIntl('"RUPTURAS"')
  const cavalosNum = sqlParseNumberIntl('"CAVALOS"')
  const velocNum = sqlParseNumberIntl('"VELOC"')
  const pontosLidosNum = sqlParseNumberIntl('"PONTOS_LIDOS"')
  const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"')
  const parTraNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
  const parUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')

  const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
  const calPontuacaoNum = sqlParseNumberIntl('"PONTUACAO"')
  const calLarguraNum = sqlParseNumberIntl('"LARGURA"')

  const sql = `
    WITH IND AS (
      SELECT
        "ROLADA" AS ROLADA,
        MAX("DT_BASE_PRODUCAO") AS FECHA,
        MAX("ARTIGO") AS BASE,
        string_agg(DISTINCT "COR", ', ') AS COLOR,
        SUM(${metragemNum}) AS MTS_IND,
        SUM(${rupturasNum}) AS RUPTURAS,
        SUM(${cavalosNum}) AS CAV,
        MAX(${velocNum}) AS VEL_NOM,
        SUM(${metragemNum} * COALESCE(${velocNum}, 0)) / NULLIF(SUM(${metragemNum}), 0) AS VEL_PROM
      FROM tb_produccion
      WHERE "SELETOR" = 'INDIGO'
        AND "FILIAL" = '05'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      GROUP BY "ROLADA"
    ),
    URD AS (
      SELECT
        "ROLADA" AS ROLADA,
        string_agg(
          DISTINCT CAST(
            NULLIF(regexp_replace(trim(right(${maqExpr}, 2)), '\\D', '', 'g'), '') AS INTEGER
          )::text,
          ', '
        ) AS MAQ_OE,
        string_agg(
          DISTINCT CAST(CAST(${loteCol ? sqlParseNumberIntl(loteExpr) : 'NULL::numeric'} AS INTEGER) AS TEXT),
          ', '
        ) AS LOTE,
        SUM(${metragemNum}) AS URDIDORA_METROS,
        SUM(${rupturasNum}) AS URDIDORA_ROTURAS,
        MAX(${sqlParseNumberIntl('"NUM_FIOS"')}) AS NUM_FIOS
      FROM tb_produccion
      WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA')
        AND "FILIAL" = '05'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    ),
    TEC AS (
      SELECT
        "ROLADA" AS ROLADA,
        SUM(${metragemNum}) AS MTS_CRUDOS,
        ROUND((SUM(COALESCE(${pontosLidosNum}, 0))::numeric / NULLIF(SUM(COALESCE(${puntos100Num}, 0)), 0)) * 100, 2) AS EFI_TEJ,
        SUM(${parTraNum}) AS PARADA_TRAMA,
        SUM(${parUrdNum}) AS PARADA_URD
      FROM tb_produccion
      WHERE "SELETOR" = 'TECELAGEM'
        AND "FILIAL" = '05'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    ),
    CAL AS (
      SELECT
        "ROLADA" AS ROLADA,
        SUM(${calMetragemNum}) AS MTS_CAL,
        SUM(CASE WHEN btrim("QUALIDADE") = 'PRIMEIRA' THEN ${calMetragemNum} ELSE 0 END) AS METROS_1ERA,
        SUM(COALESCE(${calPontuacaoNum}, 0)) AS PONTOS,
        AVG(${calLarguraNum}) AS LARGURA
      FROM tb_calidad
      WHERE "EMP" = 'STC'
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
        AND "ROLADA" IN (SELECT ROLADA FROM IND)
      GROUP BY "ROLADA"
    )
    SELECT
      IND.ROLADA AS "ROLADA",
      URD.MAQ_OE AS "MAQ_OE",
      URD.LOTE AS "LOTE",
      URD.URDIDORA_METROS AS "URDIDORA_METROS",
      URD.URDIDORA_ROTURAS AS "URDIDORA_ROTURAS",
      URD.NUM_FIOS AS "NUM_FIOS",
      IND.FECHA AS "FECHA",
      IND.BASE AS "BASE",
      IND.COLOR AS "COLOR",
      IND.MTS_IND AS "MTS_IND",
      ROUND(((IND.RUPTURAS * 1000) / NULLIF(IND.MTS_IND, 0))::numeric, 2) AS "R103",
      IND.CAV AS "CAV",
      IND.VEL_NOM AS "VEL_NOM",
      IND.VEL_PROM AS "VEL_PROM",
      TEC.MTS_CRUDOS AS "MTS_CRUDOS",
      TEC.EFI_TEJ AS "EFI_TEJ",
      ROUND(((TEC.PARADA_URD * 100000) / NULLIF(TEC.MTS_CRUDOS * 1000, 0))::numeric, 2) AS "RU105",
      ROUND(((TEC.PARADA_TRAMA * 100000) / NULLIF(TEC.MTS_CRUDOS * 1000, 0))::numeric, 2) AS "RT105",
      CAL.MTS_CAL AS "MTS_CAL",
      ROUND(((CAL.METROS_1ERA / NULLIF(CAL.MTS_CAL, 0)) * 100)::numeric, 1) AS "CAL_PERCENT",
      ROUND(((CAL.PONTOS * 100) / NULLIF((CAL.MTS_CAL * NULLIF(CAL.LARGURA, 0) / 100), 0))::numeric, 1) AS "PTS_100M2",
      IND.RUPTURAS AS "RUPTURAS"
    FROM IND
    LEFT JOIN URD ON URD.ROLADA = IND.ROLADA
    LEFT JOIN TEC ON TEC.ROLADA = IND.ROLADA
    LEFT JOIN CAL ON CAL.ROLADA = IND.ROLADA
    ORDER BY IND.ROLADA::int ASC
  `

  const result = await query(sql, [fechaInicio, fechaFin], 'seguimiento-roladas')
  const datos = result.rows || []

  const totales = datos.reduce(
    (acc, row) => {
      const mtsInd = Number(row.MTS_IND) || 0
      const mtsUrd = Number(row.URDIDORA_METROS) || 0
      const mtsTej = Number(row.MTS_CRUDOS) || 0
      const mtsCal = Number(row.MTS_CAL) || 0
      const rupturas = Number(row.RUPTURAS) || 0

      acc.TOTAL_ROLADAS += 1
      acc.MTS_IND += mtsInd
      acc.RUPTURAS += rupturas
      acc.CAV += Number(row.CAV) || 0
      acc.URDIDORA_METROS += mtsUrd
      acc.URDIDORA_ROTURAS += Number(row.URDIDORA_ROTURAS) || 0
      acc.NUM_FIOS_SUM += Number(row.NUM_FIOS) || 0
      acc.NUM_FIOS_COUNT += row.NUM_FIOS ? 1 : 0
      acc.MTS_CRUDOS += mtsTej
      acc.MTS_CAL += mtsCal

      acc.VEL_PROM_NUM += (Number(row.VEL_PROM) || 0) * mtsInd
      acc.EFI_TEJ_NUM += (Number(row.EFI_TEJ) || 0) * mtsTej
      acc.RU105_NUM += (Number(row.RU105) || 0) * mtsTej
      acc.RT105_NUM += (Number(row.RT105) || 0) * mtsTej
      acc.CAL_NUM += (Number(row.CAL_PERCENT) || 0) * mtsCal
      acc.PTS_NUM += (Number(row.PTS_100M2) || 0) * mtsCal
      return acc
    },
    {
      TOTAL_ROLADAS: 0,
      MTS_IND: 0,
      RUPTURAS: 0,
      CAV: 0,
      URDIDORA_METROS: 0,
      URDIDORA_ROTURAS: 0,
      NUM_FIOS_SUM: 0,
      NUM_FIOS_COUNT: 0,
      MTS_CRUDOS: 0,
      MTS_CAL: 0,
      VEL_PROM_NUM: 0,
      EFI_TEJ_NUM: 0,
      RU105_NUM: 0,
      RT105_NUM: 0,
      CAL_NUM: 0,
      PTS_NUM: 0
    }
  )

  const totalesMes = {
    TOTAL_ROLADAS: totales.TOTAL_ROLADAS,
    MTS_IND: totales.MTS_IND,
    R103: totales.MTS_IND ? (totales.RUPTURAS * 1000) / totales.MTS_IND : null,
    CAV: totales.CAV,
    VEL_PROM: totales.MTS_IND ? totales.VEL_PROM_NUM / totales.MTS_IND : null,
    URDIDORA_METROS: totales.URDIDORA_METROS,
    URDIDORA_ROTURAS: totales.URDIDORA_ROTURAS,
    NUM_FIOS: totales.NUM_FIOS_COUNT ? totales.NUM_FIOS_SUM / totales.NUM_FIOS_COUNT : null,
    MTS_CRUDOS: totales.MTS_CRUDOS,
    EFI_TEJ: totales.MTS_CRUDOS ? totales.EFI_TEJ_NUM / totales.MTS_CRUDOS : null,
    RU105: totales.MTS_CRUDOS ? totales.RU105_NUM / totales.MTS_CRUDOS : null,
    RT105: totales.MTS_CRUDOS ? totales.RT105_NUM / totales.MTS_CRUDOS : null,
    MTS_CAL: totales.MTS_CAL,
    CAL_PERCENT: totales.MTS_CAL ? totales.CAL_NUM / totales.MTS_CAL : null,
    PTS_100M2: totales.MTS_CAL ? totales.PTS_NUM / totales.MTS_CAL : null
  }

  return { datos, totales: totalesMes }
}

app.get('/api/seguimiento-roladas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })
    }

    const payload = await getSeguimientoRoladasData(fechaInicio, fechaFin)
    res.json(payload)
  } catch (err) {
    console.error('Error en seguimiento-roladas:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/seguimiento-roladas-fibra', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })
    }

    const { datos, totales } = await getSeguimientoRoladasData(fechaInicio, fechaFin)

    const lotes = Array.from(
      new Set(
        (datos || [])
          .map((d) => String(d.LOTE || '').split(',')[0].trim())
          .filter(Boolean)
      )
    )

    let hviMap = {}
    if (lotes.length > 0) {
      // Use logical comparison for LOTE_FIAC (strip leading zeros in DB)
      const sql = `
        SELECT
          "LOTE" AS "LOTE",
          "LOTE_FIAC" AS "LOTE_FIAC",
          "MISTURA" AS "MISTURA",
          "COR" AS "COR",
          "DT_ENTRADA_PROD" AS "FECHA_INGRESO",
          ${sqlParseNumber('"SCI"')} AS "SCI",
          ${sqlParseNumber('"MST"')} AS "MST",
          ${sqlParseNumber('"MIC"')} AS "MIC",
          ${sqlParseNumber('"MAT"')} AS "MAT",
          ${sqlParseNumber('"UHML"')} AS "UHML",
          ${sqlParseNumber('"UI"')} AS "UI",
          ${sqlParseNumber('"SF"')} AS "SF",
          ${sqlParseNumber('"STR"')} AS "STR",
          ${sqlParseNumber('"ELG"')} AS "ELG",
          ${sqlParseNumber('"RD"')} AS "RD",
          ${sqlParseNumber('"PLUS_B"')} AS "PLUS_B",
          ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
          ${sqlParseNumber('"TrAR"')} AS "TrAR",
          ${sqlParseNumber('"TRID"')} AS "TRID",
          CASE 
            WHEN "PESO" IS NULL OR "PESO" = '' THEN 0
            ELSE CAST(REPLACE(REPLACE("PESO", '.', ''), ',', '.') AS NUMERIC)
          END AS "PESO"
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "MISTURA" IS NOT NULL
          AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)::TEXT = ANY($1::text[])
      `
      
      const hviRows = await query(sql, [lotes], 'seguimiento-roladas-fibra-hvi')
      
      // Use numeric/short string key for map
      hviMap = hviRows.rows.reduce((acc, row) => {
        // Normalize keys to short string (e.g. "104")
        // ONLY use LOTE_FIAC as key, matching legacy system
        const k2 = String(row.LOTE_FIAC || '').replace(/^0+/, '').trim()
        
        // Prefer LOTE_FIAC (normalized) as canonical key
        const primaryKey = k2
        
        if (!primaryKey) return acc


        if (!acc[primaryKey]) {
          acc[primaryKey] = { 
             ...row, 
             MISTURA: [],
             FECHA_INGRESO: [],
             _peso: 0, 
             _sum: {},
             _dist: {},
             _colors: {}
          }
        }
        
        const target = acc[primaryKey]
        
        // Collect Metadata (Set-like behavior) WITH normalization
        if (row.MISTURA) {
          const m = String(row.MISTURA).replace(/^0+/, '')
          if (m && !target.MISTURA.includes(m)) target.MISTURA.push(m)
        }
        if (row.FECHA_INGRESO) {
          const d = row.FECHA_INGRESO instanceof Date
            ? row.FECHA_INGRESO.toISOString().split('T')[0]
            : String(row.FECHA_INGRESO).split('T')[0]
          if (d && !target.FECHA_INGRESO.includes(d)) target.FECHA_INGRESO.push(d)
        }

        const peso = Number(row.PESO) || 0
        target._peso += peso

        // Color weights
        const cor = String(row.COR || '').toUpperCase().trim()
        if (cor) {
             target._colors[cor] = (target._colors[cor] || 0) + peso
        }

        for (const k of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
          const val = Number(row[k])
          if (!isNaN(val)) {
            target._sum[k] = (target._sum[k] || 0) + val * peso
            // Collect distribution for stats
            if (!target._dist[k]) target._dist[k] = []
            target._dist[k].push(val)
          }
        }
        
        // Ensure strictly padded or unpadded lookups work
        // if (k1) acc[k1] = target // Removed to ensure we STRICTLY use LOTE_FIAC
        if (k2) acc[k2] = target
        
        return acc
      }, {})

      // Finalize weighted averages in the map items
      // Note: multiple keys point to the same object, so calculate once per object
      const processedObjects = new Set()
      for (const key of Object.keys(hviMap)) {
        const item = hviMap[key]
        if (processedObjects.has(item)) continue
        processedObjects.add(item)

        const peso = item._peso || 0
        for (const k of Object.keys(item._sum)) {
          item[k] = peso ? item._sum[k] / peso : null

          // Calculate MIN, MAX, SIGMA
          const vals = item._dist ? (item._dist[k] || []) : []
          if (vals.length > 0) {
              item[`${k}_MIN`] = Math.min(...vals)
              item[`${k}_MAX`] = Math.max(...vals)
              const n = vals.length
              const simpleMean = vals.reduce((a,b)=>a+b,0)/n
              const variance = vals.reduce((a,b) => a + Math.pow(b - simpleMean, 2), 0) / (n > 1 ? n - 1 : 1)
              item[`${k}_SIGMA`] = Math.sqrt(variance)
          } else {
              item[`${k}_MIN`] = null
              item[`${k}_MAX`] = null
              item[`${k}_SIGMA`] = null
          }
        }
        
        // Calculate Colors
        if (peso > 0 && item._colors) {
            item.COLOR_BCO_PCT = (item._colors['BCO'] || 0) / peso * 100
            item.COLOR_GRI_PCT = (item._colors['GRI'] || 0) / peso * 100
            item.COLOR_LG_PCT = (item._colors['LG'] || 0) / peso * 100
            item.COLOR_AMA_PCT = (item._colors['AMA'] || 0) / peso * 100
            item.COLOR_LA_PCT = (item._colors['LA'] || 0) / peso * 100
        }
      }
    }

    const datosConFibra = (datos || []).map((row) => {
      // Find all HVI data for comma-separated lotes
      const loteKeys = String(row.LOTE || '').split(',').map(s => s.trim().replace(/^0+/, '')).filter(Boolean)
      
      // Collect valid hvi objects
      const found = loteKeys.map(k => hviMap[k]).filter(item => item && item.SCI !== undefined)
      
      const resultHvi = {
        MISTURA: null, FECHA_INGRESO: null,
        SCI: null, MST: null, MIC: null, MAT: null, UHML: null, UI: null, 
        SF: null, STR: null, ELG: null, RD: null, PLUS_B: null, 
        TrCNT: null, TrAR: null, TRID: null
      }

      if (found.length > 0) {
        // Aggregate metadata from all matched lote items
        const allMisturas = new Set()
        const allFechas = new Set()
        
        found.forEach(item => {
             if (Array.isArray(item.MISTURA)) item.MISTURA.forEach(m => allMisturas.add(m))
             else if (item.MISTURA) allMisturas.add(item.MISTURA)

             if (Array.isArray(item.FECHA_INGRESO)) item.FECHA_INGRESO.forEach(f => allFechas.add(f))
             else if (item.FECHA_INGRESO) allFechas.add(item.FECHA_INGRESO)
        })
        
        resultHvi.MISTURA = Array.from(allMisturas).join(',')
        
        // Sort dates to pick the earliest? Or just join them?
        // Reference uses MIN(FECHA_INGRESO)
        const sortedFechas = Array.from(allFechas).sort((a,b) => {
             const ma = a.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
             const mb = b.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
             if (ma && mb) {
                 const ka = `${ma[3]}${ma[2]}${ma[1]}`
                 const kb = `${mb[3]}${mb[2]}${mb[1]}`
                 return ka.localeCompare(kb)
             }
             return a.localeCompare(b)
        })
        resultHvi.FECHA_INGRESO = sortedFechas[0] || null

        // Average the numeric fields
        const keys = ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']
        keys.forEach(k => {
          const validValues = found.map(f => f[k]).filter(v => v !== null && v !== undefined)
          if (validValues.length > 0) {
             const sum = validValues.reduce((a,b) => a+b, 0)
             resultHvi[k] = sum / validValues.length
          }

          // Min of Mins
          const mins = found.map(f => f[`${k}_MIN`]).filter(v => v !== null && v !== undefined)
          if (mins.length > 0) resultHvi[`${k}_MIN`] = Math.min(...mins)

          // Max of Maxs
          const maxs = found.map(f => f[`${k}_MAX`]).filter(v => v !== null && v !== undefined)
          if (maxs.length > 0) resultHvi[`${k}_MAX`] = Math.max(...maxs)

          // Avg of Sigmas (Simple approximation)
          const sigmas = found.map(f => f[`${k}_SIGMA`]).filter(v => v !== null && v !== undefined)
          if (sigmas.length > 0) resultHvi[`${k}_SIGMA`] = sigmas.reduce((a,b)=>a+b,0) / sigmas.length
        })

        // Colors
        const colors = ['COLOR_BCO_PCT', 'COLOR_GRI_PCT', 'COLOR_LG_PCT', 'COLOR_AMA_PCT', 'COLOR_LA_PCT']
        colors.forEach(k => {
            const vals = found.map(f => f[k]).filter(v => v !== null && v !== undefined)
            if (vals.length > 0) resultHvi[k] = vals.reduce((a,b) => a+b, 0) / vals.length
        })
      }

      return {
        ...row,
        ...resultHvi
      }
    })

    res.json({ datos: datosConFibra, totales })
  } catch (err) {
    console.error('Error en seguimiento-roladas-fibra:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/hvi-estadisticas-mezcla', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const sql = `
      SELECT
        "MISTURA" AS MISTURA,
        ${sqlParseNumber('"SCI"')} AS SCI,
        ${sqlParseNumber('"MST"')} AS MST,
        ${sqlParseNumber('"MIC"')} AS MIC,
        ${sqlParseNumber('"MAT"')} AS MAT,
        ${sqlParseNumber('"UHML"')} AS UHML,
        ${sqlParseNumber('"UI"')} AS UI,
        ${sqlParseNumber('"SF"')} AS SF,
        ${sqlParseNumber('"STR"')} AS STR,
        ${sqlParseNumber('"ELG"')} AS ELG,
        ${sqlParseNumber('"RD"')} AS RD,
        ${sqlParseNumber('"PLUS_B"')} AS PLUS_B,
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID",
        ${sqlParseNumber('"PESO"')} AS PESO
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND ${sqlParseDate('"DT_ENTRADA_PROD"')} BETWEEN $1::date AND $2::date
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'hvi-estadisticas-mezcla')).rows
    const stats = {}

    for (const row of rows) {
      const mistura = String(row.MISTURA || '').trim()
      if (!mistura) continue
      if (!stats[mistura]) stats[mistura] = { N: 0 }
      const target = stats[mistura]
      target.N += 1

      for (const key of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
        const val = Number(row[key])
        if (isNaN(val)) continue
        const k = key === 'PLUS_B' ? 'PLUS_B' : key
        if (!target[k]) target[k] = { values: [] }
        target[k].values.push(val)
      }
    }

    for (const mistura of Object.keys(stats)) {
      const target = stats[mistura]
      for (const key of Object.keys(target)) {
        if (key === 'N') continue
        const vals = target[key].values || []
        if (!vals.length) {
          target[key] = { MIN: null, MAX: null, DESV: null }
          continue
        }
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        const desv = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length)
        target[key] = { MIN: min, MAX: max, DESV: desv }
      }
    }

    res.json({ stats })
  } catch (err) {
    console.error('Error en hvi-estadisticas-mezcla:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/calidad-fibra-mistura', async (req, res) => {
  try {
    const misturaRaw = String(req.query.mistura || '').trim()
    if (!misturaRaw) return res.status(400).json({ error: 'mistura requerida' })

    const mistura = misturaRaw.padStart(10, '0')
    const sql = `
      SELECT
        "MISTURA" AS MISTURA,
        "SEQ" AS SEQ,
        "DT_ENTRADA_PROD" AS "DT_ENTRADA_PROD",
        "HR_ENTRADA_PROD" AS "HR_ENTRADA_PROD",
        ${sqlParseNumber('"SCI"')} AS SCI,
        ${sqlParseNumber('"MST"')} AS MST,
        ${sqlParseNumber('"MIC"')} AS MIC,
        ${sqlParseNumber('"MAT"')} AS MAT,
        ${sqlParseNumber('"UHML"')} AS UHML,
        ${sqlParseNumber('"UI"')} AS UI,
        ${sqlParseNumber('"SF"')} AS SF,
        ${sqlParseNumber('"STR"')} AS STR,
        ${sqlParseNumber('"ELG"')} AS ELG,
        ${sqlParseNumber('"RD"')} AS RD,
        ${sqlParseNumber('"PLUS_B"')} AS PLUS_B,
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID",
        ${sqlParseNumber('"PESO"')} AS PESO
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST' AND ("MISTURA" = $1 OR "MISTURA" = $2)
    `

    const rows = (await query(sql, [misturaRaw, mistura], 'calidad-fibra-mistura')).rows
    if (!rows.length) return res.json({ mistura: misturaRaw, seqs: [], totales: {} })

    const seqs = {}
    const totales = { sumPeso: 0, sum: {} }

    for (const row of rows) {
      const seq = String(row.SEQ || '').trim()
      if (!seqs[seq]) {
        seqs[seq] = { SEQ: seq, DT_ENTRADA_PROD: row.DT_ENTRADA_PROD, HR_ENTRADA_PROD: row.HR_ENTRADA_PROD, sumPeso: 0, sum: {} }
      }
      const peso = Number(row.PESO) || 0
      seqs[seq].sumPeso += peso
      totales.sumPeso += peso
      for (const key of ['SCI','MST','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','TrCNT','TrAR','TRID']) {
        const val = Number(row[key])
        if (isNaN(val)) continue
        seqs[seq].sum[key] = (seqs[seq].sum[key] || 0) + val * peso
        totales.sum[key] = (totales.sum[key] || 0) + val * peso
      }
    }

    const seqsOut = Object.values(seqs).map((s) => {
      const out = { SEQ: s.SEQ, DT_ENTRADA_PROD: s.DT_ENTRADA_PROD, HR_ENTRADA_PROD: s.HR_ENTRADA_PROD }
      for (const key of Object.keys(s.sum)) {
        out[key === 'PLUS_B' ? '+b' : key] = s.sumPeso ? s.sum[key] / s.sumPeso : null
      }
      return out
    })

    const totalesOut = {}
    for (const key of Object.keys(totales.sum)) {
      totalesOut[key === 'PLUS_B' ? '+b' : key] = totales.sumPeso ? totales.sum[key] / totales.sumPeso : null
    }

    res.json({ mistura: misturaRaw, seqs: seqsOut, totales: totalesOut })
  } catch (err) {
    console.error('Error en calidad-fibra-mistura:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-calidad', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const metragemNum = sqlParseNumber('"METRAGEM"')
    const pontuacaoNum = sqlParseNumber('"PONTUACAO"')
    const larguraNum = sqlParseNumber('"LARGURA"')
    const sql = `
      SELECT
        ${sqlParseDate('"DAT_PROD"')} AS "FECHA_DB",
        "DAT_PROD" AS "FECHA",
        SUM(${metragemNum}) AS "METROS_TOTAL",
        SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
        SUM(COALESCE(${pontuacaoNum}, 0)) AS "PONTOS",
        AVG(${larguraNum}) AS "LARGURA"
      FROM tb_calidad
      WHERE "EMP" = 'STC'
        AND "QUALIDADE" NOT ILIKE '%RETALHO%'
        AND ${sqlParseDate('"DAT_PROD"')} BETWEEN $1::date AND $2::date
      GROUP BY "FECHA_DB", "FECHA"
      ORDER BY "FECHA_DB" ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-calidad')).rows
    const datos = rows.map((r) => {
      const calPct = r.METROS_TOTAL ? (Number(r.METROS_1ERA) / Number(r.METROS_TOTAL)) * 100 : null
      const pts100 = r.METROS_TOTAL && r.LARGURA
        ? (Number(r.PONTOS) * 100) / (Number(r.METROS_TOTAL) * Number(r.LARGURA) / 100)
        : null
      return {
        FECHA_DB: r.FECHA_DB,
        FECHA: r.FECHA,
        CALIDAD_PERCENT: calPct,
        PTS_100M2: pts100,
        METROS_1ERA: r.METROS_1ERA,
        METROS_TOTAL: r.METROS_TOTAL,
        ROLLOS: null
      }
    })

    const rangos = {}
    for (const key of ['CALIDAD_PERCENT', 'PTS_100M2', 'METROS_1ERA', 'METROS_TOTAL']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-calidad:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-produccion', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const metragemNum = sqlParseNumber('"METRAGEM"')
    const rupturasNum = sqlParseNumber('"RUPTURAS"')
    const numFiosNum = sqlParseNumber('"NUM_FIOS"')
    const velocNum = sqlParseNumber('"VELOC"')
    const eficienciaClean = `regexp_replace("EFICIENCIA", '[^0-9,.-]', '', 'g')`
    const eficienciaNum = sqlParseNumberIntl(eficienciaClean)
    const puntosLidosNum = sqlParseNumber('"PONTOS_LIDOS"')
    const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"')
    const parTraNum = sqlParseNumber('"PARADA TEC TRAMA"')
    const parUrdNum = sqlParseNumber('"PARADA TEC URDUME"')

    const sql = `
      WITH BASE AS (
        SELECT
          ${sqlParseDate('"DT_BASE_PRODUCAO"')} AS FECHA_DB,
          "DT_BASE_PRODUCAO" AS FECHA,
          "SELETOR" AS SELETOR,
          ${metragemNum} AS METRAGEM,
          ${rupturasNum} AS RUPTURAS,
          ${numFiosNum} AS NUM_FIOS,
          ${velocNum} AS VELOC,
          CASE
            WHEN ${eficienciaNum} IS NULL OR ${eficienciaNum} = 0 THEN
              (${puntosLidosNum} * 100) / NULLIF(${puntos100Num}, 0)
            ELSE ${eficienciaNum}
          END AS EFICIENCIA,
          ${parTraNum} AS PARADA_TRAMA,
          ${parUrdNum} AS PARADA_URD
        FROM tb_produccion
        WHERE "FILIAL" = '05'
          AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
      )
      SELECT
        FECHA_DB AS "FECHA_DB",
        FECHA AS "FECHA",
        SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (RUPTURAS * 1000000) ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (METRAGEM * NUM_FIOS) ELSE 0 END), 0) AS "RU106_URDIDORA",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END) AS "METROS_INDIGO",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN RUPTURAS ELSE 0 END) * 1000
          / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "R103_INDIGO",
        SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM * VELOC ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "VELOCIDAD_INDIGO",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM * EFICIENCIA ELSE 0 END)
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END), 0) AS "EFICIENCIA_TELAR",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_URD ELSE 0 END) * 100000
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RU105_TELAR",
        SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_TRAMA ELSE 0 END) * 100000
          / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RT105_TELAR"
      FROM BASE
      GROUP BY FECHA_DB, FECHA
      ORDER BY FECHA_DB ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-produccion')).rows
    const datos = rows.map((r) => ({
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      RU106_URDIDORA: r.RU106_URDIDORA,
      METROS_INDIGO: r.METROS_INDIGO,
      R103_INDIGO: r.R103_INDIGO,
      VELOCIDAD_INDIGO: r.VELOCIDAD_INDIGO,
      EFICIENCIA_TELAR: r.EFICIENCIA_TELAR,
      RU105_TELAR: r.RU105_TELAR,
      RT105_TELAR: r.RT105_TELAR
    }))

    const rangos = {}
    for (const key of ['RU106_URDIDORA','METROS_INDIGO','R103_INDIGO','VELOCIDAD_INDIGO','EFICIENCIA_TELAR','RU105_TELAR','RT105_TELAR']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-produccion:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/metricas-diarias-fibra', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const pesoNum = sqlParseNumber('"PESO"')
    const sql = `
      WITH BASE AS (
        SELECT
          ${sqlParseDate('"DT_ENTRADA_PROD"')} AS FECHA_DB,
          "DT_ENTRADA_PROD" AS FECHA,
          ${pesoNum} AS PESO,
          ${sqlParseNumber('"SCI"')} AS SCI,
          ${sqlParseNumber('"MIC"')} AS MIC,
          ${sqlParseNumber('"MAT"')} AS MAT,
          ${sqlParseNumber('"UHML"')} AS UHML,
          ${sqlParseNumber('"UI"')} AS UI,
          ${sqlParseNumber('"SF"')} AS SF,
          ${sqlParseNumber('"STR"')} AS STR,
          ${sqlParseNumber('"ELG"')} AS ELG,
          ${sqlParseNumber('"RD"')} AS RD,
          ${sqlParseNumber('"PLUS_B"')} AS PLUS_B
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND ${sqlParseDate('"DT_ENTRADA_PROD"')} BETWEEN $1::date AND $2::date
      )
      SELECT
        FECHA_DB AS "FECHA_DB",
        FECHA AS "FECHA",
        SUM(PESO) AS "PESO_TOTAL",
        SUM(SCI * PESO) / NULLIF(SUM(PESO), 0) AS "SCI",
        SUM(MIC * PESO) / NULLIF(SUM(PESO), 0) AS "MIC",
        SUM(MAT * PESO) / NULLIF(SUM(PESO), 0) AS "MAT",
        SUM(UHML * PESO) / NULLIF(SUM(PESO), 0) AS "UHML",
        SUM(UI * PESO) / NULLIF(SUM(PESO), 0) AS "UI",
        SUM(SF * PESO) / NULLIF(SUM(PESO), 0) AS "SF",
        SUM(STR * PESO) / NULLIF(SUM(PESO), 0) AS "STR",
        SUM(ELG * PESO) / NULLIF(SUM(PESO), 0) AS "ELG",
        SUM(RD * PESO) / NULLIF(SUM(PESO), 0) AS "RD",
        SUM(PLUS_B * PESO) / NULLIF(SUM(PESO), 0) AS "PLUS_B"
      FROM BASE
      GROUP BY FECHA_DB, FECHA
      ORDER BY FECHA_DB ASC
    `

    const rows = (await query(sql, [fechaInicio, fechaFin], 'metricas-diarias-fibra')).rows
    const datos = rows.map((r) => ({
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      SCI: r.SCI,
      MIC: r.MIC,
      MAT: r.MAT,
      UHML: r.UHML,
      UI: r.UI,
      SF: r.SF,
      STR: r.STR,
      ELG: r.ELG,
      RD: r.RD,
      PLUS_B: r.PLUS_B,
      PESO_TOTAL: r.PESO_TOTAL
    }))

    const rangos = {}
    for (const key of ['SCI','MIC','MAT','UHML','UI','SF','STR','ELG','RD','PLUS_B','PESO_TOTAL']) {
      const vals = datos.map((d) => Number(d[key])).filter((v) => !isNaN(v))
      if (!vals.length) continue
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      rangos[key] = { min, max, avg }
    }

    res.json({ datos, rangos, totalDias: datos.length })
  } catch (err) {
    console.error('Error en metricas-diarias-fibra:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/informe-produccion-indigo', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    if (!fechaInicio || !fechaFin) return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' })

    const produccionColumns = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tb_produccion'`,
      [],
      'tb-produccion-columns-informe'
    )
    const prodCols = new Map(
      (produccionColumns.rows || []).map((r) => [String(r.column_name).toLowerCase(), r.column_name])
    )
    const maqKey = ['maq  fiacao', 'maq fiacao'].find((c) => prodCols.has(c))
    const loteKey = ['lote fiacao', 'lote  fiacao'].find((c) => prodCols.has(c))
    const maqCol = maqKey ? prodCols.get(maqKey) : null
    const loteCol = loteKey ? prodCols.get(loteKey) : null
    const maqExpr = maqCol ? `p.${quoteIdent(maqCol)}` : 'NULL::text'
    const loteExpr = loteCol ? `p.${quoteIdent(loteCol)}` : 'NULL::text'
    const maqFilter = maqCol ? `${maqExpr} IS NOT NULL` : '1=1'
    const loteFilter = loteCol ? `${loteExpr} IS NOT NULL` : '1=1'

    const metragemIndNum = sqlParseNumberIntl('"METRAGEM"')
    const metragemUrdNum = sqlParseNumberIntl('p."METRAGEM"')
    const rupturasIndNum = sqlParseNumberIntl('"RUPTURAS"')
    const rupturasUrdNum = sqlParseNumberIntl('p."RUPTURAS"')
    const cavalosNum = sqlParseNumberIntl('"CAVALOS"')
    const velocNum = sqlParseNumberIntl('"VELOC"')
    const numFiosNum = sqlParseNumberIntl('"NUM_FIOS"')
    const pontosLidosNum = sqlParseNumberIntl('"PONTOS_LIDOS"')
    const pontos100Num = sqlParseNumberIntl('"PONTOS_100%"')
    const parTraNum = sqlParseNumberIntl('"PARADA TEC TRAMA"')
    const parUrdNum = sqlParseNumberIntl('"PARADA TEC URDUME"')

    const calMetragemNum = sqlParseNumberIntl('"METRAGEM"')
    const calPontuacaoNum = sqlParseNumberIntl('"PONTUACAO"')
    const calLarguraNum = sqlParseNumberIntl('"LARGURA"')

    const makeTimestampExpr = (dateCol, timeCol) => {
      const dateExpr = sqlParseDate(dateCol)
      return `(
        CASE
          WHEN ${dateExpr} IS NULL THEN NULL
          ELSE to_timestamp(
            to_char(${dateExpr}, 'YYYY-MM-DD') || ' ' || COALESCE(
              CASE
                WHEN ${timeCol} ~ '^[0-2][0-9]:[0-5][0-9]$' THEN ${timeCol} || ':00'
                WHEN ${timeCol} ~ '^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$' THEN ${timeCol}
                ELSE NULL
              END,
              '00:00:00'
            ),
            'YYYY-MM-DD HH24:MI:SS'
          )
        END
      )`
    }

    const urdStartTs = makeTimestampExpr('p."DT_INICIO"', 'p."HORA_INICIO"')
    const urdEndTs = makeTimestampExpr('p."DT_FINAL"', 'p."HORA_FINAL"')
    const indStartTs = makeTimestampExpr('"DT_INICIO"', '"HORA_INICIO"')
    const indEndTs = makeTimestampExpr('"DT_FINAL"', '"HORA_FINAL"')

    const sql = `
      WITH RoladaBase AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          MIN(${sqlParseDate('"DT_INICIO"')}) AS FECHA_INICIO,
          "ARTIGO" AS ARTIGO
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA", "COR", "ARTIGO"
      ),
      NumFiosPorRolada AS (
        SELECT
          ROLADA,
          SUM(NUM_FIOS_MAX) AS NUM_FIOS_SUM
        FROM (
          SELECT
            "ROLADA" AS ROLADA,
            "PARTIDA" AS PARTIDA,
            MAX(${numFiosNum}) AS NUM_FIOS_MAX
          FROM tb_produccion
          WHERE "SELETOR" = 'URDIDEIRA'
            AND "ROLADA" IS NOT NULL
            AND "PARTIDA" IS NOT NULL
            AND "NUM_FIOS" IS NOT NULL
          GROUP BY "ROLADA", "PARTIDA"
        ) AS nf
        GROUP BY ROLADA
      ),
      UrdideiraMetrics AS (
        SELECT
          p."ROLADA" AS ROLADA,
          MIN(${sqlParseDate('p."DT_INICIO"')}) AS FECHA_URDIDORA,
          string_agg(
            DISTINCT CAST(
              NULLIF(regexp_replace(trim(right(${maqExpr}, 2)), '\\D', '', 'g'), '') AS INTEGER
            )::text,
            ', '
          ) AS MAQ_OE,
          string_agg(
            DISTINCT CAST(CAST(${loteCol ? sqlParseNumberIntl(loteExpr) : 'NULL::numeric'} AS INTEGER) AS TEXT),
            ', '
          ) AS LOTE,
          SUM(${metragemUrdNum}) / NULLIF(COUNT(DISTINCT p."PARTIDA"), 0) AS METRAGEM_AVG,
          SUM(${rupturasUrdNum}) AS RUPTURAS_TOTAL,
          MIN(${urdStartTs}) AS INICIO_MIN,
          MAX(${urdEndTs}) AS FIN_MAX
        FROM tb_produccion p
        WHERE p."SELETOR" = 'URDIDEIRA'
          AND p."ROLADA" IS NOT NULL
          AND p."ROLADA" <> ''
          AND ${maqFilter}
          AND ${loteFilter}
        GROUP BY p."ROLADA"
      ),
      RoladaMetrics AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          SUM(${metragemIndNum}) AS METRAGEM_TOTAL,
          SUM(${rupturasIndNum}) AS RUPTURAS_TOTAL,
          SUM(${cavalosNum}) AS CAVALOS_TOTAL,
          SUM(${metragemIndNum} * COALESCE(${velocNum}, 0)) AS VELOC_POND_NUM,
          MIN(${indStartTs}) AS INICIO_MIN,
          MAX(${indEndTs}) AS FIN_MAX
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA", "COR"
      ),
      RoladaCalidad AS (
        SELECT
          "ROLADA" AS ROLADA,
          "COR" AS COR,
          COUNT(DISTINCT CASE WHEN "S" = 'N' THEN "PARTIDA" || '_' || "S" END) AS N_COUNT,
          COUNT(DISTINCT CASE WHEN "S" = 'P' THEN "PARTIDA" || '_' || "S" END) AS P_COUNT,
          COUNT(DISTINCT CASE WHEN "S" = 'Q' THEN "PARTIDA" || '_' || "S" END) AS Q_COUNT,
          COUNT(DISTINCT "PARTIDA" || '_' || "S") AS TOTAL_COUNT
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
          AND "PARTIDA" IS NOT NULL
          AND "S" IS NOT NULL
        GROUP BY "ROLADA", "COR"
      ),
      TecelagemMetrics AS (
        SELECT
          "ROLADA" AS ROLADA,
          SUM(${metragemIndNum}) AS METRAGEM_TOTAL,
          SUM(${pontosLidosNum}) AS PONTOS_LIDOS_TOTAL,
          SUM(${pontos100Num}) AS PONTOS_100_TOTAL,
          SUM(${parTraNum}) AS PARADA_TRAMA_TOTAL,
          SUM(${parUrdNum}) AS PARADA_URDUME_TOTAL
        FROM tb_produccion
        WHERE "SELETOR" = 'TECELAGEM'
          AND "ROLADA" IS NOT NULL
          AND "ROLADA" <> ''
        GROUP BY "ROLADA"
      ),
      CalidadMetrics AS (
        SELECT
          CAL_M.ROLADA,
          CAL_M.MTS_CAL,
          CAL_M.CAL_PERCENT,
          ROUND(
            ((PTS.PUNTOS * 100.0) / NULLIF((PTS.MTS_1ERA * PTS.ANC_POND), 0))::numeric,
            1
          ) AS PTS_100M2
        FROM (
          SELECT
            "ROLADA" AS ROLADA,
            SUM(${calMetragemNum}) AS MTS_CAL,
            ROUND(
              (SUM(CASE WHEN btrim("QUALIDADE") = 'PRIMEIRA' THEN ${calMetragemNum} ELSE 0 END) * 100.0) /
              NULLIF(SUM(${calMetragemNum}), 0),
              1
            ) AS CAL_PERCENT
          FROM tb_calidad
          WHERE "EMP" = 'STC'
            AND "ROLADA" IS NOT NULL
            AND "ROLADA" <> ''
          GROUP BY "ROLADA"
        ) AS CAL_M
        LEFT JOIN (
          SELECT
            "ROLADA" AS ROLADA,
            SUM(${calMetragemNum}) AS MTS_1ERA,
            SUM(${calPontuacaoNum}) AS PUNTOS,
            SUM(${calMetragemNum} * ${calLarguraNum}) / NULLIF(SUM(${calMetragemNum}), 0) / 100.0 AS ANC_POND
          FROM tb_calidad
          WHERE "EMP" = 'STC'
            AND btrim("QUALIDADE") = 'PRIMEIRA'
            AND "ROLADA" IS NOT NULL
            AND "ROLADA" <> ''
          GROUP BY "ROLADA"
        ) AS PTS ON CAL_M.ROLADA = PTS.ROLADA
      )
      SELECT
        rb.ROLADA AS "ROLADA",
        to_char(um.FECHA_URDIDORA, 'DD/MM/YYYY') AS "FECHA_URDIDORA",
        um.MAQ_OE AS "MAQ_OE",
        um.LOTE AS "LOTE",
        ROUND(um.METRAGEM_AVG, 3) AS "URDIDORA_M",
        um.RUPTURAS_TOTAL AS "URDIDORA_ROT_TOT",
        ROUND(
          ((CAST(um.RUPTURAS_TOTAL AS REAL) * 1000000.0) /
          NULLIF((um.METRAGEM_AVG * nf.NUM_FIOS_SUM), 0))::numeric,
          6
        ) AS "URDIDORA_ROT_106",
        CAST(EXTRACT(EPOCH FROM (um.FIN_MAX - um.INICIO_MIN)) / 60 AS INTEGER) AS "URDIDORA_TIEMPO_MIN",
        to_char(rb.FECHA_INICIO, 'DD/MM/YYYY') AS "FECHA_INDIGO",
        rb.COR AS "COR",
        rb.ARTIGO AS "ARTIGO",
        ROUND(rm.METRAGEM_TOTAL, 3) AS "METRAGEM",
        rm.RUPTURAS_TOTAL AS "RUPTURAS",
        ROUND(((CAST(rm.RUPTURAS_TOTAL AS REAL) * 1000.0) / NULLIF(rm.METRAGEM_TOTAL, 0))::numeric, 2) AS "ROT_103",
        ROUND(rm.CAVALOS_TOTAL, 1) AS "CAVALOS",
        ROUND((rm.VELOC_POND_NUM / NULLIF(rm.METRAGEM_TOTAL, 0))::numeric, 2) AS "VELOC_PROMEDIO",
        CAST(EXTRACT(EPOCH FROM (rm.FIN_MAX - rm.INICIO_MIN)) / 60 AS INTEGER) AS "TIEMPO_MINUTOS",
        COALESCE(rc.N_COUNT, 0) AS "N_COUNT",
        ROUND(((CAST(COALESCE(rc.N_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "N_PERCENT",
        COALESCE(rc.P_COUNT, 0) AS "P_COUNT",
        ROUND(((CAST(COALESCE(rc.P_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "P_PERCENT",
        COALESCE(rc.Q_COUNT, 0) AS "Q_COUNT",
        ROUND(((CAST(COALESCE(rc.Q_COUNT, 0) AS REAL) * 100.0) / NULLIF(rc.TOTAL_COUNT, 0))::numeric, 1) AS "Q_PERCENT",
        ROUND(tm.METRAGEM_TOTAL, 0) AS "TECELAGEM_METROS",
        ROUND(((tm.PONTOS_LIDOS_TOTAL * 100.0) / NULLIF(tm.PONTOS_100_TOTAL, 0))::numeric, 1) AS "TECELAGEM_EFICIENCIA",
        ROUND(((tm.PARADA_TRAMA_TOTAL * 100000.0) / NULLIF((tm.PONTOS_LIDOS_TOTAL * 1000.0), 0))::numeric, 2) AS "RT105",
        ROUND(((tm.PARADA_URDUME_TOTAL * 100000.0) / NULLIF((tm.PONTOS_LIDOS_TOTAL * 1000.0), 0))::numeric, 2) AS "RU105",
        ROUND(cm.MTS_CAL, 0) AS "METROS_CAL",
        cm.CAL_PERCENT AS "CAL_PERCENT",
        cm.PTS_100M2 AS "PTS_100M2"
      FROM RoladaBase rb
      INNER JOIN UrdideiraMetrics um ON rb.ROLADA = um.ROLADA
      INNER JOIN NumFiosPorRolada nf ON rb.ROLADA = nf.ROLADA
      INNER JOIN RoladaMetrics rm ON rb.ROLADA = rm.ROLADA AND rb.COR = rm.COR
      LEFT JOIN RoladaCalidad rc ON rb.ROLADA = rc.ROLADA AND rb.COR = rc.COR
      LEFT JOIN TecelagemMetrics tm ON rb.ROLADA = tm.ROLADA
      LEFT JOIN CalidadMetrics cm ON rb.ROLADA = cm.ROLADA
      WHERE rb.FECHA_INICIO BETWEEN $1::date AND $2::date
      ORDER BY rb.FECHA_INICIO DESC, rb.ROLADA DESC, rb.COR
    `

    const result = await query(sql, [fechaInicio, fechaFin], 'informe-produccion-indigo')
    res.json(result.rows)
  } catch (err) {
    console.error('Error en informe-produccion-indigo:', err)
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
// ENDPOINTS PARAMETROS HVI (Gestión de rangos de calidad)
// =====================================================

// GET /api/parametros-hvi - Listar todos los parámetros HVI
app.get('/api/parametros-hvi', async (req, res) => {
  try {
    const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    
    let sql = 'SELECT * FROM tb_parametros_hvi'
    const params = []
    
    if (activo !== undefined) {
      sql += ' WHERE activo = $1'
      params.push(activo)
    }
    
    sql += ' ORDER BY codigo ASC'
    
    const result = await query(sql, params, 'parametros-hvi-list')
    res.json({ 
      success: true,
      parametros: result.rows 
    })
  } catch (err) {
    console.error('Error obteniendo parámetros HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// GET /api/parametros-hvi/:codigo - Obtener un parámetro por código
app.get('/api/parametros-hvi/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params
    
    const result = await query(
      'SELECT * FROM tb_parametros_hvi WHERE codigo = $1',
      [codigo.toUpperCase()],
      'parametros-hvi-get-one'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      parametro: result.rows[0] 
    })
  } catch (err) {
    console.error('Error obteniendo parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// POST /api/parametros-hvi - Crear un nuevo parámetro HVI
app.post('/api/parametros-hvi', async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      grupo,
      unidad,
      tipo_dato,
      decimales,
      optimo_min,
      optimo_max,
      aceptable_min,
      aceptable_max,
      critico_min,
      critico_max,
      activo
    } = req.body
    
    // Validaciones básicas
    if (!codigo || !nombre || !tipo_dato) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos requeridos: codigo, nombre, tipo_dato' 
      })
    }
    
    const result = await query(
      `INSERT INTO tb_parametros_hvi (
        codigo, nombre, descripcion, grupo, unidad, tipo_dato, decimales,
        optimo_min, optimo_max, aceptable_min, aceptable_max,
        critico_min, critico_max, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        codigo.toUpperCase(),
        nombre,
        descripcion || null,
        grupo || null,
        unidad || null,
        tipo_dato,
        decimales !== undefined ? decimales : 2,
        optimo_min || null,
        optimo_max || null,
        aceptable_min || null,
        aceptable_max || null,
        critico_min || null,
        critico_max || null,
        activo !== undefined ? activo : true
      ],
      'parametros-hvi-create'
    )
    
    res.status(201).json({ 
      success: true,
      parametro: result.rows[0],
      message: 'Parámetro HVI creado exitosamente'
    })
  } catch (err) {
    console.error('Error creando parámetro HVI:', err)
    
    // Manejar error de código duplicado
    if (err.code === '23505') {
      return res.status(409).json({ 
        success: false,
        error: 'Ya existe un parámetro con ese código' 
      })
    }
    
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// PUT /api/parametros-hvi/:id - Actualizar un parámetro HVI existente
app.put('/api/parametros-hvi/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      nombre,
      descripcion,
      grupo,
      unidad,
      tipo_dato,
      decimales,
      optimo_min,
      optimo_max,
      aceptable_min,
      aceptable_max,
      critico_min,
      critico_max,
      activo
    } = req.body
    
    // Validaciones básicas
    if (!nombre || !tipo_dato) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos requeridos: nombre, tipo_dato' 
      })
    }
    
    const result = await query(
      `UPDATE tb_parametros_hvi SET
        nombre = $1,
        descripcion = $2,
        grupo = $3,
        unidad = $4,
        tipo_dato = $5,
        decimales = $6,
        optimo_min = $7,
        optimo_max = $8,
        aceptable_min = $9,
        aceptable_max = $10,
        critico_min = $11,
        critico_max = $12,
        activo = $13
      WHERE id = $14
      RETURNING *`,
      [
        nombre,
        descripcion || null,
        grupo || null,
        unidad || null,
        tipo_dato,
        decimales !== undefined ? decimales : 2,
        optimo_min || null,
        optimo_max || null,
        aceptable_min || null,
        aceptable_max || null,
        critico_min || null,
        critico_max || null,
        activo !== undefined ? activo : true,
        id
      ],
      'parametros-hvi-update'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      parametro: result.rows[0],
      message: 'Parámetro HVI actualizado exitosamente'
    })
  } catch (err) {
    console.error('Error actualizando parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// DELETE /api/parametros-hvi/:id - Eliminar un parámetro HVI
app.delete('/api/parametros-hvi/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM tb_parametros_hvi WHERE id = $1 RETURNING codigo, nombre',
      [id],
      'parametros-hvi-delete'
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Parámetro HVI no encontrado' 
      })
    }
    
    res.json({ 
      success: true,
      deleted: result.rows[0],
      message: 'Parámetro HVI eliminado exitosamente'
    })
  } catch (err) {
    console.error('Error eliminando parámetro HVI:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
  }
})

// =====================================================
// DETALLE MISTURA POR LOTE DE HILANDERÍA
// =====================================================

// GET /api/detalle-mistura/:loteFiac - Obtener detalle de mistura por LOTE_FIAC
app.get('/api/detalle-mistura/:loteFiac', async (req, res) => {
  try {
    const { loteFiac } = req.params
    
    if (!loteFiac) {
      return res.status(400).json({ 
        success: false,
        error: 'LOTE_FIAC es requerido' 
      })
    }

    // Formatear LOTE_FIAC con ceros adelante (10 dígitos)
    const loteFiacFormateado = String(loteFiac).padStart(10, '0')
    
    console.log(`[DetalleMistura] Buscando LOTE_FIAC: ${loteFiac} → Formateado: ${loteFiacFormateado}`)
    
    // Helper para parsear números desde texto
    const sqlParseNumber = (col) => `
      CASE 
        WHEN ${col} IS NULL OR ${col} = '' THEN NULL
        ELSE CAST(REPLACE(REPLACE(${col}, '.', ''), ',', '.') AS NUMERIC)
      END
    `
    
    const sql = `
      SELECT 
        "LOTE_FIAC",
        "MISTURA",
        "PRODUTOR",
        "LOTE",
        ${sqlParseNumber('"QTDE"')} AS "QTDE",
        ${sqlParseNumber('"PESO"')} AS "PESO",
        "TP",
        "CLASSIFIC",
        ${sqlParseNumber('"SCI"')} AS "SCI",
        ${sqlParseNumber('"MST"')} AS "MST",
        ${sqlParseNumber('"MIC"')} AS "MIC",
        ${sqlParseNumber('"MAT"')} AS "MAT",
        ${sqlParseNumber('"UHML"')} AS "UHML",
        ${sqlParseNumber('"UI"')} AS "UI",
        ${sqlParseNumber('"SF"')} AS "SF",
        ${sqlParseNumber('"STR"')} AS "STR",
        ${sqlParseNumber('"ELG"')} AS "ELG",
        ${sqlParseNumber('"RD"')} AS "RD",
        ${sqlParseNumber('"PLUS_B"')} AS "PLUS_B",
        ${sqlParseNumber('"TrCNT"')} AS "TrCNT",
        ${sqlParseNumber('"TrAR"')} AS "TrAR",
        ${sqlParseNumber('"TRID"')} AS "TRID"
      FROM tb_calidad_fibra
      WHERE "LOTE_FIAC" = $1
        AND "TIPO_MOV" = 'MIST'
        AND "PRODUTOR" IS NOT NULL
        AND "PRODUTOR" != ''
      ORDER BY "PRODUTOR", "LOTE"
    `
    
    const result = await query(sql, [loteFiacFormateado], 'detalle-mistura')
    
    console.log(`[DetalleMistura] Filas encontradas: ${result.rows.length}`)
    
    res.json({ 
      success: true,
      loteFiac: loteFiac,
      loteFiacFormateado: loteFiacFormateado,
      filas: result.rows,
      total: result.rows.length
    })
  } catch (err) {
    console.error('Error obteniendo detalle de mistura:', err)
    res.status(500).json({ 
      success: false,
      error: err.message 
    })
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
